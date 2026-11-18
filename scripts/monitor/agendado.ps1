# Rodada automática do Monitor, chamada pelo Agendador de Tarefas do Windows (tarefa "EstudeMais - Monitor",
# a cada 5 minutos, por agendado.vbs para não abrir janela).
# 1. Checagem barata, sem Claude: exporta só quem está há 20 min sem cadastrar nem editar questão pendente
#    (cadastrou outra no meio? a contagem dessa pessoa recomeça). Questão que falhou espera 1 hora; depois de 3 vezes, sai da fila.
# 2. Só se saiu lote novo: roda o Claude Code sem janela, do passo 2 ao 5 de .claude/skills/monitor/SKILL.md, só com esses lotes.
# Logs em monitor/logs/ (fora do git: dados pessoais). A última checagem fica em monitor/logs/ultima-checagem.txt.
# Permissões do Claude: só o que o Monitor usa. Nada de comando livre no terminal, porque o texto das questões vem das pessoas.

$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)  # a saída do Node e do Claude é UTF-8; sem isto o log quebra os acentos
$projeto = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projeto

$logs = Join-Path $projeto 'monitor\logs'
New-Item -ItemType Directory -Force $logs | Out-Null
$lotes = Join-Path $projeto 'monitor\lotes'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = 'C:\Program Files\nodejs\node.exe' }
# A rede da empresa intercepta o TLS: o Node precisa confiar nos certificados do Windows (mesmo truque do rodar.mjs).
$env:NODE_USE_SYSTEM_CA = '1'

# 1. Checagem
$antes = @(if (Test-Path $lotes) { Get-ChildItem $lotes -Filter *.json | ForEach-Object Name })
$saida = & $node scripts/monitor/rodar.mjs exportar --ociosos 20 --automatico 2>&1 | Out-String
$codigo = $LASTEXITCODE
$novos = @(Get-ChildItem $lotes -Filter *.json -ErrorAction SilentlyContinue | Where-Object { $antes -notcontains $_.Name } | Sort-Object Name | ForEach-Object Name)
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') (codigo $codigo)`r`n$saida" | Out-File -Encoding utf8 (Join-Path $logs 'ultima-checagem.txt')
if ($codigo -ne 0 -or $saida -match 'DESISTIU') {
  "=== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') checagem (codigo $codigo)`r`n$saida" | Out-File -Encoding utf8 -Append (Join-Path $logs ('{0:yyyy-MM-dd}_avisos.log' -f (Get-Date)))
}
if (-not $novos.Count) { exit 0 }

# 2. Rodada com o Claude, só com os lotes novos
$log = Join-Path $logs ('{0:yyyy-MM-dd_HHmm}.log' -f (Get-Date))
"=== Rodada do Monitor: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`r`n$saida" | Out-File -Encoding utf8 $log

$cli = Join-Path $env:APPDATA 'npm\node_modules\@anthropic-ai\claude-code\cli.js'
$listaLotes = ($novos | ForEach-Object { "monitor/lotes/$_" }) -join ', '
$prompt = 'Rodada automatica do Monitor, sem ninguem olhando. Os lotes ja foram exportados, NAO rode o passo 1 (exportar): ' + $listaLotes + '. ' +
  'Leia .claude/skills/monitor/SKILL.md e siga do passo 2 ao 5 so com esses lotes, sem fazer perguntas. ' +
  'No passo 2 use o agente monitor (subagent_type monitor). Rode os comandos npm exatamente como estao no SKILL.md, sem cd e sem redirecionar a saida. ' +
  'Se algo for bloqueado ou der erro, nao insista nem pergunte: escreva no resumo o que falhou e pare. No fim, escreva o resumo do passo 5.'

$ferramentas = @(
  'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Agent', 'Task', 'Skill',
  'Bash(npm run monitor:aplicar:*)', 'PowerShell(npm run monitor:aplicar:*)'
)

& $node --use-system-ca $cli -p $prompt --allowedTools @ferramentas *>&1 | Out-File -Encoding utf8 -Append $log
"=== Fim: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') (codigo $LASTEXITCODE)" | Out-File -Encoding utf8 -Append $log

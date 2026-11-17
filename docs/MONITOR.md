# Minhas questões e o Monitor

A pessoa cadastra as questões de simulado que quer entender melhor, escreve o que estudou, e **o Monitor** (como o monitor da faculdade de direito: ajuda, mas não é professor) confere a resposta nas fontes oficiais, comenta o que ela escreveu e guarda o que ela aprendeu num caderno.

**Regra do produto: o app NÃO chama IA.** A IA roda só no computador do dono, em lote, e grava o resultado no banco. O app só mostra. O comentário sempre vem com o aviso "preparado com ajuda de IA e conferido nas fontes oficiais".

O nome do personagem fica numa constante só: `PERSONAGEM` em `src/lib/questoes.ts` (nome e artigo). Os textos do app usam `NOME_MONITOR`, `NOME_MONITOR_CAP` e `DO_MONITOR`. O arquivo do agente (`.claude/agents/monitor.md`) e a skill (`.claude/skills/monitor/SKILL.md`) falam "o Monitor": ao trocar o nome, troque lá também.

## O que a pessoa vê (no app)

- **Minhas questões** (menu; no celular, em "Mais"): lista com o estado de cada uma ("Aguardando o Monitor", "Comentada · nova" até abrir, "Comentada"), filtros e o botão **Cadastrar questão**. O contador no menu mostra quantas comentadas ainda não foram lidas.
- **Formulário:** plano/matéria/assunto (do plano da pessoa, ou matéria escrita), banca e prova (opcionais), enunciado, alternativas A a E (pôr e tirar) ou Certo/Errado, o que marcou (opcional), a resposta certa e "O que você estudou e aprendeu". O rascunho fica no aparelho a cada digitação (`revisemais:rascunho-questao:*`). Dá para editar enquanto estiver pendente; depois de comentada, não.
- **Detalhe:** a questão (resposta certa em verde, o que marcou em vermelho se errou), o que ela escreveu e, quando chegar, o comentário do Monitor: se a resposta confere com as fontes (ou o aviso de que não bateu / não foi possível fechar), alternativa por alternativa, o que está certo / o que ajustar / o que faltou no texto dela, complemento, parecidas entre as dela, ponto em dúvida e as fontes (com link).
- **Meu caderno:** os aprendizados por matéria, com a origem (Você ou Monitor), a fonte e o link da questão. A pessoa também anota os dela.
- **Aviso no celular** quando o Monitor comenta ("O Monitor comentou sua questão de <matéria>"), pelo mesmo mecanismo de notificação do Mentor de foco.

## Banco (migração `supabase/migrations/0006_questoes.sql`, já rodada no projeto `xqojqdxbvndzftpbpdmy`)

Todas com RLS "dono" (`user_id = auth.uid()`); a migração pode rodar mais de uma vez.

| Tabela | Para quê |
| --- | --- |
| `questoes` | A questão, o que marcou, o gabarito informado, o texto da pessoa, `status` (`pendente` ou `comentada`), `comentario_monitor` (jsonb, formato em `scripts/monitor/esquema.ts`), `comentada_em`, `lida_em`. |
| `aprendizados` | A "memória": uma ideia curta e exata por linha, com `fonte`, `questoes` (ids das questões a que se liga) e `origem` (`voce` ou `monitor`). |
| `inscricoes_push` | A inscrição **completa** de notificação do aparelho (`endpoint`, `p256dh`, `auth`, `app`). O app grava ao inscrever (`src/lib/foco/avisos.ts`). É o que permite mandar aviso **com texto**. |

Sem a tabela (migração não rodada), o app avisa na tela e o resto segue igual.

## Como o dono roda (2 a 3 vezes por semana)

No Claude Code, dentro desta pasta: **`/monitor`** (skill `.claude/skills/monitor/SKILL.md`). É separado da atualização das leis do Advogando. Por baixo:

1. `npm run monitor:exportar` lê as pendentes de todas as pessoas (só leitura) e grava `monitor/lotes/AAAA-MM-DD-lote-N.json` (uma pessoa por lote, até 6 questões; `-- --por-lote N` muda) e `monitor/pendentes/AAAA-MM-DD.json`. Cada lote leva também o caderno da pessoa nessas matérias e as outras questões dela (para apontar parecidas).
2. Agentes `monitor` comentam cada lote em paralelo e gravam `monitor/comentarios/<mesmo nome>.json` (esquema abaixo). Eles só afirmam o que abriram nas fontes oficiais; sem prova, marcam dúvida.
3. `npm run monitor:aplicar -- --todos --simular` valida sem gravar. `npm run monitor:aplicar -- --todos` grava.
4. O resumo para o dono sai da skill.

Os scripts usam a chave de acesso total do `.env` do AdvogandoGame (`TOKEN_SUPABASE_FULLACCESS_ESTUDEMAIS_ADVOGANDO`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_JWK`), achado em `../../Advogando/AdvogandoGame/.env` ou pela variável `MONITOR_ENV`, e `--use-system-ca` (a rede da empresa intercepta TLS). **Nada imprime chaves.** A pasta `monitor/` está no `.gitignore`: são dados pessoais e nunca vão para o git.

### O que o `aplicar` faz

- Recusa o item sem fonte, com letra inexistente, com alternativas que contradizem a resposta, quando não confere sem explicar, ou de questão que já não está pendente. Os recusados vão para `monitor/rejeitados/`.
- Grava `comentario_monitor`, `status = 'comentada'` e `comentada_em` (só se ainda estiver pendente).
- Guarda os aprendizados novos (exige `fonte`, até 400 caracteres) e **não repete**: se o texto (sem acento, caixa e pontuação) já existe no caderno da pessoa, só liga à questão. Os `aprendizados_existentes` que o agente apontar também são ligados.
- Manda **um aviso por pessoa** a cada aparelho inscrito (`web-push`, com a chave privada VAPID vinda do campo `d` do JWK). Inscrição que responde 404 ou 410 é apagada. O Service Worker (`public/sw-avisos.js`) mostra o título e o texto e abre a questão ao tocar.

### Esquema da saída dos agentes

Está comentado no topo de `scripts/monitor/esquema.ts` e no `.claude/agents/monitor.md`. Resumo: `{ lote, itens: [{ questao_id, user_id, comentario: { versao: 1, resposta_oficial: { letra, confere: true | false | "duvida", observacao? }, alternativas: [{ letra, correta, explicacao }], sobre_o_que_voce_escreveu: { acertou, ajustar, faltou }, complemento, parecidas: [{ questao_id, motivo }], fontes: [{ referencia, url? }], duvida? }, aprendizados_existentes: [id], aprendizados_novos: [{ texto, fonte, assunto_id? }] }] }`.

## Custo

Cada questão gasta tokens do dono (pesquisa nas fontes, explicação de cada alternativa). Hoje é grátis para quem testa. **Quando houver venda:** o Monitor deve ser recurso de plano pago ou ter limite semanal (por exemplo, N questões comentadas por semana por pessoa; o `exportar` pode ordenar por pessoa e cortar). A fila já deixa isso simples: basta o `exportar` escolher quem entra.

## LGPD e termos de uso

O texto que a pessoa escreve (enunciado, respostas, o que estudou) é **processado por IA, do lado do autor**, para gerar o comentário. Antes de vender, os termos de uso e a política de privacidade precisam dizer isso com clareza: o que é enviado, que é um serviço de IA, para que serve, por quanto tempo fica guardado e como apagar (a pessoa pode apagar a questão enquanto pendente; o apagamento da conta apaga tudo por `on delete cascade`). Os dados exportados ficam em `monitor/` no PC do dono (fora do git); apague os lotes depois de aplicar (a skill move os aplicados para `monitor/aplicados/`; limpe a pasta de tempos em tempos). Enquanto os termos não existem, só pessoas que o dono conhece devem usar.

## Limites conhecidos

- **Conta do mesmo aparelho:** a inscrição de notificação é uma linha por aparelho (`endpoint`). Se outra conta entrar no mesmo aparelho, a linha da primeira pertence a ela e a gravação da segunda é recusada pela regra de segurança (falha em silêncio): só a primeira conta recebe o aviso com texto. Para resolver, um passo de servidor que transfira a linha (função `security definer`).
- A pessoa pode alterar o próprio `comentario_monitor` direto pela API (a regra "dono" deixa). Não afeta ninguém além dela; se algum dia o comentário virar prova de algo (selo, ranking), proteger com coluna só do servidor.
- O agente pode errar. Por isso o app mostra o aviso de IA, as fontes com link e o estado "não bate com as fontes" / "não foi possível fechar". Não há revisão humana por padrão; vale o dono olhar as questões em que a resposta não bateu (a skill lista).

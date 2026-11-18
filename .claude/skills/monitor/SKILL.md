---
name: monitor
description: Roda a rodada do Monitor do EstudeMais. Exporta as questões pendentes cadastradas pelas pessoas, manda agentes comentarem em lotes (em paralelo), grava os comentários e os aprendizados no banco, avisa no celular de quem cadastrou e resume para o dono. Use quando o dono pedir /monitor ou para comentar as questões pendentes (2 a 3 vezes por semana). É separado da atualização semanal das leis.
---

# Rodada do Monitor

Na fase de testes, isto roda sozinho: a tarefa do Windows "EstudeMais - Monitor" checa a cada 5 minutos e roda a rodada 20 minutos depois que a pessoa para de cadastrar (`scripts/monitor/agendado.ps1`, log em `monitor/logs/`). O dono também pode chamar à mão. Fale com ele em português simples. O app não usa IA: tudo aqui roda no PC dele e grava o resultado no banco. Cada questão gasta tokens dele: avise o tamanho da rodada antes de começar se passar de umas 30 questões.

Pré-requisito: o `.env` do AdvogandoGame (chaves) no caminho que `scripts/monitor/rodar.mjs` espera, ou a variável `MONITOR_ENV`. **Nunca imprima o conteúdo de chaves ou tokens.** As pastas `monitor/` têm dados pessoais e estão no `.gitignore`: nunca as coloque no git nem as cole em outro lugar.

## 1. Exportar
`npm run monitor:exportar` (opcional: `-- --por-lote 6`).
Diz quantas questões pendentes há, cria `monitor/lotes/AAAA-MM-DD-HHmm-lote-N.json` e lista os nomes dos lotes criados. Se não houver pendentes, diga isso ao dono e pare.

## 2. Comentar, em paralelo
Para cada lote que o exportar acabou de listar (só esses: a pasta guarda lotes de rodadas anteriores, já aplicados), chame o agente `monitor` (todos de uma vez, na mesma mensagem, no máximo uns 6 ao mesmo tempo). Prompt de cada um: "Comente o lote `monitor/lotes/<arquivo>`; grave `monitor/comentarios/<arquivo>`."
Ao fim, confira que cada lote tem seu arquivo em `monitor/comentarios/`. Lote sem arquivo: rode o agente de novo só para ele.
Lembre os agentes: quando a questão tem `pergunta`, a resposta a ela é obrigatória, mesmo se for de outro assunto (aí dizem isso e por quê, e respondem de forma útil, com fonte). Anote o que cada agente relatar de `confere: false` ou `"duvida"` e de fontes inacessíveis.

## 3. Conferir antes de gravar
`npm run monitor:aplicar -- --todos --simular` valida tudo sem gravar (inclusive: questão em que a pessoa fez uma pergunta sem `resposta_pergunta`, ou pergunta de outro assunto sem o `por_que`). Itens recusados (sem fonte, letra inexistente...) aparecem na tela: peça ao agente `monitor` para refazer só esses itens e junte no mesmo arquivo. Não grave um item recusado "no braço".

## 4. Gravar e avisar
`npm run monitor:aplicar -- --todos`
Grava o comentário, muda a questão para "comentada", guarda os aprendizados novos (sem repetir os que existem) e manda a notificação "O Monitor comentou sua questão de <matéria>". Os arquivos aplicados vão para `monitor/aplicados/`; os recusados, para `monitor/rejeitados/`. Use `--sem-aviso` se o dono não quiser notificar agora.

## 5. Resumo para o dono
Diga em poucas linhas: quantas questões e de quantas pessoas; quantos aprendizados novos; quantas notificações foram enviadas; as questões em que a resposta informada não bateu com as fontes ou ficou em dúvida (matéria, id e por quê, **sem copiar o texto pessoal da pessoa**); itens recusados e o que foi feito. Diga também quantas perguntas foram respondidas e quantas eram de outro assunto (matéria e id, sem copiar o texto). Se houver `confere: false`, sugira ao dono olhar essas primeiro: podem ser gabarito anulado, erro de digitação ou erro do agente.

# Revisões atrasadas sem acúmulo e assuntos repetidos entre planos — desenho

Data: 18/11/2026. Pedido do dono a partir da reclamação de uma usuária (fase de testes).

## Por que

A usuária reclamou de duas coisas na lista de revisões atrasadas:

1. **Revisão repetida entre planos.** Ela estuda o mesmo assunto em vários planos (editais diferentes) e, ao revisar
   num plano, a revisão não vale nos outros: tem de marcar de novo em cada um.
2. **Atrasos acumulados.** Quando a revisão de 48h atrasa a ponto de chegar ao marco seguinte (1 semana), aparecem
   duas notificações do mesmo assunto. Para "apagar" os atrasos ela teria de fazer 2, 3, 4 revisões no mesmo dia.
   O certo é uma notificação só ("sem revisar há X dias") que cresce com o tempo; quando ela revisa, a contagem
   recomeça a partir dali.

Conferido no banco (18/11/2026, conta dela, 3 planos: CREMERJ 2026, OAB, PGERJ Residência):

- 8 revisões atrasadas em só 4 assuntos: cada um com a de 48h e a de 1 semana vencidas ao mesmo tempo.
- "Organização político-administrativa" foi estudada nos 3 planos em 03/11, cada plano com as próprias 4 revisões.
  Hoje ela marcou a revisão de 1 semana 5 vezes (as 3 + "Os Estados-membros…" e "Ponto 4", do mesmo tema, na PGERJ).
- A correlação por nome que o app já tem (`src/lib/correlacao.ts`) só liga CREMERJ ↔ OAB (0,86). O assunto da PGERJ
  tem o nome comprido (vários tópicos do edital) e fica abaixo do limiar; "Ponto 4" não tem como casar por nome.
- O "estudo compartilhado" que já existe (`fontesDeEstudo`/`idEfetivo`) só evita duplicata quando o assunto equivalente
  ainda **não** foi estudado. Quando os dois têm estudo próprio, cada um mantém suas revisões.

## Objetivos

- Cada assunto aparece **uma vez** entre as revisões a fazer, por mais marcos que tenham vencido, com quanto tempo está
  sem revisar. Os contadores ("atrasadas", título da aba, Painel, Mentor) contam assuntos, não marcos.
- **Uma revisão feita resolve o assunto**: vale por todas as revisões já vencidas dele, e as próximas passam a contar
  a partir do dia em que ela revisou.
- O app **sugere** assuntos que parecem ser o mesmo em planos diferentes (como o "mesclar contatos duplicados" do
  Google Contatos) e, se a pessoa confirmar, **mescla**: a partir daí estudos e revisões são um conjunto só.
- A pessoa também pode mesclar à mão o que o algoritmo não acha, e desfazer uma mesclagem.

## Fora do escopo

- Mudar os intervalos (48h, 1 semana, 2 meses, 6 meses) ou o "estudo compartilhado" automático que já existe.
- Sugerir mesclagem dentro do mesmo plano (só a mesclagem manual cobre esse caso).
- Mexer no calendário assinável além do que a limpeza de duplicatas já resolve sozinha.

## O que não pode acontecer (anti-objetivos)

- Apagar assunto de um plano. Cada plano continua com a lista completa do seu edital.
- Mesclar sem a pessoa confirmar. O algoritmo só sugere.
- Encher a tela de sugestões. Planos de edital têm centenas de assuntos; sugestão que a pessoa não precisa é ruído.
- Inflar os números: uma revisão feita conta como uma, não como as várias que ela resolveu.

## Restrições

- React + TypeScript + Vite, Supabase, PWA. O app não usa IA.
- Funciona com o banco antes da migração nova (tabela opcional, coluna ausente = sem mesclagem) e no modo local
  (`backendLocal`, usado pelo `npm run navegar`).
- `npm test` e `npx tsc -b` passam antes do commit; `npm run navegar` antes de entregar mudança de tela.
- Textos em português, tratando por "você", ícones SVG (`Icone`), hierarquia de botões do CLAUDE.md.

## Abordagens consideradas

**Item 2 (o que acontece quando ela revisa um assunto atrasado):**

- **Escolhida: uma revisão vale por todas as vencidas, e as seguintes contam a partir dela.** O dono confirmou:
  "quando ela fizer, o tempo vai ter que recontar a partir dali, pois se não, ela teria que fazer 2, 3, 4 revisões
  no dia para apagar os outros atrasos".
- Descartada: recomeçar a sequência do marco atrasado (a de 1 semana passaria para 5 dias depois). Mantinha todos os
  reforços, mas não é o que o dono pediu.

**Item 1 (o que "mesclar" faz por baixo):**

- **Escolhida (A): ligar.** Cada plano mantém o assunto na lista, mas os assuntos ligados passam a ter um conjunto só
  de estudos e revisões. Na mesclagem, as revisões pendentes repetidas são limpas. Coluna nova em `assuntos` e uma
  tabela para os "não são iguais".
- Descartada (B): espelhar (cada um com suas revisões; marcar uma marca as outras). Números inflados e cópias que
  podem divergir.
- Descartada: fundir de verdade (apagar o assunto dos outros planos). O plano ficaria sem um assunto do edital.
- Sobre como identificar: o dono pediu algoritmo de semelhança + confirmação da pessoa ("o app verifica semelhanças e
  pergunta se essas matérias são as mesmas; se for, mescla, como a agenda do Google no celular").

## Desenho

### Parte 1 — revisões a fazer, um item por assunto

**Agrupamento.** As revisões pendentes são agrupadas pela **raiz** do assunto (a raiz é o próprio assunto, ou o
assunto principal do grupo quando ele foi mesclado; ver Parte 2). Um item da lista = uma raiz que tem ao menos uma
revisão pendente com `data_prevista <= hoje`. A lógica fica numa função pura em `src/lib/` (algo como
`revisoesAFazer(dados, hoje)`), usada por todas as telas que hoje filtram `dados.revisoes` na mão:
`Hoje.tsx` (cartões e listas), `App.tsx` (título da aba), `Mentor.tsx` (lembrete e fala), `Painel.tsx`
("para hoje · N atrasadas" e "Atrasadas pendentes"), `lib/advogando.ts` (foco do plano) e `Plano.tsx`
(filtro "Com revisão atrasada", que já é por assunto).

Cada item traz: a revisão pendente mais antiga (a que o botão "Revisei" conclui), as demais vencidas do grupo, os
assuntos e planos do grupo, e a data do último contato com o assunto (o mais recente entre estudos e revisões feitas
de todos os assuntos do grupo).

**Exibição na Hoje.** Atrasado = a revisão mais antiga do item venceu antes de hoje. O item mostra as etiquetas de
todos os planos do grupo, a matéria e o assunto, e no lugar do "há N dias" mostra "sem revisar há N dias" (desde o
último contato). Exemplo com os dados dela, hoje:

```
[OAB]  48 horas · sem revisar há 13 dias
Direito Civil — Parte Geral
[✓ Revisei]   Provar no escritório   Adiar para amanhã
```

O cartão "atrasadas" passa de 8 para 4. "Para hoje" = itens cuja revisão mais antiga vence hoje.
"Próximos 7 dias" (agenda) continua listando as revisões futuras, sem repetir o mesmo assunto no mesmo dia.

**Concluir (regra central, dentro de `acoes.concluirRevisao`, para valer em todos os caminhos: Hoje, cronômetro em
`Estudar.tsx` e retorno do Advogando em `pages/Advogando.tsx`).** Ao concluir a revisão R do grupo G na data D:

1. R fica concluída em D (com % e questões, como hoje).
2. As outras revisões pendentes de G com `data_prevista <= D` foram resolvidas por R: são **apagadas**, para a
   revisão contar uma vez só no Painel e no "feitos na semana".
3. Se R estava atrasada (`D > data_prevista` de R), as revisões pendentes restantes de G recontam a partir de D:
   nova data = o cálculo do marco a partir de D (`REVISOES[tipo].calcular(D)`). Exemplo: estudo em 03/11, nada
   revisado, revisão feita em 18/11 → 48h concluída em 18/11, 1 semana apagada, 2 meses vai para 18/01/2027,
   6 meses para 18/05/2027.
4. Se R foi feita no prazo, nada mais muda (comportamento atual).

**Adiar para amanhã.** Passa para amanhã todas as revisões pendentes de G com `data_prevista <= hoje`.

**Desmarcar** (o "desfazer" do `HistoricoAssunto`) continua só tirando a conclusão de R; as revisões apagadas ou
recontadas não voltam. Aceitável: é um caso raro e o assunto volta a aparecer como pendente.

### Parte 2 — assuntos repetidos e mesclagem

**Dados (migração `supabase/migrations/0007_assuntos_mesclados.sql`).**

- `assuntos.mesclado_em uuid null references assuntos(id) on delete set null`: aponta para a raiz do grupo. A raiz
  tem `null`. Sem cadeias: todo membro aponta direto para a raiz.
- Tabela `assuntos_distintos` (`id`, `user_id` com o padrão das outras, `assunto_a`, `assunto_b`, ambos com
  `on delete cascade`, `created_at`) com RLS "dono" igual às demais. Guarda os pares que a pessoa disse que não são
  iguais (par ordenado, `assunto_a < assunto_b`).
- No app: `Assunto.mesclado_em?: string | null`; nova tabela em `Dados`/`TABELAS`, marcada em `OPCIONAIS`
  (sem a migração, o app funciona sem sugestões dispensadas). Modo local guarda igual às outras tabelas.

**Grupos nos índices (`useIndices`, `store.tsx`).** Estudos e revisões continuam gravados no assunto em que
aconteceram. `estudosPorAssunto` e `revisoesPorAssunto` passam a ser indexados pela raiz e `idEfetivo` devolve a raiz
antes de olhar o estudo compartilhado. Assim `Plano.tsx`, `Estudar.tsx`, `RegistrarEstudo.tsx` e `HistoricoAssunto`
enxergam o grupo sem mudar sua lógica. `registrarEstudo` com `substituirPendentes` limpa as pendentes do grupo
inteiro, não só do assunto.

**Mesclar (ação nova, ex. `acoes.mesclarAssuntos(ids)`).**

1. Raiz = o assunto do grupo com o estudo mais recente (empate: o do plano que vem primeiro na ordem). Se algum já
   pertence a um grupo, os grupos se juntam numa raiz só.
2. Todos os outros passam a `mesclado_em = raiz`.
3. Revisões pendentes repetidas: fica só a sequência pendente do estudo mais recente do grupo (empate: a da raiz);
   as pendentes dos outros estudos são apagadas. Revisões já feitas e estudos ficam como histórico.

Com os dados dela: os 3 "Organização político-administrativa" (12 revisões, 6 pendentes de 2 e 6 meses com as mesmas
datas) viram um grupo com 2 pendentes.

**Desfazer.** No assunto mesclado: "Desfazer mesclagem" tira só aquele assunto do grupo (`mesclado_em = null`). Se for
a raiz, outro membro vira a raiz e os demais passam a apontar para ele. **O ciclo de revisões fica com o grupo**: se as
revisões pendentes estão gravadas no assunto que sai, elas e o estudo delas passam para a raiz que fica (atualizar
`assunto_id` em `estudos` e `revisoes`). O assunto que sai leva só o histórico já encerrado gravado nele e fica sem
revisões pendentes; o histórico dele mostra "Registrar estudo" para começar um ciclo próprio. Os pares dele com os
membros que ficam entram em `assuntos_distintos`, para não serem sugeridos de novo.

**Apagar assunto, disciplina ou plano com assunto mesclado.** Antes de apagar, os estudos e revisões gravados no
assunto que vai sumir passam para outro membro do grupo (que vira a raiz, se preciso), e os demais membros são
reapontados. Apagar o plano de uma prova que já passou não pode tirar o ciclo dos outros planos. O
`on delete set null` da coluna é só a rede de segurança.

**Sugestões (função pura em `correlacao.ts`, ex. `sugerirMesclagens`).**

- Só entre planos diferentes e dentro de disciplinas equivalentes (`correlacoes.disciplinas`, ou mesmo nome
  normalizado).
- Dois assuntos são candidatos se: o score atual de assunto ≥ `LIMIAR_ASSUNTO` (0,6), **ou** as palavras relevantes do
  nome mais curto estão todas no mais comprido e o mais curto tem pelo menos 3 palavras relevantes (pega o caso da
  PGERJ, cujo nome comprido começa por "Organização político-administrativa do Estado brasileiro").
- Os candidatos se juntam em grupos (pares ligados entre si), sem os pares de `assuntos_distintos` e sem quem já está
  no mesmo grupo mesclado. **No máximo um assunto por plano em cada grupo**: os pares entram do maior score para o
  menor, e o par que poria dois assuntos do mesmo plano no grupo fica de fora.
- **Só vira sugestão o grupo em que pelo menos dois assuntos (ou grupos) têm estudo próprio**, que é quando existem
  revisões duplicadas. Assunto não estudado já é coberto pelo estudo compartilhado automático; sugeri-lo seria ruído.
- Conferido com os dados reais (18/11/2026): na conta dela (512 assuntos) a regra gera 28 pares candidatos, e só 3
  têm os dois lados estudados, exatamente o grupo abaixo. Na outra conta com dados, nenhum. Os nomes reais, para os
  testes (todos na disciplina "Direito Constitucional"):
  - CREMERJ 2026 – Analista Jurídico: `Organização político-administrativa`
  - OAB: `Organização político-administrativa do Estado` (score 0,86 com o do CREMERJ)
  - PGERJ Residência: `Organização político-administrativa do Estado brasileiro. Repartição de competências e seus
    critérios. Competências político-administrativas, legislativas e tributárias. Autonomia dos entes federativos.
    Intervenção federal e estadual. Mecanismos de integração e de cooperação federativos: regiões, regiões
    metropolitanas, aglomerações urbanas e microrregiões` (score 0,22 e 0,29; entra pela regra de "contido")
- O limiar e a regra de "contido" podem ser ajustados durante a construção, desde que os testes acima continuem
  passando e a conta dela continue sem sugestões a mais.

**Telas.**

- **Assuntos repetidos** (rota nova `#/repetidos`, item no menu Mais/lateral, perto de "Comparar editais"): um cartão
  por sugestão, com a matéria, o assunto em cada plano (etiqueta + nome cortado, com caixa de marcar, todas marcadas)
  e quantas revisões pendentes viram uma. Botões: "Mesclar" (principal; mescla os marcados, exige pelo menos 2) e
  "Não são iguais" (texto; grava todos os pares do grupo em `assuntos_distintos`). Ao mesclar com algum desmarcado,
  os pares do desmarcado com os marcados também são gravados como distintos. Sem sugestões: mensagem curta e a dica
  do "Mesclar com…".

```
┌ Assuntos que parecem iguais ───────────────┐
│ Direito Constitucional                      │
│  CREMERJ  Organização político-administr... │
│  OAB      Organização político-adm. do E... │
│  PGERJ    Organização político-adm. do E... │
│ 6 revisões pendentes passam a ser 2         │
│        [ Mesclar ]   Não são iguais         │
└─────────────────────────────────────────────┘
```

- **Aviso na Hoje**, acima das listas, quando há sugestões: "Encontramos N assuntos repetidos em planos diferentes"
  com o link para a tela. "Agora não" esconde o aviso neste aparelho por 7 dias (`localStorage`, chave
  `revisemais:...`, com try/catch).
- **No assunto (Plano)**, onde fica o histórico: "Mesclado com [OAB] …, [PGERJ] …" + "Desfazer mesclagem", e a ação
  "Mesclar com…", que abre uma busca por nome nos assuntos de todos os planos (inclusive o mesmo plano) para cobrir o
  que o algoritmo não acha ("Ponto 4").

### Testes

- Funções puras com testes em `src/lib/` (no estilo de `logica.test.ts`): agrupamento das revisões a fazer, regra de
  concluir (absorve, apaga, reconta; no prazo não mexe), adiar o grupo, escolha da raiz e limpeza na mesclagem, e as
  sugestões com os nomes reais dela (CREMERJ/OAB/PGERJ devem sair num grupo só; "Parte Geral" de Civil não pode casar
  com tópico comprido qualquer; par dispensado não volta; grupo sem dois estudos não é sugerido).
- `npm test`, `npx tsc -b`, `npm run build`, e `npm run navegar -- hoje,...` (celular, tablet, PC; claro e escuro) com
  dados de exemplo que tenham atrasos acumulados e um assunto repetido.

### Publicação

- A migração 0007 precisa ser aplicada no Supabase de produção (`xqojqdxbvndzftpbpdmy`) antes ou junto do deploy;
  pedir a confirmação do dono antes de aplicar.
- Commit + push para `main` e `claude/revisemais-inicial`, como manda o CLAUDE.md.
- Depois do deploy, conferir na conta dela que o cartão de atrasadas mostra 4 e que a sugestão do
  "Organização político-administrativa" aparece com os 3 planos.

## Decisões que tomei (o dono pode mudar)

- Revisões resolvidas pela revisão feita são **apagadas**, não marcadas como feitas, para não inflar os números.
- "Sem revisar há N dias" conta desde o último contato com o assunto (estudo ou revisão feita), não desde o vencimento.
- Sugestões só para grupos com revisões duplicadas (dois ou mais com estudo próprio).
- A raiz é o assunto com o estudo mais recente.
- Ao desfazer uma mesclagem, o ciclo de revisões pendentes fica com o grupo; o assunto que sai começa um ciclo novo
  quando for estudado de novo.
- Ao apagar um plano (ou disciplina, ou assunto) que faz parte de um grupo, os estudos e revisões passam para outro
  membro do grupo antes de apagar.
- Cada cartão de sugestão tem uma caixa por assunto, e cada grupo sugerido tem no máximo um assunto por plano.

## Deixado para quem constrói

- Nomes exatos de funções, componentes e textos, dentro do que está acima.
- Como o Painel de **um plano** conta a revisão de um grupo cujas revisões estão gravadas no assunto de outro plano
  (sugestão: conta para todos os planos que têm membro no grupo).
- Layout fino da tela de repetidos e da busca do "Mesclar com…", respeitando celular, tablet e PC.

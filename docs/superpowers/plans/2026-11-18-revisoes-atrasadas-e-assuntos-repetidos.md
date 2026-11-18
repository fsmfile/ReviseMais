# Revisões atrasadas sem acúmulo e assuntos repetidos — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um item por assunto nas revisões a fazer (uma revisão feita resolve as vencidas e reconta as seguintes) e mesclagem de assuntos repetidos entre planos, sugerida pelo app e confirmada pela pessoa.

**Architecture:** A lógica fica em funções puras testadas (`src/lib/revisoes.ts`, `src/lib/mesclagem.ts`, `src/lib/indices.ts`); o `store.tsx` só aplica no banco e no estado o que essas funções decidem. Grupos de assuntos mesclados usam a coluna `assuntos.mesclado_em` (aponta para a raiz); estudos e revisões continuam gravados no assunto onde aconteceram, e os índices enxergam o grupo inteiro por qualquer membro.

**Tech Stack:** React 18 + TypeScript + Vite, Vitest, Supabase (Postgres + RLS), modo local em `localStorage`, `scripts/navegar.mjs` (Edge/Chrome sem janela) para capturas.

**Spec:** `docs/superpowers/specs/2026-11-18-revisoes-atrasadas-e-assuntos-repetidos-design.md`

## Global Constraints

- Textos da interface e do código em português do Brasil, tratando por "você" (sem gênero).
- Ícones SVG de `src/components/Icone.tsx`, nunca emoji. Estilo novo em `src/repaginacao.css`.
- Hierarquia dos botões: uma ação principal por cartão (cheio), secundária em contorno, o resto como texto (`.fantasma`/`.link`).
- Chaves de `localStorage` com prefixo `revisemais:`, sempre dentro de try/catch.
- Intervalos fixos: 48h, 1 semana, 2 meses, 6 meses (`REVISOES` em `src/lib/datas.ts`); datas `YYYY-MM-DD` locais.
- O app funciona sem a migração 0007 (tabela nova em `OPCIONAIS`; coluna ausente = sem mesclagem) e no modo local.
- `npm test` e `npx tsc -b` passam antes de cada commit; `npm run navegar` antes de entregar mudança de tela.
- No Windows: `git config core.autocrlf false` (senão os testes de editais falham por CRLF).
- Commits em português, descritivos, no ramo atual; push só no fim (Task 6) para `main` e `claude/revisemais-inicial`.
- Migração no Supabase de produção (`xqojqdxbvndzftpbpdmy`) só com confirmação explícita do dono.

## Review Focus

1. Revisão marcada com "Feita em" anterior a hoje: absorve só as vencidas até essa data e reconta a partir dela (não de hoje). Teste na Task 1.
2. Grupo com duas sequências pendentes (estudo registrado sem substituir as pendentes, ou membros mesclados): uma revisão resolve as vencidas das duas e reconta as restantes. Teste na Task 1.
3. Assunto mesclado cujas revisões estão gravadas no assunto de outro plano: cronômetro, retorno do Advogando e "Registrar estudo" acham a revisão pendente do grupo (não começam ciclo novo). Teste na Task 2.
4. Apagar o plano que contém a raiz de um grupo: os outros planos mantêm estudos e revisões, e ninguém fica apontando para assunto apagado. Teste na Task 3.
5. `mesclado_em` apontando para assunto que não existe mais (modo local não tem FK): o assunto vale como raiz de si mesmo, sem quebrar. Teste na Task 1.

---

### Task 1: Revisões a fazer por grupo (lógica pura)

**Files:**
- Modify: `src/lib/types.ts` (campo novo em `Assunto`)
- Create: `src/lib/revisoes.ts`
- Test: `src/lib/revisoes.test.ts`

**Interfaces:**
- Produces:
  - `Assunto.mesclado_em?: string | null` — raiz do grupo; `null`/ausente = não mesclado ou é a raiz.
  - `raizDe(porId: Map<string, Assunto>, id: string): string` — `mesclado_em` se ele existir em `porId`; senão o próprio `id`.
  - `membrosDoGrupo(assuntos: Assunto[], id: string): string[]` — raiz primeiro, depois os membros na ordem do array; assunto sem grupo devolve `[id]`.
  - `interface ItemRevisao { raiz: string; revisao: Revisao; vencidas: Revisao[]; assuntos: string[]; ultimoContato: string | null; atrasada: boolean }`
  - `revisoesAFazer(d: Pick<Dados, 'assuntos' | 'estudos' | 'revisoes'>, ref: string, escopo?: Set<string>): ItemRevisao[]` — um item por raiz com ao menos uma pendente de `data_prevista <= ref`; `revisao` = a mais antiga dessas; `vencidas` = todas elas em ordem de data; `ultimoContato` = maior data entre `estudos.data` e `revisoes.concluida_em` de todos os membros; `atrasada` = `revisao.data_prevista < ref`; com `escopo`, só grupos com algum membro no conjunto. Ordenado por `revisao.data_prevista`.
  - `contarAFazer(d, ref, escopo?): { atrasadas: number; hoje: number; total: number }`
  - `interface MudancasRevisao { apagar: string[]; reagendar: { id: string; data_prevista: string }[] }`
  - `planoDeConclusao(r: Revisao, pendentesDoGrupo: Revisao[], concluidaEm: string): MudancasRevisao` — `apagar` = outras pendentes com `data_prevista <= concluidaEm`; se `concluidaEm > r.data_prevista`, `reagendar` = as pendentes restantes com a data do marco calculada a partir de `concluidaEm` (`REVISOES.find(tipo).calcular(concluidaEm)`); no prazo ou antes, `reagendar = []`.
  - `planoDeAdiamento(pendentesDoGrupo: Revisao[], ref: string, para: string): { id: string; data_prevista: string }[]` — toda pendente com `data_prevista <= ref` vai para `para`.

- [ ] **Step 1: Escrever os testes que falham** em `src/lib/revisoes.test.ts`. Fixture com o caso real: assunto `A` (estudo `eA` em `2026-11-03`; revisões `A48` 2026-11-05, `A7` 2026-11-10, `A2m` 2027-01-03, `A6m` 2027-05-03, todas pendentes).

```ts
it('um item por assunto, mesmo com 48h e 1 semana vencidas', () => {
  const l = revisoesAFazer(d, '2026-11-18');
  expect(l).toHaveLength(1);
  expect(l[0]).toMatchObject({ raiz: 'A', atrasada: true, ultimoContato: '2026-11-03' });
  expect(l[0].revisao.id).toBe('A48');
  expect(l[0].vencidas.map((r) => r.id)).toEqual(['A48', 'A7']);
  expect(contarAFazer(d, '2026-11-18')).toEqual({ atrasadas: 1, hoje: 0, total: 1 });
});
it('revisão atrasada apaga as vencidas e reconta as seguintes a partir do dia feito', () => {
  expect(planoDeConclusao(A48, pendentesA, '2026-11-18')).toEqual({
    apagar: ['A7'],
    reagendar: [{ id: 'A2m', data_prevista: '2027-01-18' }, { id: 'A6m', data_prevista: '2027-05-18' }],
  });
});
it('revisão no prazo não muda as outras', () => {
  expect(planoDeConclusao(A48, pendentesA, '2026-11-05')).toEqual({ apagar: [], reagendar: [] });
  expect(planoDeConclusao(A48, pendentesA, '2026-11-04')).toEqual({ apagar: [], reagendar: [] });
});
it('"Feita em" no passado: absorve até aquela data e reconta a partir dela', () => {
  expect(planoDeConclusao(A48, pendentesA, '2026-11-08')).toEqual({
    apagar: [],
    reagendar: [{ id: 'A7', data_prevista: '2026-11-15' }, { id: 'A2m', data_prevista: '2027-01-08' }, { id: 'A6m', data_prevista: '2027-05-08' }],
  });
});
it('grupo com duas sequências: uma revisão resolve as vencidas das duas', () => {
  // B mesclado em A; estudo eB em 2026-11-12: B48 2026-11-14, B7 2026-11-19, B2m 2027-01-12, B6m 2027-05-12
  const l = revisoesAFazer(dGrupo, '2026-11-18');
  expect(l).toHaveLength(1);
  expect(l[0].vencidas.map((r) => r.id)).toEqual(['A48', 'A7', 'B48']);
  expect(l[0].assuntos).toEqual(['A', 'B']);
  const m = planoDeConclusao(A48, pendentesAB, '2026-11-18');
  expect(m.apagar.sort()).toEqual(['A7', 'B48']);
  expect(m.reagendar).toContainEqual({ id: 'B7', data_prevista: '2026-11-25' });
  expect(m.reagendar).toContainEqual({ id: 'B2m', data_prevista: '2027-01-18' });
});
it('mesclado_em para assunto que não existe vale como raiz de si mesmo', () => {
  const porId = new Map([['C', { ...assuntoBase, id: 'C', mesclado_em: 'sumiu' }]]);
  expect(raizDe(porId, 'C')).toBe('C');
});
it('adiar leva todas as vencidas do grupo para amanhã', () => {
  expect(planoDeAdiamento(pendentesA, '2026-11-18', '2026-11-19')).toEqual([
    { id: 'A48', data_prevista: '2026-11-19' }, { id: 'A7', data_prevista: '2026-11-19' },
  ]);
});
it('escopo: só grupos com membro no conjunto', () => {
  expect(revisoesAFazer(dGrupo, '2026-11-18', new Set(['B']))).toHaveLength(1);
  expect(revisoesAFazer(dGrupo, '2026-11-18', new Set(['X']))).toHaveLength(0);
});
```

- [ ] **Step 2: Rodar e ver falhar.** `npx vitest run src/lib/revisoes.test.ts` → FAIL (módulo `./revisoes` não existe).
- [ ] **Step 3: Implementar** `mesclado_em?: string | null` em `Assunto` (`src/lib/types.ts`) e as funções acima em `src/lib/revisoes.ts`.
- [ ] **Step 4: Rodar e ver passar.** `npx vitest run src/lib/revisoes.test.ts` → PASS; `npx tsc -b` → sem erros.
- [ ] **Step 5: Commit** (inclui o desenho e este plano).

```bash
git add src/lib/types.ts src/lib/revisoes.ts src/lib/revisoes.test.ts docs/superpowers
git commit -m "Revisões a fazer por assunto: uma revisão feita resolve as vencidas e reconta as seguintes (lógica e testes)"
```

---

### Task 2: Ligar as revisões a fazer no app

**Files:**
- Create: `src/lib/indices.ts`, `src/lib/indices.test.ts`
- Modify: `src/lib/store.tsx` (`useIndices`, `concluirRevisao`, `registrarEstudo`, nova `adiarRevisoes`)
- Modify: `src/pages/Hoje.tsx`, `src/App.tsx:103`, `src/components/Mentor.tsx:35` e `:124`, `src/pages/Painel.tsx:120-131`, `src/pages/Advogando.tsx:93` e `:160`
- Modify: `scripts/navegar.mjs` (dados de exemplo e roteiro `hoje-revisei`)

**Interfaces:**
- Consumes: Task 1 (`revisoesAFazer`, `contarAFazer`, `membrosDoGrupo`, `raizDe`, `planoDeConclusao`, `planoDeAdiamento`).
- Produces:
  - `montarIndices(dados: Dados, correlacoes: MapaCorrelacoes): Indices` em `src/lib/indices.ts`, com tudo o que `useIndices` devolve hoje (`planos`, `disciplinas`, `assuntos`, `estudosPorAssunto`, `revisoesPorAssunto`, `contexto`, `fonteEstudo`, `idEfetivo`) mais `raiz(id): string` e `grupo(id): string[]`. `estudosPorAssunto` e `revisoesPorAssunto` juntam os registros de todos os membros e respondem pela mesma lista para **qualquer** membro do grupo. `useIndices()` passa a ser `useMemo(() => montarIndices(dados, correlacoes), ...)`. (Com isso o membro mesclado conta como estudado e `idEfetivo` devolve o próprio membro, que enxerga o grupo; equivale ao "devolve a raiz" do desenho.)
  - `acoes.concluirRevisao(id, patch)`: com `patch.concluida_em` nulo, igual a hoje (desmarcar). Senão grava `patch` na revisão e aplica `planoDeConclusao(r, pendentes do grupo de r.assunto_id, patch.concluida_em)` (excluir `apagar`, atualizar `reagendar`) no banco e no estado.
  - `acoes.adiarRevisoes(assuntoId: string, para: string)`: aplica `planoDeAdiamento(pendentes do grupo, hoje(), para)`.
  - `acoes.registrarEstudo`: com `substituirPendentes`, apaga as pendentes do **grupo** (`membrosDoGrupo`), não só do assunto.

- [ ] **Step 1: Teste que falha** em `src/lib/indices.test.ts`: assuntos `A` (plano 1) com estudo e revisões pendentes, `B` (plano 2, `mesclado_em: 'A'`) sem registros próprios.

```ts
const i = montarIndices(dados, calcularCorrelacoes(dados));
expect(i.revisoesPorAssunto.get('B')).toEqual(i.revisoesPorAssunto.get('A'));
expect(i.estudosPorAssunto.get('B')?.map((e) => e.id)).toEqual(['eA']);
expect(i.fonteEstudo('B')).toEqual({ id: 'B' });
expect(i.idEfetivo('B')).toBe('B');
expect(i.raiz('B')).toBe('A');
expect(i.grupo('B')).toEqual(['A', 'B']);
```

- [ ] **Step 2:** `npx vitest run src/lib/indices.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Extrair** o corpo do `useMemo` de `useIndices` (`store.tsx:409-443`) para `montarIndices` em `src/lib/indices.ts`, com o agrupamento acima.
- [ ] **Step 4:** `npx vitest run src/lib/indices.test.ts` → PASS.
- [ ] **Step 5: Store.** Implementar `concluirRevisao`, `adiarRevisoes` e o `substituirPendentes` por grupo como descrito em Interfaces. Todos os caminhos que concluem (Hoje, `Estudar.tsx:166`, `pages/Advogando.tsx:123`) já passam por `acoes.concluirRevisao`.
- [ ] **Step 6: Contadores.** `App.tsx:103` (título da aba) e os dois pontos do `Mentor.tsx` passam a usar `contarAFazer(dados, ref).total`. Em `Painel.tsx`, `paraHoje` e `atrasadas` vêm de `contarAFazer(dados, ref, planoId ? ids : undefined)` (`noPrazo`/`comAtraso` não mudam). Em `pages/Advogando.tsx:93` e `:160`, trocar o filtro por `assunto_id === …` por `revisoesPorAssunto.get(id)` (pendentes, ordenadas), para achar a revisão do grupo.
- [ ] **Step 7: Hoje.** `atrasadas` = itens com `atrasada`, `deHoje` = os demais, ambos de `revisoesAFazer(dados, ref)`. O item mostra uma etiqueta por plano do grupo (sem repetir plano), matéria e assunto da raiz, o rótulo da `revisao` e, se atrasado, `sem revisar há N dias` (N = `diasEntre(ultimoContato, ref)`; sem contato, usa `descreverPrazo` como hoje). "Revisei" abre `ConcluirRevisao` com `item.revisao`; "Adiar para amanhã" chama `acoes.adiarRevisoes(item.raiz, somarDias(ref, 1))`. "Próximos 7 dias" não repete a mesma raiz no mesmo dia.
- [ ] **Step 8: Dados de exemplo e roteiro.** Em `dadosExemplo()` de `scripts/navegar.mjs`, somar `estudar('p1-d1-a3', 12, 60, 0)` e `estudar('p2-d0-a2', 12, 70, 0)` ("Organização do Estado" na OAB e na PGE, cada um com 48h e 1 semana vencidas). Novo bloco `if (quer('hoje-revisei'))`, que começa regravando os dados de exemplo e recarregando (mesmo comando da linha 368, para não depender de blocos anteriores): ir para `#/hoje`, `nota('atrasadas (esperado 6)', <número do cartão .cartao-num.alerta strong>)`, `nota('itens atrasados (esperado 6)', <qtde de .lista-revisoes li.atrasada>)`, clicar no primeiro `.revisei`, clicar `.concluir button` com texto `Concluir`, `nota('atrasadas depois (esperado 5)', …)`, `foto('hoje-revisei', ap)`.
- [ ] **Step 9: Verificar.** `npm test` → PASS; `npx tsc -b` → sem erros; `npm run navegar -- hoje,painel,hoje-revisei` → `relatorio.txt` sem rolagem para o lado nem erro de console, e as notas com 6, 6 e 5. Conferir as fotos da Hoje em `capturas/` (celular, tablet, PC).
- [ ] **Step 10: Commit.**

```bash
git add src/lib/indices.ts src/lib/indices.test.ts src/lib/store.tsx src/pages/Hoje.tsx src/App.tsx src/components/Mentor.tsx src/pages/Painel.tsx src/pages/Advogando.tsx scripts/navegar.mjs
git commit -m "Hoje: um item por assunto nas atrasadas (sem revisar há N dias); revisar resolve as vencidas e reconta as seguintes; adiar leva o assunto inteiro"
```

---

### Task 3: Sugestões e planos de mesclagem (lógica pura)

**Files:**
- Modify: `src/lib/types.ts` (`ParDistinto`)
- Create: `src/lib/mesclagem.ts`
- Test: `src/lib/mesclagem.test.ts`

**Interfaces:**
- Consumes: `raizDe`, `membrosDoGrupo` (Task 1); `normalizar`, `tokens`, `similaridade`, `LIMIAR_ASSUNTO`, `MapaCorrelacoes` (`correlacao.ts`).
- Produces:
  - `interface ParDistinto { id: string; assunto_a: string; assunto_b: string }` (`assunto_a < assunto_b`).
  - `parecidos(a: string, b: string): number` — 1 se os nomes normalizados são iguais; senão o maior entre o Dice de `tokens` e `LIMIAR_ASSUNTO` quando as palavras do nome mais curto (com 3 ou mais palavras) estão todas no mais comprido; senão o Dice.
  - `interface SugestaoMesclagem { chave: string; disciplina: string; assuntos: string[]; pendentesAntes: number; pendentesDepois: number }` — `assuntos` na ordem dos planos; `chave` = ids ordenados unidos por `|`.
  - `sugerirMesclagens(d: Pick<Dados, 'planos' | 'disciplinas' | 'assuntos' | 'estudos' | 'revisoes'>, distintos: ParDistinto[], correlacoes: MapaCorrelacoes): SugestaoMesclagem[]` — pares de planos diferentes, em disciplinas equivalentes (mesmo nome normalizado ou `correlacoes.disciplinas`), com `parecidos >= LIMIAR_ASSUNTO`; une do maior score para o menor, tratando grupo já mesclado como uma unidade; recusa união que ponha dois assuntos do mesmo plano no grupo ou que junte unidades com algum par em `distintos`; só devolve grupo com 2 ou mais unidades que tenham estudo próprio.
  - `paresDistintos(ids: string[]): [string, string][]` — todos os pares, cada um ordenado.
  - `interface PlanoMesclagem { raiz: string; apontar: { id: string; mesclado_em: string | null }[]; apagarRevisoes: string[] }`
  - `planoDeMesclagem(d, ids: string[]): PlanoMesclagem` — junta os grupos inteiros dos `ids`; raiz = membro com o estudo mais recente (empate: menor `ordem` do plano); `apontar` só o que muda; `apagarRevisoes` = pendentes que não são do estudo mais recente entre os que têm pendentes.
  - `interface PlanoSeparacao { apontar: { id: string; mesclado_em: string | null }[]; moverEstudos: string[]; moverRevisoes: string[]; para: string | null; distintos: [string, string][] }`
  - `planoDeSeparacao(d, id: string): PlanoSeparacao` — tira `id` do grupo; se `id` era a raiz, a nova raiz segue a mesma regra de escolha; estudos de `id` que têm revisão pendente (e todas as revisões desses estudos) vão para a raiz que fica (`para`); `distintos` = pares de `id` com cada membro que fica.
  - `interface PlanoExclusao { apontar: { id: string; mesclado_em: string | null }[]; moverEstudos: { id: string; assunto_id: string }[]; moverRevisoes: { id: string; assunto_id: string }[] }`
  - `planoDeExclusao(d, saem: string[]): PlanoExclusao` — para cada grupo com membros que saem e membros que ficam: nova raiz entre os que ficam (se a raiz sai), reaponta os que ficam e move todos os estudos e revisões dos que saem para a raiz que fica.

- [ ] **Step 1: Testes que falham** em `src/lib/mesclagem.test.ts`, com os nomes reais (disciplina "Direito Constitucional" nos três; planos CREMERJ `ordem 0`, OAB `ordem 1`, PGERJ `ordem 2`; cada assunto com estudo em `2026-11-03` e revisões 2m `2027-01-03` e 6m `2027-05-03` pendentes):
  - CREMERJ: `Organização político-administrativa`
  - OAB: `Organização político-administrativa do Estado`
  - PGERJ: `Organização político-administrativa do Estado brasileiro. Repartição de competências e seus critérios. Competências político-administrativas, legislativas e tributárias. Autonomia dos entes federativos. Intervenção federal e estadual. Mecanismos de integração e de cooperação federativos: regiões, regiões metropolitanas, aglomerações urbanas e microrregiões`

```ts
it('junta os três planos numa sugestão só', () => {
  const s = sugerirMesclagens(d, [], calcularCorrelacoes(d));
  expect(s).toHaveLength(1);
  expect(s[0].assuntos).toEqual(['cremerj', 'oab', 'pgerj']);
  expect(s[0]).toMatchObject({ disciplina: 'Direito Constitucional', pendentesAntes: 6, pendentesDepois: 2 });
});
it('não sugere quando só um lado foi estudado', () => { /* sem estudo em oab e pgerj */ expect(sugerirMesclagens(dSoUm, [], c)).toEqual([]); });
it('par dispensado não volta', () => {
  const dist = paresDistintos(['cremerj', 'oab', 'pgerj']).map(([a, b], k) => ({ id: `x${k}`, assunto_a: a, assunto_b: b }));
  expect(sugerirMesclagens(d, dist, c)).toEqual([]);
});
it('nome curto não casa com tópico comprido qualquer', () => {
  expect(parecidos('Parte Geral', 'Parte geral do Código Civil: pessoas, bens, fatos jurídicos e prescrição')).toBeLessThan(LIMIAR_ASSUNTO);
});
it('no máximo um assunto por plano no grupo', () => { /* pgerj2 = mesmo nome do pgerj, mesmo plano, estudado */ expect(sugerirMesclagens(dDoisNaPgerj, [], c)[0].assuntos.filter((x) => x.startsWith('pgerj'))).toHaveLength(1); });
it('mesclar: raiz pelo estudo mais recente (empate: primeiro plano) e uma sequência pendente', () => {
  const p = planoDeMesclagem(d, ['cremerj', 'oab', 'pgerj']);
  expect(p.raiz).toBe('cremerj');
  expect(p.apontar).toEqual([{ id: 'oab', mesclado_em: 'cremerj' }, { id: 'pgerj', mesclado_em: 'cremerj' }]);
  expect(p.apagarRevisoes.sort()).toEqual(['oab-2m', 'oab-6m', 'pgerj-2m', 'pgerj-6m']);
});
it('apagar o plano da raiz passa os registros para outro membro', () => {
  const p = planoDeExclusao(dMesclado, ['cremerj']);
  expect(p.apontar).toEqual([{ id: 'oab', mesclado_em: null }, { id: 'pgerj', mesclado_em: 'oab' }]);
  expect(p.moverEstudos).toEqual([{ id: 'e-cremerj', assunto_id: 'oab' }]);
  expect(p.moverRevisoes.map((x) => x.assunto_id)).toEqual(['oab', 'oab']); // 2m e 6m do cremerj
});
it('separar: o ciclo pendente fica com o grupo', () => {
  const p = planoDeSeparacao(dMesclado, 'cremerj'); // cremerj é a raiz e guarda as pendentes
  expect(p.para).toBe('oab');
  expect(p.moverEstudos).toEqual(['e-cremerj']);
  expect(p.distintos).toEqual([['cremerj', 'oab'], ['cremerj', 'pgerj']]);
});
```

(`dMesclado` = `d` depois de aplicar o `planoDeMesclagem` acima.)

- [ ] **Step 2:** `npx vitest run src/lib/mesclagem.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar** `ParDistinto` em `types.ts` e as funções em `src/lib/mesclagem.ts`.
- [ ] **Step 4:** `npx vitest run src/lib/mesclagem.test.ts` → PASS; `npm test` → PASS.
- [ ] **Step 5: Conferir nos dados reais (somente leitura).** Script no diretório temporário da sessão, rodado como os do Monitor (`node --use-system-ca --env-file=../../Advogando/AdvogandoGame/.env node_modules/vite-node/vite-node.mjs <script>`), que lê `planos`, `disciplinas`, `assuntos`, `estudos`, `revisoes` de cada usuário pela `sql()` de `scripts/monitor/api.ts` e imprime `sugerirMesclagens(...)` (só nomes de plano e assunto, sem e-mail). Esperado: a conta `cd93ce91…` com exatamente 1 sugestão (os três "Organização político-administrativa"); as demais sem sugestão. Se sair diferente, ajustar a regra e voltar ao Step 4.
- [ ] **Step 6: Commit.**

```bash
git add src/lib/types.ts src/lib/mesclagem.ts src/lib/mesclagem.test.ts
git commit -m "Assuntos repetidos entre planos: sugestões (nome parecido ou contido), mesclar, separar e apagar sem perder o ciclo (lógica e testes)"
```

---

### Task 4: Banco e ações de mesclagem

**Files:**
- Create: `supabase/migrations/0007_assuntos_mesclados.sql`
- Modify: `src/lib/types.ts` (`Dados.assuntos_distintos`), `src/lib/backend.ts` (`TABELAS`, `OPCIONAIS`, padrão do modo local), `src/lib/store.tsx` (`VAZIO`, `remover`, ações novas, exclusões), `src/lib/advogando.test.ts:57` (Dados de teste)

**Interfaces:**
- Consumes: Task 3 (`planoDeMesclagem`, `planoDeSeparacao`, `planoDeExclusao`, `paresDistintos`, `sugerirMesclagens`, `ParDistinto`, `SugestaoMesclagem`).
- Produces:
  - `Dados.assuntos_distintos: ParDistinto[]` (nome da chave = nome da tabela).
  - `acoes.mesclarAssuntos(ids: string[], deixarDeFora?: string[]): Promise<void>` — aplica `planoDeMesclagem(dados, ids)` (atualiza `mesclado_em`, apaga revisões) e grava como distintos os pares de cada `deixarDeFora` com cada `ids`.
  - `acoes.separarAssunto(id: string): Promise<void>` — aplica `planoDeSeparacao` (reaponta, atualiza `assunto_id` dos estudos e revisões movidos para `para`, grava `distintos`).
  - `acoes.dispensarSugestao(ids: string[]): Promise<void>` — grava `paresDistintos(ids)` que ainda não existem.
  - `useSugestoesMesclagem(): SugestaoMesclagem[]` (exportado de `store.tsx`) — `sugerirMesclagens(dados, dados.assuntos_distintos, correlacoes)` memorizado.
  - `excluirPlano`, `excluirDisciplina`, `excluirAssuntosDaDisciplina` e `excluirAssunto` aplicam antes `planoDeExclusao(dados, idsDosAssuntosQueSaem)`; os estudos e revisões movidos saem da lista que `remover` apaga.

- [ ] **Step 1: Migração** `supabase/migrations/0007_assuntos_mesclados.sql`:

```sql
-- Assuntos repetidos entre planos (18/11/2026): mesclar e "não são iguais".
alter table public.assuntos add column if not exists mesclado_em uuid references public.assuntos(id) on delete set null;
create index if not exists assuntos_mesclado_idx on public.assuntos(mesclado_em);

create table if not exists public.assuntos_distintos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assunto_a uuid not null references public.assuntos(id) on delete cascade,
  assunto_b uuid not null references public.assuntos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (assunto_a, assunto_b)
);
alter table public.assuntos_distintos enable row level security;
drop policy if exists "dono" on public.assuntos_distintos;
create policy "dono" on public.assuntos_distintos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
```

- [ ] **Step 2: Tipos e backend.** `Dados.assuntos_distintos`; `'assuntos_distintos'` em `TABELAS` e em `OPCIONAIS`; `backendLocal.ler` devolve `{ sessoes: [], assuntos_distintos: [], ...j }` e o vazio também com `assuntos_distintos: []`; `VAZIO` do store idem; `remover` também tira do estado os pares que citam assunto apagado; `advogando.test.ts:57` ganha `assuntos_distintos: []`.
- [ ] **Step 3: Ações** `mesclarAssuntos`, `separarAssunto`, `dispensarSugestao`, `useSugestoesMesclagem` e a transferência nas quatro exclusões, como em Interfaces. Banco primeiro, estado depois (padrão do arquivo).
- [ ] **Step 4: Verificar.** `npx tsc -b` → sem erros; `npm test` → PASS; `npm run build` → OK.
- [ ] **Step 5: Commit.**

```bash
git add supabase/migrations/0007_assuntos_mesclados.sql src/lib/types.ts src/lib/backend.ts src/lib/store.tsx src/lib/advogando.test.ts
git commit -m "Mesclar assuntos: migração 0007 (mesclado_em e assuntos_distintos) e ações de mesclar, separar, dispensar e apagar sem perder o ciclo"
```

---

### Task 5: Telas de assuntos repetidos

**Files:**
- Create: `src/pages/Repetidos.tsx`, `src/components/AvisoRepetidos.tsx`, `src/components/MesclarCom.tsx`
- Modify: `src/lib/rota.ts` (`{ tela: 'repetidos' }`), `src/App.tsx` (rota e menu), `src/components/Icone.tsx` (ícone `mesclar`), `src/pages/Hoje.tsx` (aviso), `src/pages/Plano.tsx:422-450` (menu do assunto), `src/components/HistoricoAssunto.tsx` (nota do grupo), `src/repaginacao.css`, `scripts/navegar.mjs`, `CLAUDE.md`

**Interfaces:**
- Consumes: Task 4 (`useSugestoesMesclagem`, `acoes.mesclarAssuntos`, `acoes.dispensarSugestao`, `acoes.separarAssunto`), Task 2 (`useIndices().grupo`, `contexto`).

- [ ] **Step 1: Rota e menu.** `'repetidos'` em `Rota` e no `switch` de `rota.ts`; em `App.tsx`, item `{ rota: { tela: 'repetidos' }, icone: 'mesclar', rotulo: 'Assuntos repetidos' }` em `FERRAMENTAS` logo depois de "Comparar editais", na seção "Planos e editais" do Mais e na lateral; render `<Repetidos />`. Ícone `mesclar` (duas setas que se juntam) no padrão de `Icone.tsx`.
- [ ] **Step 2: `Repetidos`.** Título "Assuntos repetidos" e uma linha explicando ("Assuntos que parecem iguais em planos diferentes. Mesclados, eles têm um estudo e uma sequência de revisões só."). Um cartão por sugestão, conforme o desenho: disciplina, uma linha por assunto (caixa de marcar, todas marcadas; etiqueta do plano; nome cortado com o completo no `title`), "N revisões pendentes passam a ser M", botão principal "Mesclar" (desabilitado com menos de 2 marcados; chama `mesclarAssuntos(marcados, desmarcados)`) e "Não são iguais" como texto (`dispensarSugestao(assuntos)`). Sem sugestões: "Nenhum assunto repetido por aqui." + a dica de "Mesclar com…" no menu do assunto.
- [ ] **Step 3: `AvisoRepetidos`** no topo da `.hoje-principal`, só com sugestões e fora do adiamento: "Encontramos N assunto(s) repetido(s) em planos diferentes." + link "Ver" para `#/repetidos` + "Agora não" (grava `revisemais:repetidos-adiado-ate` = hoje + 7 dias; leitura e gravação em try/catch).
- [ ] **Step 4: Menu do assunto (Plano).** Itens novos: "Mesclar com…" (abre `MesclarCom`) e, se `grupo(a.id).length > 1`, "Desfazer mesclagem" com `confirm('Separar este assunto dos outros planos? As revisões pendentes ficam com os outros.')` → `separarAssunto(a.id)`. `MesclarCom` (usa o `Modal` existente): campo de busca; lista de assuntos de todos os planos (inclusive o mesmo), fora os do próprio grupo, filtrada por `normalizar(nome).includes(normalizar(busca))`, no máximo 50, mostrando plano › disciplina › assunto; tocar num item confirma ("Mesclar X com Y?") e chama `mesclarAssuntos([a.id, outro.id])`.
- [ ] **Step 5: HistoricoAssunto.** Com grupo de 2 ou mais: nota "Mesclado com [plano] assunto, …; estudo e revisões valem para todos." (mesmo estilo de `.nota-compartilhado`). O botão "Estudei de novo" da linha já cobre o "Registrar estudo" do assunto separado.
- [ ] **Step 6: Capturas.** Em `TELAS` de `navegar.mjs`, `['repetidos', '#/repetidos']`. Bloco `if (quer('mesclar'))`, que também começa regravando os dados de exemplo e recarregando: `#/repetidos` → `nota('sugestões (esperado 1)', <qtde de cartões>)`, clicar "Mesclar", ir a `#/hoje` → `nota('atrasadas depois de mesclar (esperado 5)', …)`, `foto('hoje-mesclado', ap)`; depois `#/repetidos` → `nota('sugestões depois (esperado 0)', …)`.
- [ ] **Step 7: CLAUDE.md.** Seção curta "Revisões a fazer e assuntos repetidos": um item por assunto/grupo (`src/lib/revisoes.ts`), revisão feita apaga as vencidas e reconta (`planoDeConclusao`), mesclagem por `assuntos.mesclado_em` + `assuntos_distintos` (migração 0007, `src/lib/mesclagem.ts`), índices por grupo (`src/lib/indices.ts`), tela `#/repetidos`.
- [ ] **Step 8: Verificar.** `npx tsc -b`; `npm test` → PASS; `npm run navegar -- hoje,plano,repetidos,menu,plano-aberto,hoje-revisei,mesclar` e `npm run navegar -- hoje,repetidos -- --escuro` → `relatorio.txt` sem rolagem para o lado nem erro de console; notas 1, 5 e 0. Olhar as fotos de celular, tablet e PC.
- [ ] **Step 9: Commit.**

```bash
git add src scripts/navegar.mjs CLAUDE.md
git commit -m "Assuntos repetidos: tela de sugestões (mesclar ou não são iguais), aviso na Hoje, Mesclar com… e Desfazer no assunto"
```

---

### Task 6: Publicar e conferir na conta dela

**Files:** nenhum arquivo novo no repositório (scripts de conferência ficam no diretório temporário da sessão).

- [ ] **Step 1: Pedir a confirmação do dono** para aplicar a migração 0007 no Supabase de produção. Sem confirmação, parar aqui.
- [ ] **Step 2: Aplicar** a migração pela `sql()` de `scripts/monitor/api.ts` (mesmo comando do Task 3 Step 5, lendo o arquivo `.sql`). Conferir: `select column_name from information_schema.columns where table_name='assuntos' and column_name='mesclado_em'` → 1 linha; `select count(*) from assuntos_distintos` → 0.
- [ ] **Step 3: Publicar.** `npm test`, `npx tsc -b`, `npm run build` passando; `git push origin HEAD:main HEAD:claude/revisemais-inicial`. Esperar o deploy da Vercel e conferir no rodapé de https://estudemais-wheat.vercel.app que a versão é o último commit.
- [ ] **Step 4: Conferir a conta dela (somente leitura).** Script com os dados reais: `contarAFazer(dados, hoje)` deve dar 4 atrasadas (eram 8 revisões), e `sugerirMesclagens` deve trazer o grupo dos três "Organização político-administrativa". Dizer ao dono o que não foi conferido (por exemplo, a tela no aparelho dela).

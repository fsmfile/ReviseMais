# Editais de referência (memória do leitor de editais)

Cada pasta aqui é um edital real que o ReviseMais já sabe ler. Os testes (`npm test`) releem **todos**
e comparam com o resultado esperado — assim, ensinar um formato novo nunca quebra os anteriores.

Cada pasta tem:

| Arquivo | Conteúdo |
|---|---|
| `texto.txt` | Texto extraído do PDF exatamente como o app extrai (páginas separadas por `\f`). |
| `esperado.json` | Resultado completo do leitor (recorte, cargos, disciplinas e nº de assuntos). |
| `meta.json` | Órgão, banca, ano, **descrição do formato** e cargos **conferidos à mão** contra o PDF. |

## Formatos catalogados

| ID | Órgão / banca | Formato | Situação |
|---|---|---|---|
| `cremerj-2026-consulplan` | CREMERJ · Consulplan · 2026 | Edital completo; conteúdo no Anexo I; 4 grupos (“Cargos/especialidades do QUADRO I–IV”) com Conhecimentos Básicos comuns e Específicos com título por cargo; numeração estilo Cebraspe | ✅ 22 cargos; jurídicos conferidos |
| `seplag-rj-2026-fgv` | SEPLAG/RJ · FGV · 2026 | Edital completo; Anexo I começa com “COMUM PARA TODAS AS ÁREAS”; dois níveis “CARGO: …” → “ÁREA: …” (nome do cargo quebrado em 2 linhas); disciplinas em maiúsculas; assuntos sem numeração separados por “;” | ✅ 4 opções (cargo – área); comuns conferidas |

### Formatos simulados (sem edital real ainda)

Montados a partir da estrutura usual de cada banca, em `src/lib/formatos.test.ts`. Quando chegar um edital real
da banca, ele entra na tabela acima e confirma (ou corrige) a regra.

| Banca | Padrão simulado |
|---|---|
| Cebraspe | Conteúdo dentro de um item do edital (“14 DOS CONHECIMENTOS A SEREM AVALIADOS”), terminando no item seguinte; subitens do edital (“14.2.1 Nas provas…”) ignorados; “CONHECIMENTOS BÁSICOS PARA TODOS OS CARGOS”; “CARGO 1: ANALISTA JUDICIÁRIO – ÁREA: JUDICIÁRIA”; “DISCIPLINA: 1 … 1.1 …” |
| Vunesp | Disciplina em linha própria sem dois-pontos (“Língua Portuguesa”); assuntos em frases; cargos em maiúsculas (“ESCREVENTE TÉCNICO JUDICIÁRIO”) sem lista prévia |
| FCC | “Disciplina: assunto. assunto.”; subitens em minúsculas após “Tópico:” e “;” mantidos no mesmo assunto; cargos em maiúsculas sem lista prévia |

## Formatos que o leitor já entende

- **Onde começa o conteúdo:** título “Conteúdo Programático”, “Objetos de Avaliação”, “Programa das Provas”… em linha própria
  (menções no índice/corpo do edital são ignoradas). Termina no anexo seguinte (“ANEXO II”).
- **Cabeçalhos/rodapés de página:** removidos só quando repetidos no topo/rodapé das páginas.
- **Disciplinas:** maiúsculas com dois-pontos (`DIREITO PENAL: 1 ...`), maiúsculas em linha própria, ou nome conhecido em
  formato título (`Direito Penal: ...`, `I - Conhecimentos de Direito Administrativo: ...`).
- **Assuntos:** numerados (1, 1.1, 1.1.1 — valida a sequência para não confundir com “Lei nº 8.112”) ou frases separadas por ponto
  e por “;”. O “;” não separa: subitens em minúscula de um tópico com dois-pontos (“Segurança da informação: noções de X; noções
  de Y”) nem listas de artigos (“artigos 293 a 305; 307; 308”). Primeira letra do assunto em maiúscula.
- **Cargo → Área/Especialidade/Ênfase:** cada área vira uma opção (“Cargo – Área”).
- **Vários cargos:** blocos “Cargo(s)/especialidade(s) …” / “QUADRO …” / “CARGO N: …”; básicos do grupo + títulos de cargo nos
  específicos; sem blocos, títulos de cargo em maiúsculas (ANALISTA…, TÉCNICO…, ESCREVENTE…). Matérias antes do primeiro
  cargo (“para todos os cargos”) entram em todos.
- **Disciplinas sem dois-pontos** em linha própria quando o nome é de disciplina conhecida (Direito…, Língua…, Noções de…).

## Como ensinar um edital novo

Veja o passo a passo em [`../CLAUDE.md`](../CLAUDE.md).

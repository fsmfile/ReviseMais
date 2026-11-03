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
| `trf3-2026-vunesp` | TRF3 (JFSP/JFMS) · Vunesp · 2026 | Edital completo, Anexo VI; grupos “Para os cargos de A, B e C:” com Conhecimentos Gerais/Específicos; título de cargo em letras mistas com “Especialidade:” quebrado em 2 linhas; “Direito Civil: assunto. assunto.” | ✅ 8 cargos; JFMS conferido |
| `contagem-mg-2026-anexo-iv` | Município de Contagem/MG · IBGP · 2026 | Só o Anexo IV (retificação); níveis “ENSINO MÉDIO…”/“ENSINO SUPERIOR…” com comuns; cargo “301 - NOME”; trechos riscados + “(Revogado)” | ✅ 36 cargos; aviso de revogados |
| `saquarema-rj-2026-educacao-anexo-iii` | Prefeitura de Saquarema/RJ · 2026 (Educação) | Só o Anexo III; níveis com “➢”; “Matéria para (todos) os cargos de …” em até 3 linhas; cargos em maiúsculas; itens “1. … 2. …” | ✅ 6 cargos |
| `oab-2026-texto-ia` | OAB 1ª fase · FGV (texto escrito por IA, sem PDF) | Introdução solta; “1. Disciplina (8 questões)” seguida de itens “ * assunto” | ✅ 20 disciplinas pelo leitor de listas |
| `oab-2026-texto-ia-so-disciplinas` | OAB · FGV (resposta de IA ao prompt do app, copiada sem “#”) | Grupo de nomes de disciplina vira disciplinas; disciplina com item igual ao nome fica sem assuntos → aviso + pedido de detalhamento | ✅ 20 disciplinas |
| `oab-2026-agente-ia` | OAB · FGV (agente de IA respondendo ao prompt do app; versão copiada sem “#”, marcadores “•”) | Formato do prompt; subitens pelo recuo; título que já é disciplina não é desmembrado | ✅ 15 disciplinas (a IA omitiu algumas) |
| `oab-2026-agente-ia-20` | OAB · FGV (agente de IA, prompt em duas etapas com nº informado = 20) | Linha de controle “Disciplinas (20): …” + seções “##”; app confere e completa as faltantes | ✅ 20 de 20 |
| `pge-rj-2026-residencia-juridica` | PGE-RJ · banca própria · 2026 (Residência Jurídica) | Páginas do Diário Oficial com outros atos; **sem conteúdo programático**: só cita “4 disciplinas avaliadas” e remete ao “programa anexo à Resolução PGE nº 5463” | ✅ plano nasce com as 4 disciplinas + aviso |
| `pge-rj-2026-residencia-juridica-programa` | PGE-RJ · Resolução PGE nº 5463/2026 (Regulamento) | Diário Oficial; “ANEXO” / “PROGRAMA”; “1. DIREITO CONSTITUCIONAL”; **Ponto 1…10** com itens **a) b) c)**; fim na marca “Id: …” do ato | ✅ 4 disciplinas, 139 assuntos conferidos |

### Formatos simulados (sem edital real ainda)

Montados a partir da estrutura usual de cada banca, em `src/lib/formatos.test.ts`. Quando chegar um edital real
da banca, ele entra na tabela acima e confirma (ou corrige) a regra.

| Banca | Padrão simulado |
|---|---|
| Cebraspe | Conteúdo dentro de um item do edital (“14 DOS CONHECIMENTOS A SEREM AVALIADOS”), terminando no item seguinte; subitens do edital (“14.2.1 Nas provas…”) ignorados; “CONHECIMENTOS BÁSICOS PARA TODOS OS CARGOS”; “CARGO 1: ANALISTA JUDICIÁRIO – ÁREA: JUDICIÁRIA”; “DISCIPLINA: 1 … 1.1 …” |
| Vunesp | (o edital real do TRF3 usa “Disciplina: …”; esta simulação cobre o outro formato comum) Disciplina em linha própria sem dois-pontos (“Língua Portuguesa”); assuntos em frases; cargos em maiúsculas (“ESCREVENTE TÉCNICO JUDICIÁRIO”) sem lista prévia |
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
- **Programa em pontos** (exames jurídicos): “Ponto N” vira assunto e os itens “a)”, “b)” viram subitens (código “Na”).
- **Edital sem conteúdo programático:** usa as disciplinas citadas (“disciplinas avaliadas: A, B e C”) e avisa qual documento
  traz o programa; importar esse documento depois junta os assuntos nas disciplinas que já existem no plano.
- **Diário Oficial:** “PROGRAMA” sozinho na linha também abre o conteúdo; a marca do ato (“Id: 2767243”) e a assinatura
  digital da página encerram.
- **Listas / Markdown (respostas de IA):** “## Disciplina” ou “1. Disciplina (8 questões)” seguidas de itens “- …”/“* …”
  (subitens pelo recuo). É o formato pedido pelo botão **🤖 Gerar com IA** (`src/lib/promptIA.ts`).
- **Grupos “Para os cargos de A, B e C:”**, níveis de ensino (“ENSINO …”, “➢ …”) e cargos com código (“301 - NOME”).
- **Títulos “Matéria para (todos) os cargos de …”** (nome = antes de “para”), inclusive continuando na linha seguinte.
- **Retificações:** “(Revogado)” marca o assunto anterior com “⚠ revogado” (o risco do PDF não vem no texto).
- **Data da prova:** “realização/aplicação da(s) prova(s) … DATA” (cronograma) ou “as provas serão realizadas no dia …”,
  ignorando locais/orientações/divulgação; sem data no edital, o campo fica vazio.
- **Nome do plano:** órgão (sigla, ou Cidade/UF), ano do número do edital e cargo/programa — `src/lib/identificacao.ts`.
- **Vários cargos:** blocos “Cargo(s)/especialidade(s) …” / “QUADRO …” / “CARGO N: …”; básicos do grupo + títulos de cargo nos
  específicos; sem blocos, títulos de cargo em maiúsculas (ANALISTA…, TÉCNICO…, ESCREVENTE…). Matérias antes do primeiro
  cargo (“para todos os cargos”) entram em todos.
- **Disciplinas sem dois-pontos** em linha própria quando o nome é de disciplina conhecida (Direito…, Língua…, Noções de…).

## Como ensinar um edital novo

Veja o passo a passo em [`../CLAUDE.md`](../CLAUDE.md).

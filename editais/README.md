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

## Formatos que o leitor já entende

- **Onde começa o conteúdo:** título “Conteúdo Programático”, “Objetos de Avaliação”, “Programa das Provas”… em linha própria
  (menções no índice/corpo do edital são ignoradas). Termina no anexo seguinte (“ANEXO II”).
- **Cabeçalhos/rodapés de página:** removidos só quando repetidos no topo/rodapé das páginas.
- **Disciplinas:** maiúsculas com dois-pontos (`DIREITO PENAL: 1 ...`), maiúsculas em linha própria, ou nome conhecido em
  formato título (`Direito Penal: ...`, `I - Conhecimentos de Direito Administrativo: ...`).
- **Assuntos:** numerados (1, 1.1, 1.1.1 — valida a sequência para não confundir com “Lei nº 8.112”) ou frases separadas por ponto/ponto e vírgula.
- **Vários cargos:** blocos “Cargo(s)/especialidade(s) …” / “QUADRO …”; básicos do grupo + títulos de cargo nos específicos.

## Como ensinar um edital novo

Veja o passo a passo em [`../CLAUDE.md`](../CLAUDE.md).

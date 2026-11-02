# EstudeMais (repositório ReviseMais) — instruções para o Claude

App (PWA) **EstudeMais** (antigo ReviseMais) de estudos para concursos jurídicos: React + TypeScript + Vite, Supabase (login/dados), publicado na Vercel
(projeto `revisemaisconcursos`, endereço atual https://estudemais-wheat.vercel.app; o antigo revisemaisconcursos.vercel.app pode continuar ativo) a partir do ramo **`main`** deste repositório.
Textos da interface e do código em português do Brasil. O nome exibido é "EstudeMais" (ícone: M em destaque com selo "+");
as chaves internas (`revisemais:*` no localStorage, UIDs do calendário) continuam com o nome antigo para não perder dados.

## Publicação

- A Vercel publica o ramo `main`. Todo trabalho concluído deve ser enviado ao `main` (e ao `claude/revisemais-inicial`,
  que acompanha o `main`): `git push origin HEAD:main HEAD:claude/revisemais-inicial`.
- O rodapé do app mostra a versão publicada (commit). Se o usuário relatar comportamento antigo, peça a versão do rodapé
  e compare com o último commit do `main` antes de investigar o código.
- Atenção: na primeira importação a Vercel tinha criado uma cópia do projeto (`fsmfile/revisemaisconcursos`) e publicava
  dela; o projeto foi religado a este repositório. Não atualize a cópia.

## Comandos

- `npm test` — testes (lógica + **todos os editais de referência**). Precisa passar antes de qualquer commit.
- `npx tsc -b` — checagem de tipos. `npm run build` — build de produção.
- `npm run edital -- arquivo.pdf` — mostra como o leitor interpreta um edital (cargos, disciplinas, nº de assuntos).

## Memória de editais — procedimento obrigatório a cada edital novo

O usuário vai enviar editais de formatos diferentes. Cada um deve virar parte permanente da memória do leitor
(`editais/`), para o app aprender a ler mais formatos sem desaprender os anteriores:

1. **Analisar:** `npm run edital -- <pdf>` e comparar com o PDF (leia as páginas do conteúdo programático).
   Veja se o recorte começa/termina no lugar certo, se os cargos aparecem, se as disciplinas e os assuntos batem.
2. **Guardar:** `npm run edital -- <pdf> --salvar <orgao-ano-banca>` (ex.: `tjsp-2026-vunesp`).
3. **Documentar o formato** em `editais/<id>/meta.json` (`formato`: onde fica o conteúdo, cabeçalhos, como os cargos
   e as disciplinas aparecem, numeração, armadilhas) e em `conferido` registrar, **conferido à mão contra o PDF**, o
   nº de assuntos de cada disciplina de ao menos um cargo (priorize os cargos jurídicos). Acrescente uma linha na
   tabela de `editais/README.md`. Registre também `nomeSugerido` (nome do plano que o app deve sugerir: sigla do órgão + ano,
   ou + programa quando não há cargo; ver `src/lib/identificacao.ts`).
4. **Melhorar o leitor** (`src/lib/editalParser.ts`) até o novo edital sair correto. Prefira regras gerais a casos
   específicos de um órgão. Se um caso típico estiver faltando, acrescente um teste pequeno em `src/lib/logica.test.ts`.
5. **Não quebrar os anteriores:** `npm test`. Se o `esperado.json` de um edital antigo mudou, confira se a mudança é
   uma melhoria (nunca pode piorar um `conferido`). Sendo melhoria: `npm run edital -- --id <id> --atualizar`.
   Por fim, `npm run edital -- --id <novo> --atualizar` para gravar o resultado final do edital novo.
6. **Testar no app** (Playwright, tela de celular 390px) importando o PDF por “+ Novo plano”, e depois commit + push.

Os PDFs recebidos ficam fora do repositório; guarde só o `texto.txt` extraído.

Formatos de banca ainda sem edital real estão **simulados** em `src/lib/formatos.test.ts` (Cebraspe, Vunesp, FCC).
Quando chegar um edital real dessas bancas, ele tem prioridade: se divergir da simulação, ajuste a simulação.
Para comparar o resultado novo com o guardado de um edital antigo, liste as diferenças por cargo antes de rodar `--atualizar`.

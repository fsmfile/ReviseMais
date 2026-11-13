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

- `npm run navegar` — abre o app num navegador sem janela (Edge/Chrome instalado), com dados de exemplo em modo local, e fotografa
  cada tela em celular (390), tablet (820) e PC (1440) em `capturas/`; o `relatorio.txt` acusa rolagem para o lado e erros de
  console. `-- hoje,plano` limita as telas; `-- --escuro` usa o tema escuro. **Rode antes de entregar mudança de tela.**

## Visual e navegação

- Celular e tablet (até 1023px): marca + planos no topo e **barra inferior** (Hoje, Painel, Estudar, Tempo, Mais).
  PC (1024px ou mais): **menu fixo na lateral** com tudo à vista. A troca é feita em `Estrutura` (`src/App.tsx`, `useTelaLarga`).
- `src/repaginacao.css` é carregado depois de `src/styles.css` e prevalece: estilo novo entra nele.
- Ícones são SVG (`src/components/Icone.tsx`), não emojis, para ficarem iguais em todo aparelho.
- Hierarquia dos botões: uma ação principal por cartão (cheio), a secundária em contorno claro, o resto como texto (`.fantasma`).

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
   ou + programa quando não há cargo; ver `src/lib/identificacao.ts`) e `dataProva` (YYYY-MM-DD conferida no PDF, ou null
   se o edital não informa).
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

## Ponte com o Advogando

O EstudeMais e o Advogando (repositório `fsmfile/AdvogandoGame`, simulador de advogado, https://advogandogame.fsmfile.workers.dev)
se completam sem virar um app só. O documento completo é o `docs/ECOSSISTEMA.md` do Advogando. Aqui:

- `src/lib/advogando.ts`: catálogo dos casos, ligação assunto → casos, links de ida e volta, "comprovado" (registro com
  observação começando por `Advogando ·`, a partir de 60%) e o foco do plano (casos que viram os próximos clientes de lá).
- `src/lib/advogando-catalogo.json`: cópia do catálogo (o app busca a versão publicada em `<advogando>/catalogo.json`).
  Para atualizar, no repositório do Advogando: `npx vite-node scripts/gerar-catalogo.ts -- --saida <este repo>/src/lib/advogando-catalogo.json`.
- `src/pages/Advogando.tsx` (rota `#/advogando?...`): recebe o resultado do caso e registra no assunto.
- `src/components/Advogando.tsx`: "⚖ Provar no escritório" (Hoje), chip de clientes e selo (Plano), "Estudado × comprovado" (Painel).
- Para testar os dois juntos no computador: `VITE_ADVOGANDO_URL=http://localhost:<porta do Advogando>/ npm run dev`.
- No Windows, com `core.autocrlf=true`, os testes dos editais falham por causa do fim de linha (CRLF) dos `texto.txt`.
  Use `git config core.autocrlf false` e baixe os editais de novo.

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

## Supabase (troca de projeto em 13/11/2026)

- Projeto atual: `xqojqdxbvndzftpbpdmy` (organização EleveSystem), com as migrações 0001 a 0005. Endereço e chave pública
  em `.env.production` e no `api/calendario.ts`.
- O projeto antigo `haknwtvxvlgxagfvzkny` só é **lido**: na primeira entrada de cada pessoa, `src/lib/migracaoAntiga.ts`
  confere o e-mail e a senha lá, cria a conta no novo com a mesma senha e traz os dados dela (planos, matérias, assuntos,
  estudos, revisões, sessões, calendário, modo integrado, progresso do Advogando e PDFs). O `user_id` muda; os ids das
  linhas e o token do calendário continuam. **Não apague o projeto antigo** até todos terem entrado e a conferência ser
  feita pelo script `../migracao-supabase/migrar.mjs` (fora do repositório; ver o LEIA-ME de lá).
- O projeto novo cria a conta sem confirmação de e-mail (necessário para essa troca). Os e-mails de "esqueci a senha" usam
  o servidor padrão do Supabase, que só entrega para membros da organização.
- `VITE_MANUTENCAO=1` no build mostra só a tela de manutenção (`src/pages/Manutencao.tsx`), sem falar com o banco.

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

## Mentor de foco (cobrança opcional)

A pessoa escolhe se quer ser cobrada e por quem: Ninguém, Parceiro (😄, fala depois de 12 min fora), Exigente (🧐, 6 min)
ou Linha-dura (😤, 3 min). Pausas curtas (água, café) passam sem comentário. A tela é a rota `#/foco` (menu › Mentor de foco).

- `src/lib/foco/falas.ts`: as falas. **O app não usa IA**: cada fala junta abertura + recado + lembrete (revisões de hoje,
  cliente do Advogando, tempo de hoje) + fecho, por nível, sem repetir as últimas 60 escolhas. Ao escrever fala nova:
  trate por "você" (sem gênero), não acuse de algo que o app não sabe (no navegador ele só sabe que a pessoa SAIU do app)
  e cuide da concordância com a matéria ("Direito Civil" é masculino). O teste `foco.test.ts` pega {variável} sem valor.
- `src/lib/foco/mentor.ts`: níveis, configuração, saídas registradas e placar. `src/components/Mentor.tsx`: percebe a saída
  e a volta (evento `visibilitychange`; a saída fica gravada, então funciona mesmo se o celular fechar a página), pergunta
  "onde você estava?", desconta do cronômetro o que não era estudo (com "Não descontar") e lembra das pausas longas.
- Pausa para almoço (11h às 15h) e janta (18h às 22h) aparecem na tela do cronômetro só nesses horários; durante elas o
  mentor fica quieto (`cronometro.pausarParaRefeicao`).
- Notificação com o app em segundo plano: só funciona no computador (outra aba ou janela). No celular o sistema congela a
  página; o aviso com o app fechado precisa de push pelo servidor (próximo passo, junto com a conta única com o Advogando).
- `src/lib/foco/sensor.ts`: **preparado para o app de loja**. Se existir `window.EstudeMaisNativo.usosEntre(inicio, fim)`,
  o mentor diz o app exato (Instagram, WhatsApp...) e não pergunta. Android: UsageStatsManager (permissão "Acesso ao uso";
  a Play Store exige declarar que o app é de foco/bem-estar). iPhone: Screen Time API (FamilyControls + DeviceActivity):
  a Apple não entrega o nome do app ao código, mas permite saber quando a pessoa passou do limite nos apps que ela marcou e
  bloquear esses apps durante o estudo.

## Modo integrado com o Advogando (conta única, um cobrador)

Detalhes e passo a passo do dono: `docs/ECOSSISTEMA.md` no repositório do Advogando. Resumo:

- A pessoa **escolhe** ligar os dois apps (convite no Mentor de foco e depois de registrar um resultado do escritório).
  Ligados, o Advogando usa **este** projeto Supabase (tabelas dele em `supabase/migrations/0004_advogando.sql`) e as
  tabelas compartilhadas `ecossistema`, `atividade` e `cobrancas` (`0005_ecossistema.sql`).
- `src/lib/ecossistema.ts`: escolha e rigor compartilhados, resumo de cada app para o outro, presença a cada minuto,
  cobranças registradas. Com os apps ligados, o cobrador é **o Sócio** (mesmo rigor nos dois), a saída passada no
  Advogando é reconhecida e não cobrada, e a saída já cobrada lá não é cobrada de novo.
- Sem conta, sem as tabelas ou com os apps desligados, nada muda. Sem as tabelas, o app para de consultar até reabrir.
- Teste de navegador sem Supabase: `window.__ECO_TESTE__ = true` (via `addInitScript`) usa `localStorage`
  (`revisemais:eco-teste`) para simular o Advogando.
- **Tempo em dobro:** ir para o Advogando pelos botões daqui pausa o cronômetro (`pausarParaOEscritorio`); se ele rodou
  durante o atendimento, o registro do resultado desconta o tempo que já entrou pela sessão do escritório.

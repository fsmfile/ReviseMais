# ReviseMais

App (PWA) para organizar os estudos para concursos jurídicos:

- **Planos de estudo em abas**: um por edital/concurso, cada um com sua cor.
- **Edital verticalizado**: disciplinas → assuntos (com a numeração do edital), progresso por disciplina.
- **Importação do PDF do edital**: o app lê o “Conteúdo Programático”, separa disciplinas e assuntos e você revisa tudo antes de salvar. Também aceita colar o texto (útil para PDFs escaneados).
- **Correlação entre editais**: etiquetas coloridas mostram, ao lado de cada disciplina e assunto, em quais outros editais seus ele também cai. A tela *Comparar editais* mostra a matriz disciplina × edital e o percentual de sobreposição.
- **Revisões espaçadas**: ao registrar a data de estudo, o app agenda revisões de **48 horas, 1 semana, 2 meses e 6 meses**.
- **Alertas**: tela *Hoje* com revisões atrasadas/do dia e **calendário** (link assinável que se atualiza sozinho ou arquivo `.ics`) para receber lembretes no celular.
- **% de acertos** em cada estudo e revisão, com gráfico de evolução, tabela por disciplina, tendência e “assuntos para reforçar”.

## Rodar no computador

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes da lógica (revisões, leitura do edital, correlação)
npm run build      # gera a pasta dist/ para publicar
```

Sem configurar nada, o app abre em **modo local** (dados só no navegador) — bom para experimentar.

## Configurar o Supabase (login + sincronização)

1. Crie uma conta e um projeto gratuito em <https://supabase.com>.
2. No projeto: **SQL Editor → New query**, cole o conteúdo de `supabase/migrations/0001_init.sql` e clique em **Run**.
   Isso cria as tabelas, as regras de segurança (cada usuário só vê os próprios dados) e o armazenamento dos PDFs.
   Depois rode também `supabase/migrations/0002_sessoes_e_cores.sql` (cronômetro, tempo de estudo e cores personalizadas).
3. Em **Project Settings → API**, copie a *Project URL* e a chave *anon public*.
4. Copie `.env.example` para `.env` e preencha:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
5. Em **Authentication → URL Configuration**, coloque o endereço onde o app ficará publicado em *Site URL* (para os e-mails de confirmação funcionarem).

### Calendário que se atualiza sozinho (opcional, recomendado)

Publica uma função que entrega suas revisões pendentes em formato de calendário:

```bash
npx supabase login
npx supabase link --project-ref SEU-PROJECT-REF
npx supabase functions deploy calendario --no-verify-jwt
```

Depois, no app, vá em **🔔 Calendário**, copie o link e assine no Google Agenda (“Outras agendas → Do URL”), no iPhone ou no Outlook.
Sem a função, use o botão **Baixar .ics**.

## Publicar

É um site estático (pasta `dist/`). Pode ser publicado de graça em Vercel, Netlify, Cloudflare Pages ou GitHub Pages
(defina as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no serviço; para subpastas use `BASE_PATH=/nome/`).
No celular, abra o endereço e use **“Adicionar à tela inicial”** para instalar como app.

## Estrutura

```
src/lib/datas.ts          cálculo das datas de revisão
src/lib/editalParser.ts   leitura do conteúdo programático
src/lib/pdf.ts            extração de texto do PDF (pdf.js)
src/lib/correlacao.ts     equivalência de disciplinas/assuntos entre editais
src/lib/store.tsx         estado e ações (criar plano, registrar estudo, concluir revisão…)
src/lib/backend.ts        Supabase ou modo local
src/lib/ics.ts            geração do calendário
src/pages/                telas (Hoje, Plano, Novo plano, Evolução, Comparar, Calendário, Login)
supabase/                 banco de dados e função do calendário
```

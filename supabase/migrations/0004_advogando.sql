-- Tabelas do Advogando no projeto do EstudeMais (conta única do ecossistema, docs/ECOSSISTEMA.md no Advogando).
-- Cópia de supabase/migrations/001_progresso.sql, 002_relatos.sql e 003_jogo.sql do repositório fsmfile/AdvogandoGame.
-- Pode rodar mais de uma vez.

-- ───────── 001_progresso.sql ─────────
-- Progresso de cada aluno: uma linha por conta, com tudo o que o jogo guarda
-- no aparelho (revisão espaçada, tentativas de peça, simulados, data da prova).
-- Rodar uma vez no SQL Editor do Supabase.

create table if not exists public.progresso (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

-- Cada pessoa só lê e grava a própria linha.
alter table public.progresso enable row level security;

drop policy if exists "progresso: ler o próprio" on public.progresso;
create policy "progresso: ler o próprio" on public.progresso
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "progresso: criar o próprio" on public.progresso;
create policy "progresso: criar o próprio" on public.progresso
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "progresso: alterar o próprio" on public.progresso;
create policy "progresso: alterar o próprio" on public.progresso
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ───────── 002_relatos.sql ─────────
-- Relatos de quem testa: erro de conteúdo, problema no app ou sugestão.
-- Enviados pelo próprio app (botão "Encontrou um erro?" e "Mande sua opinião", na aba Mais).
-- Rodar uma vez no SQL Editor do Supabase. Para ler: Table Editor > relatos.

create table if not exists public.relatos (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  tipo text not null check (tipo in ('conteudo', 'app', 'sugestao')),
  item_id text,
  tela text,
  mensagem text not null check (char_length(mensagem) between 3 and 4000),
  versao text,
  aparelho text,
  criado_em timestamptz not null default now()
);

-- Quem está logado só pode CRIAR relato em nome próprio. Ninguém lê pelo app:
-- os relatos só aparecem no painel do Supabase.
alter table public.relatos enable row level security;

drop policy if exists "relatos: criar o próprio" on public.relatos;
create policy "relatos: criar o próprio" on public.relatos
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- ───────── 003_jogo.sql ─────────
-- Mecânicas de jogo que dependem do servidor:
--   1. "O que os outros marcaram" (estatística anônima por alternativa)
--   2. Desafie um amigo (mesmo caso, placar dos dois)
--   3. Placar semanal (só quem escolher aparecer, com apelido)
--   4. Lembrete diário (inscrições de notificação do celular)
-- Rodar uma vez no SQL Editor do Supabase. Pode rodar de novo sem estragar nada.

-- ───────── 1. Escolhas anônimas ─────────
-- Sem user_id: ninguém consegue saber quem marcou o quê.
create table if not exists public.escolhas (
  id bigint generated always as identity primary key,
  item_id text not null check (char_length(item_id) <= 80),
  opcao smallint not null check (opcao between 0 and 9),
  criado_em timestamptz not null default now()
);
create index if not exists escolhas_item on public.escolhas (item_id);
alter table public.escolhas enable row level security;
drop policy if exists "escolhas: registrar" on public.escolhas;
create policy "escolhas: registrar" on public.escolhas for insert to authenticated with check (true);

-- Leitura só agregada (quantas pessoas em cada alternativa), nunca linha a linha.
create or replace function public.distribuicao(p_item text)
returns table (opcao smallint, total bigint)
language sql stable security definer set search_path = public as $$
  select e.opcao, count(*) from public.escolhas e where e.item_id = p_item group by e.opcao;
$$;
revoke all on function public.distribuicao(text) from public;
grant execute on function public.distribuicao(text) to authenticated;

-- ───────── 2. Desafios ─────────
create table if not exists public.desafios (
  id uuid primary key default gen_random_uuid(),
  criador uuid not null default auth.uid() references auth.users (id) on delete cascade,
  apelido text not null check (char_length(apelido) between 1 and 30),
  caso_id text not null check (char_length(caso_id) <= 80),
  relator text not null check (relator in ('didatico', 'formalista', 'pautaCheia')),
  nota numeric(4, 2) not null check (nota between 0 and 10),
  criado_em timestamptz not null default now()
);
alter table public.desafios enable row level security;
drop policy if exists "desafios: criar o próprio" on public.desafios;
create policy "desafios: criar o próprio" on public.desafios for insert to authenticated with check ((select auth.uid()) = criador);

create table if not exists public.desafio_respostas (
  desafio_id uuid not null references public.desafios (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  apelido text not null check (char_length(apelido) between 1 and 30),
  nota numeric(4, 2) not null check (nota between 0 and 10),
  criado_em timestamptz not null default now(),
  primary key (desafio_id, user_id)
);
alter table public.desafio_respostas enable row level security;
drop policy if exists "desafio_respostas: responder" on public.desafio_respostas;
create policy "desafio_respostas: responder" on public.desafio_respostas for insert to authenticated with check ((select auth.uid()) = user_id);

-- Quem tem o link (o id do desafio) vê o desafio e o placar; ninguém lista todos os desafios.
create or replace function public.ver_desafio(p_id uuid)
returns table (apelido text, caso_id text, relator text, nota numeric, criador boolean, criado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select d.apelido, d.caso_id, d.relator, d.nota, true, d.criado_em from public.desafios d where d.id = p_id
  union all
  select r.apelido, d.caso_id, d.relator, r.nota, false, r.criado_em
    from public.desafio_respostas r join public.desafios d on d.id = r.desafio_id where r.desafio_id = p_id
  order by 6;
$$;
revoke all on function public.ver_desafio(uuid) from public;
grant execute on function public.ver_desafio(uuid) to authenticated;

-- ───────── 3. Placar semanal ─────────
-- Uma linha por pessoa e semana. Só aparece no placar quem preencher o apelido (opcional).
create table if not exists public.placar (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  semana date not null,
  apelido text check (apelido is null or char_length(apelido) between 1 and 30),
  pontos integer not null default 0 check (pontos between 0 and 100000),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, semana)
);
alter table public.placar enable row level security;
drop policy if exists "placar: criar o próprio" on public.placar;
create policy "placar: criar o próprio" on public.placar for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "placar: alterar o próprio" on public.placar;
create policy "placar: alterar o próprio" on public.placar for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "placar: ler o próprio" on public.placar;
create policy "placar: ler o próprio" on public.placar for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.placar_semana(p_semana date)
returns table (posicao bigint, apelido text, pontos integer, eu boolean)
language sql stable security definer set search_path = public as $$
  select rank() over (order by p.pontos desc), p.apelido, p.pontos, p.user_id = auth.uid()
    from public.placar p
   where p.semana = p_semana and p.apelido is not null and p.pontos > 0
   order by p.pontos desc
   limit 50;
$$;
revoke all on function public.placar_semana(date) from public;
grant execute on function public.placar_semana(date) to authenticated;

-- ───────── 4. Lembretes diários ─────────
-- Inscrição de notificação de cada aparelho. Quem envia é o Worker da Cloudflare (com a chave secreta).
create table if not exists public.lembretes (
  endpoint text primary key check (char_length(endpoint) <= 1000),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  hora smallint not null check (hora between 0 and 23),
  ativo boolean not null default true,
  ultimo_envio date,
  criado_em timestamptz not null default now()
);
alter table public.lembretes enable row level security;
drop policy if exists "lembretes: criar o próprio" on public.lembretes;
create policy "lembretes: criar o próprio" on public.lembretes for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "lembretes: alterar o próprio" on public.lembretes;
create policy "lembretes: alterar o próprio" on public.lembretes for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "lembretes: ler o próprio" on public.lembretes;
create policy "lembretes: ler o próprio" on public.lembretes for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "lembretes: apagar o próprio" on public.lembretes;
create policy "lembretes: apagar o próprio" on public.lembretes for delete to authenticated using ((select auth.uid()) = user_id);

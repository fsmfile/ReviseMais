-- Assuntos repetidos entre planos (18/11/2026): mesclar e "não são iguais".
-- Mesclados, os assuntos continuam em cada plano, mas estudo e revisões passam a ser um conjunto só:
-- mesclado_em aponta para a raiz do grupo (a raiz tem null). O app move os registros antes de apagar um assunto;
-- o "set null" é só a rede de segurança.
alter table public.assuntos add column if not exists mesclado_em uuid references public.assuntos(id) on delete set null;
create index if not exists assuntos_mesclado_idx on public.assuntos(mesclado_em);

-- Pares que a pessoa disse que não são iguais: a sugestão não volta.
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

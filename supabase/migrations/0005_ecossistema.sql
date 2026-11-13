-- Ecossistema EstudeMais + Advogando: uma conta, um cobrador (docs/ECOSSISTEMA.md no Advogando).
-- Rode depois de 0004_advogando.sql. Pode rodar mais de uma vez.

-- A escolha da pessoa (ligar ou não os dois apps), o rigor do cobrador e o que cada app conta ao outro.
create table if not exists public.ecossistema (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  -- null = ainda não respondeu; true = ligou os dois apps; false = preferiu não ligar.
  integrado boolean,
  -- Rigor do cobrador único: 0 = ninguém, 1 = camarada, 2 = exigente, 3 = linha-dura.
  nivel smallint not null default 0 check (nivel between 0 and 3),
  -- Pendências e situação de cada app (revisões de hoje, cronômetro, prazos, caso parado), escritas pelo próprio app.
  resumo_estudemais jsonb not null default '{}'::jsonb,
  resumo_advogando jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

-- Quando a pessoa esteve com cada app aberto na tela. Um app que perdeu a pessoa de vista consulta aqui
-- se ela estava estudando no outro (e aí não cobra). Guarda só os últimos dias.
create table if not exists public.atividade (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  app text not null check (app in ('estudemais', 'advogando')),
  inicio timestamptz not null,
  fim timestamptz not null
);
create index if not exists atividade_user_fim_idx on public.atividade (user_id, fim desc);

-- Cobranças feitas, para a mesma saída não ser cobrada nos dois apps.
create table if not exists public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  app text not null check (app in ('estudemais', 'advogando')),
  saiu timestamptz not null,
  voltou timestamptz not null,
  criado_em timestamptz not null default now()
);
create index if not exists cobrancas_user_voltou_idx on public.cobrancas (user_id, voltou desc);

-- Cada pessoa só enxerga e altera o que é seu.
do $$
declare t text;
begin
  foreach t in array array['ecossistema', 'atividade', 'cobrancas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dono" on public.%I', t);
    execute format(
      'create policy "dono" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

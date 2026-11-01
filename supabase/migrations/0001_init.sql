-- ReviseMais — esquema inicial
-- Execute no Supabase: SQL Editor -> New query -> cole este arquivo -> Run.

create extension if not exists pgcrypto;

-- Planos de estudo (cada um vira uma aba). Um plano pode vir de um edital em PDF.
create table if not exists public.planos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  orgao text,
  cor text not null default '#2f6fdf',
  ordem int not null default 0,
  pdf_path text,
  data_prova date,
  created_at timestamptz not null default now()
);

create table if not exists public.disciplinas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plano_id uuid not null references public.planos(id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.assuntos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  disciplina_id uuid not null references public.disciplinas(id) on delete cascade,
  codigo text,
  nome text not null,
  nivel int not null default 1,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

-- Cada vez que você estuda um assunto, registra-se um estudo (data + % de acertos opcional).
create table if not exists public.estudos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assunto_id uuid not null references public.assuntos(id) on delete cascade,
  data date not null,
  percentual numeric(5,2) check (percentual between 0 and 100),
  questoes int check (questoes >= 0),
  observacao text,
  created_at timestamptz not null default now()
);

-- Revisões geradas a partir de um estudo: 48h, 1 semana, 2 meses, 6 meses.
create table if not exists public.revisoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  estudo_id uuid not null references public.estudos(id) on delete cascade,
  assunto_id uuid not null references public.assuntos(id) on delete cascade,
  tipo text not null check (tipo in ('48h','7d','2m','6m')),
  data_prevista date not null,
  concluida_em date,
  percentual numeric(5,2) check (percentual between 0 and 100),
  questoes int check (questoes >= 0),
  created_at timestamptz not null default now()
);

-- Token secreto para o link de assinatura do calendário (.ics).
create table if not exists public.perfis (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  calendar_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create index if not exists disciplinas_plano_idx on public.disciplinas(plano_id);
create index if not exists assuntos_disciplina_idx on public.assuntos(disciplina_id);
create index if not exists estudos_assunto_idx on public.estudos(assunto_id);
create index if not exists revisoes_user_data_idx on public.revisoes(user_id, data_prevista);

-- Segurança: cada usuário só enxerga e altera os próprios dados.
do $$
declare t text;
begin
  foreach t in array array['planos','disciplinas','assuntos','estudos','revisoes','perfis'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dono" on public.%I', t);
    execute format(
      'create policy "dono" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Armazenamento dos PDFs dos editais (bucket privado, uma pasta por usuário).
insert into storage.buckets (id, name, public)
values ('editais', 'editais', false)
on conflict (id) do nothing;

drop policy if exists "editais do dono - ler" on storage.objects;
drop policy if exists "editais do dono - gravar" on storage.objects;
drop policy if exists "editais do dono - apagar" on storage.objects;
create policy "editais do dono - ler" on storage.objects for select
  using (bucket_id = 'editais' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "editais do dono - gravar" on storage.objects for insert
  with check (bucket_id = 'editais' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "editais do dono - apagar" on storage.objects for delete
  using (bucket_id = 'editais' and (storage.foldername(name))[1] = auth.uid()::text);

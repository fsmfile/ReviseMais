-- ReviseMais — sessões de estudo (cronômetro, histórico, tempo de estudo) e cores das disciplinas/assuntos
-- Execute no Supabase: SQL Editor -> New query -> cole este arquivo -> Run.

create table if not exists public.sessoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plano_id uuid references public.planos(id) on delete set null,
  disciplina_id uuid references public.disciplinas(id) on delete set null,
  assunto_id uuid references public.assuntos(id) on delete set null,
  -- nome da matéria guardado junto, para o histórico continuar legível se a disciplina for apagada
  materia text not null,
  tipo text not null default 'teoria'
    check (tipo in ('teoria','questoes','revisao','lei_seca','videoaula','resumo','simulado','outro')),
  data date not null,
  inicio timestamptz,
  duracao_seg int not null check (duracao_seg > 0),
  questoes int check (questoes >= 0),
  acertos int check (acertos >= 0),
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists sessoes_user_data_idx on public.sessoes(user_id, data);

alter table public.sessoes enable row level security;
drop policy if exists "dono" on public.sessoes;
create policy "dono" on public.sessoes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Cores escolhidas pelo usuário para disciplinas e assuntos (null = cor padrão).
alter table public.disciplinas add column if not exists cor text;
alter table public.assuntos add column if not exists cor text;

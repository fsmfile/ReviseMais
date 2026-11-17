-- Minhas questões e o Monitor (docs/MONITOR.md). Rode depois de 0005_ecossistema.sql. Pode rodar mais de uma vez.
-- O app NÃO chama IA: a pessoa cadastra a questão (fica "pendente"); o dono roda os agentes no computador dele,
-- em lote, e eles gravam o comentário aqui (status "comentada").

-- Questões feitas em simulados, com o que a pessoa estudou e aprendeu.
create table if not exists public.questoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plano_id uuid,
  disciplina_id uuid,
  assunto_id uuid,
  materia text not null default '',
  banca text,
  prova text,
  formato text not null default 'multipla' check (formato in ('multipla', 'certo_errado')),
  enunciado text not null default '',
  -- [{ "letra": "A", "texto": "..." }]
  alternativas jsonb not null default '[]'::jsonb,
  marcada text,
  gabarito text not null default '',
  -- O que a pessoa estudou e aprendeu com a questão.
  comentario text not null default '',
  status text not null default 'pendente' check (status in ('pendente', 'comentada')),
  -- Escrito só pelo script do dono (formato em scripts/monitor/esquema.ts).
  comentario_monitor jsonb,
  comentada_em timestamptz,
  lida_em timestamptz,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);
create index if not exists questoes_user_idx on public.questoes (user_id, criada_em desc);
create index if not exists questoes_pendentes_idx on public.questoes (status) where status = 'pendente';

-- A "memória" (caderno de aprendizados): uma ideia curta e exata por linha.
create table if not exists public.aprendizados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  materia text not null default '',
  assunto_id uuid,
  texto text not null,
  fonte text,
  questoes uuid[] not null default '{}',
  origem text not null default 'voce' check (origem in ('voce', 'monitor')),
  criado_em timestamptz not null default now()
);
create index if not exists aprendizados_user_idx on public.aprendizados (user_id, materia);

-- Inscrição COMPLETA de notificação (com as chaves p256dh e auth), para o script do dono mandar aviso COM texto.
create table if not exists public.inscricoes_push (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  app text not null check (app in ('estudemais', 'advogando')),
  p256dh text not null,
  auth text not null,
  atualizado_em timestamptz not null default now()
);
create index if not exists inscricoes_push_user_idx on public.inscricoes_push (user_id);

-- Cada pessoa só enxerga e altera o que é seu.
do $$
declare t text;
begin
  foreach t in array array['questoes', 'aprendizados', 'inscricoes_push'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dono" on public.%I', t);
    execute format(
      'create policy "dono" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- O aparelho recebe os avisos da conta que está usando agora: se o mesmo celular entrar em outra conta,
-- a inscrição passa para ela (a regra "dono" sozinha não deixaria trocar o dono da linha).
create or replace function public.registrar_inscricao(p_endpoint text, p_app text, p_p256dh text, p_auth text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.inscricoes_push (endpoint, user_id, app, p256dh, auth, atualizado_em)
  select p_endpoint, auth.uid(), p_app, p_p256dh, p_auth, now()
  where auth.uid() is not null
  on conflict (endpoint) do update
    set user_id = excluded.user_id, app = excluded.app, p256dh = excluded.p256dh, auth = excluded.auth, atualizado_em = now();
$$;
revoke all on function public.registrar_inscricao(text, text, text, text) from public, anon;
grant execute on function public.registrar_inscricao(text, text, text, text) to authenticated;

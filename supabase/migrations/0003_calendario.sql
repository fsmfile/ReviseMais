-- EstudeMais — calendário assinável sem Edge Function
-- Execute no Supabase: SQL Editor -> New query -> cole este arquivo -> Run.
--
-- Devolve as revisões pendentes do dono do token (link secreto do calendário). É chamada pela rota
-- /api/calendario da própria Vercel com a chave pública; o token (uuid aleatório) é o que protege os dados.

create or replace function public.revisoes_calendario(p_token uuid)
returns table (data_prevista date, tipo text, assunto text, disciplina text, plano text)
language sql
security definer
set search_path = public
stable
as $$
  select r.data_prevista, r.tipo, a.nome, d.nome, p.nome
  from public.perfis pf
  join public.revisoes r on r.user_id = pf.user_id
  join public.assuntos a on a.id = r.assunto_id
  join public.disciplinas d on d.id = a.disciplina_id
  join public.planos p on p.id = d.plano_id
  where pf.calendar_token = p_token
    and r.concluida_em is null
    and r.data_prevista >= current_date - 30
  order by r.data_prevista
  limit 5000;
$$;

revoke all on function public.revisoes_calendario(uuid) from public;
grant execute on function public.revisoes_calendario(uuid) to anon, authenticated;

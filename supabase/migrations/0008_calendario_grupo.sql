-- Calendário assinável: devolve também o grupo do assunto (raiz da mesclagem, 0007) para o app listar
-- uma revisão por assunto mesclado por dia. Só leitura: não mexe em nenhum dado.
-- Mudar as colunas de retorno exige recriar a função; tudo numa transação para o link não falhar no meio.
begin;
drop function if exists public.revisoes_calendario(uuid);
create function public.revisoes_calendario(p_token uuid)
returns table (data_prevista date, tipo text, assunto text, disciplina text, plano text, grupo uuid)
language sql
security definer
set search_path = public
stable
as $$
  select r.data_prevista, r.tipo, a.nome, d.nome, p.nome, coalesce(a.mesclado_em, a.id)
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
commit;

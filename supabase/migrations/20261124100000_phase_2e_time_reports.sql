-- Fase 2E: informe administrativo de tiempo registrado.
-- SECURITY INVOKER conserva las políticas RLS de work_sessions/workers.
create or replace function public.admin_time_report(
  p_worker_id uuid default null,
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception using errcode = '22023', message = 'El periodo no es válido.';
  end if;

  -- Convert calendar boundaries in Europe/Madrid before querying UTC instants.
  v_start := (p_from::timestamp at time zone 'Europe/Madrid');
  v_end := ((p_to + 1)::timestamp at time zone 'Europe/Madrid');

  with eligible as (
    select
      s.id as session_id, s.worker_id, w.employee_code, w.first_name, w.last_name,
      s.clock_in_at, s.clock_out_at, s.status, s.revision,
      case when s.status = 'closed' and s.clock_out_at is not null
        then greatest(0, extract(epoch from least(s.clock_out_at, v_end) - greatest(s.clock_in_at, v_start)))
        else 0 end as duration_seconds,
      (s.status = 'open' and s.clock_in_at < v_end) as pending_open
    from public.work_sessions s
    join public.workers w on w.id = s.worker_id
    where (p_worker_id is null or s.worker_id = p_worker_id)
      and s.clock_in_at < v_end
      and (s.status = 'open' or s.clock_out_at > v_start)
  ), payload as (
    select
      coalesce(jsonb_agg(jsonb_build_object(
        'session_id', session_id, 'worker_id', worker_id,
        'employee_code', employee_code, 'first_name', first_name, 'last_name', last_name,
        'clock_in_at', clock_in_at, 'clock_out_at', clock_out_at,
        'status', status, 'revision', revision,
        'duration_seconds', duration_seconds, 'pending_open', pending_open
      ) order by clock_in_at, session_id), '[]'::jsonb) as rows,
      coalesce(sum(duration_seconds) filter (where status = 'closed'), 0)::bigint as total_seconds,
      count(*) filter (where status = 'closed') as closed_count,
      count(*) filter (where pending_open) as open_count
    from eligible
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to, 'timezone', 'Europe/Madrid',
    'rows', rows, 'total_seconds', total_seconds,
    'closed_count', closed_count, 'open_count', open_count
  ) into v_result
  from payload;

  return v_result;
end;
$$;

revoke all on function public.admin_time_report(uuid, date, date) from public, anon;
grant execute on function public.admin_time_report(uuid, date, date) to authenticated;

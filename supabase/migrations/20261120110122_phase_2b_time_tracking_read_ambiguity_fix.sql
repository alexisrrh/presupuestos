begin;

-- The output column named worker_id is visible as a PL/pgSQL variable.  The
-- open-session lookup must therefore qualify the table column explicitly.
-- This preserves the previously reviewed definer, owner and ACLs while
-- correcting the read path used by the personal time-tracking screen.
create or replace function priteca_private.get_current_worker_time_tracking_state_impl()
returns table(
  worker_id uuid,
  organization_id uuid,
  employee_code text,
  first_name text,
  last_name text,
  session_id uuid,
  session_status text,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  session_revision integer
)
language plpgsql
security definer
set search_path = pg_catalog, public, priteca_private
as $$
declare
  v_worker public.workers;
begin
  select * into v_worker
  from priteca_private.current_active_worker_for_read();

  return query
  select
    v_worker.id,
    v_worker.organization_id,
    v_worker.employee_code,
    v_worker.first_name,
    v_worker.last_name,
    open_session.id,
    open_session.status,
    open_session.clock_in_at,
    open_session.clock_out_at,
    open_session.revision
  from (select 1) as marker
  left join lateral (
    select ws.*
    from public.work_sessions as ws
    where ws.worker_id = v_worker.id
      and ws.status = 'open'
    order by ws.clock_in_at desc
    limit 1
  ) as open_session on true;
end;
$$;

commit;

-- Phase 2B needs a read-only, self-scoped projection. workers remains an
-- administrative table: this RPC never accepts an employee, organisation or
-- session identifier from the browser.
begin;

create or replace function priteca_private.current_active_worker_for_read()
returns public.workers
language plpgsql
security definer
set search_path = pg_catalog, public, priteca_private
as $$
declare
  v_actor uuid;
  v_worker public.workers;
begin
  v_actor := priteca_private.request_actor_id();
  if v_actor is null then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select w.* into v_worker
  from public.workers w
  where w.user_id = v_actor
    and w.status = 'active'
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = w.organization_id
        and om.user_id = v_actor
        and om.is_active
        and om.role in ('owner', 'admin', 'employee')
    );
  if not found then
    raise exception 'No hay una ficha activa vinculada.' using errcode = '42501';
  end if;
  return v_worker;
end;
$$;
alter function priteca_private.current_active_worker_for_read() owner to postgres;
revoke all on function priteca_private.current_active_worker_for_read() from public, anon, authenticated;
grant execute on function priteca_private.current_active_worker_for_read() to authenticated;

create or replace function priteca_private.get_current_worker_time_tracking_state_impl()
returns table (
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
declare v_worker public.workers;
begin
  select * into v_worker from priteca_private.current_active_worker_for_read();
  return query
  select v_worker.id, v_worker.organization_id, v_worker.employee_code, v_worker.first_name, v_worker.last_name,
         s.id, s.status, s.clock_in_at, s.clock_out_at, s.revision
  from (select 1) marker
  left join lateral (
    select * from public.work_sessions
    where worker_id = v_worker.id and status = 'open'
    order by clock_in_at desc limit 1
  ) s on true;
end;
$$;
alter function priteca_private.get_current_worker_time_tracking_state_impl() owner to postgres;
revoke all on function priteca_private.get_current_worker_time_tracking_state_impl() from public, anon;
grant execute on function priteca_private.get_current_worker_time_tracking_state_impl() to authenticated;

create or replace function priteca_private.list_current_worker_work_sessions_impl(p_limit integer default 10)
returns table (
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
declare v_worker public.workers;
begin
  if p_limit is null or p_limit < 1 or p_limit > 30 then
    raise exception 'Límite de historial inválido.' using errcode = '22023';
  end if;
  select * into v_worker from priteca_private.current_active_worker_for_read();
  return query
  select s.id, s.status, s.clock_in_at, s.clock_out_at, s.revision
  from public.work_sessions s
  where s.worker_id = v_worker.id
  order by s.clock_in_at desc
  limit p_limit;
end;
$$;
alter function priteca_private.list_current_worker_work_sessions_impl(integer) owner to postgres;
revoke all on function priteca_private.list_current_worker_work_sessions_impl(integer) from public, anon;
grant execute on function priteca_private.list_current_worker_work_sessions_impl(integer) to authenticated;

create or replace function public.get_current_worker_time_tracking_state()
returns table (
  worker_id uuid, organization_id uuid, employee_code text, first_name text, last_name text,
  session_id uuid, session_status text, clock_in_at timestamptz, clock_out_at timestamptz, session_revision integer
)
language sql security invoker set search_path = public, priteca_private
as $$ select * from priteca_private.get_current_worker_time_tracking_state_impl(); $$;

create or replace function public.list_current_worker_work_sessions(p_limit integer default 10)
returns table (session_id uuid, session_status text, clock_in_at timestamptz, clock_out_at timestamptz, session_revision integer)
language sql security invoker set search_path = public, priteca_private
as $$ select * from priteca_private.list_current_worker_work_sessions_impl(p_limit); $$;

revoke all on function public.get_current_worker_time_tracking_state() from public, anon;
revoke all on function public.list_current_worker_work_sessions(integer) from public, anon;
grant execute on function public.get_current_worker_time_tracking_state() to authenticated;
grant execute on function public.list_current_worker_work_sessions(integer) to authenticated;
notify pgrst, 'reload schema';
commit;

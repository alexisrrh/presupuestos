-- Fase 2F: solicitudes trazables de corrección de fichaje.
-- Las solicitudes son independientes de work_sessions. Solo una resolución
-- administrativa autorizada puede cambiar una jornada o crear la jornada
-- olvidada propuesta; el DML directo permanece revocado.
begin;

create table if not exists public.work_session_correction_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  work_session_id uuid references public.work_sessions(id) on delete restrict,
  requester_id uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('entry_forgotten', 'exit_forgotten', 'time_correction', 'full_day_forgotten')),
  proposed_clock_in_at timestamptz not null,
  proposed_clock_out_at timestamptz,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  expected_session_revision integer check (expected_session_revision is null or expected_session_revision > 0),
  resolution_reason text check (resolution_reason is null or char_length(btrim(resolution_reason)) between 3 and 500),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (proposed_clock_out_at is null or proposed_clock_out_at >= proposed_clock_in_at),
  check ((status = 'pending' and resolved_by is null and resolved_at is null)
      or (status in ('approved', 'rejected') and resolved_by is not null and resolved_at is not null))
);

create index if not exists work_session_correction_requests_org_status_idx
  on public.work_session_correction_requests(organization_id, status, created_at desc);
create index if not exists work_session_correction_requests_requester_idx
  on public.work_session_correction_requests(requester_id, created_at desc);
create unique index if not exists work_session_correction_requests_pending_duplicate_idx
  on public.work_session_correction_requests(worker_id, kind, proposed_clock_in_at)
  where status = 'pending';

create table if not exists public.work_session_correction_request_audit_log (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.work_session_correction_requests(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('submitted', 'approved', 'rejected')),
  previous_status text,
  next_status text not null,
  reason text,
  occurred_at timestamptz not null default clock_timestamp()
);
create index if not exists work_session_correction_request_audit_request_idx
  on public.work_session_correction_request_audit_log(request_id, occurred_at);

alter table public.work_session_correction_requests enable row level security;
alter table public.work_session_correction_request_audit_log enable row level security;
revoke all on public.work_session_correction_requests, public.work_session_correction_request_audit_log
  from public, anon, authenticated;
grant select on public.work_session_correction_requests,
  public.work_session_correction_request_audit_log to authenticated;

drop policy if exists work_session_correction_requests_select on public.work_session_correction_requests;
create policy work_session_correction_requests_select
on public.work_session_correction_requests
for select to authenticated
using (
  requester_id = auth.uid()
  or public.is_organization_admin(organization_id)
);
drop policy if exists work_session_correction_request_audit_select on public.work_session_correction_request_audit_log;
create policy work_session_correction_request_audit_select
on public.work_session_correction_request_audit_log
for select to authenticated
using (
  actor_id = auth.uid()
  or public.is_organization_admin(organization_id)
  or exists (
    select 1 from public.work_session_correction_requests r
    where r.id = request_id and r.requester_id = auth.uid()
  )
);

create or replace function public.submit_work_session_correction_request(
  p_worker_id uuid,
  p_work_session_id uuid,
  p_kind text,
  p_proposed_clock_in_at timestamptz,
  p_proposed_clock_out_at timestamptz,
  p_reason text
)
returns public.work_session_correction_requests
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_worker public.workers;
  v_session public.work_sessions;
  v_request public.work_session_correction_requests;
begin
  if v_actor is null or p_worker_id is null or p_kind not in ('entry_forgotten', 'exit_forgotten', 'time_correction', 'full_day_forgotten')
     or p_proposed_clock_in_at is null
     or p_kind in ('exit_forgotten', 'full_day_forgotten') and p_proposed_clock_out_at is null
     or char_length(btrim(coalesce(p_reason, ''))) not between 3 and 500
     or (p_proposed_clock_out_at is not null and p_proposed_clock_out_at < p_proposed_clock_in_at) then
    raise exception 'Solicitud inválida.' using errcode = '22023';
  end if;
  select * into v_worker from public.workers where id = p_worker_id and status = 'active';
  if not found or not exists (
    select 1 from public.organization_members om
    where om.organization_id = v_worker.organization_id and om.user_id = v_actor
      and om.is_active and om.role in ('owner', 'admin', 'employee')
  ) or v_worker.user_id <> v_actor then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;
  if p_work_session_id is not null then
    select * into v_session from public.work_sessions where id = p_work_session_id and worker_id = p_worker_id;
    if not found then raise exception 'Jornada inaccesible.' using errcode = '42501'; end if;
  end if;
  insert into public.work_session_correction_requests (
    organization_id, worker_id, work_session_id, requester_id, kind,
    proposed_clock_in_at, proposed_clock_out_at, reason, expected_session_revision
  ) values (
    v_worker.organization_id, p_worker_id, p_work_session_id, v_actor, p_kind,
    p_proposed_clock_in_at, p_proposed_clock_out_at, btrim(p_reason), v_session.revision
  ) returning * into v_request;
  insert into public.work_session_correction_request_audit_log
    (request_id, organization_id, worker_id, actor_id, action, previous_status, next_status, reason)
  values (v_request.id, v_request.organization_id, v_request.worker_id, v_actor,
          'submitted', null, 'pending', v_request.reason);
  return v_request;
exception when unique_violation then
  raise exception 'Ya existe una solicitud pendiente equivalente.' using errcode = '23505';
end;
$$;
alter function public.submit_work_session_correction_request(uuid, uuid, text, timestamptz, timestamptz, text) owner to postgres;
revoke all on function public.submit_work_session_correction_request(uuid, uuid, text, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.submit_work_session_correction_request(uuid, uuid, text, timestamptz, timestamptz, text) to authenticated;

create or replace function public.list_my_work_session_correction_requests(p_limit integer default 50)
returns setof public.work_session_correction_requests
language sql stable security invoker
set search_path = public
as $$
  select * from public.work_session_correction_requests
  where requester_id = auth.uid()
  order by created_at desc limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;
revoke all on function public.list_my_work_session_correction_requests(integer) from public, anon;
grant execute on function public.list_my_work_session_correction_requests(integer) to authenticated;

create or replace function public.admin_list_work_session_correction_requests(
  p_status text default null,
  p_worker_id uuid default null,
  p_from date default null,
  p_to date default null,
  p_limit integer default 100
)
returns setof public.work_session_correction_requests
language sql stable security invoker
set search_path = public
as $$
  select r.* from public.work_session_correction_requests r
  where (p_status is null or r.status = p_status)
    and (p_worker_id is null or r.worker_id = p_worker_id)
    and (p_from is null or r.proposed_clock_in_at >= p_from::timestamptz)
    and (p_to is null or r.proposed_clock_in_at < (p_to + 1)::timestamptz)
  order by r.created_at desc limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;
revoke all on function public.admin_list_work_session_correction_requests(text, uuid, date, date, integer) from public, anon;
grant execute on function public.admin_list_work_session_correction_requests(text, uuid, date, date, integer) to authenticated;

create or replace function public.resolve_work_session_correction_request(
  p_request_id uuid,
  p_expected_revision integer,
  p_decision text,
  p_resolution_reason text
)
returns public.work_session_correction_requests
language plpgsql security definer
set search_path = pg_catalog, public, auth, priteca_private
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.work_session_correction_requests;
  v_session public.work_sessions;
  v_before jsonb;
  v_after jsonb;
  v_result public.work_session_correction_requests;
begin
  if v_actor is null or p_request_id is null or p_expected_revision is null
     or p_decision not in ('approved', 'rejected')
     or char_length(btrim(coalesce(p_resolution_reason, ''))) not between 3 and 500 then
    raise exception 'Resolución inválida.' using errcode = '22023';
  end if;
  select * into v_request from public.work_session_correction_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending'
     or v_request.revision <> p_expected_revision
     or not public.is_organization_admin(v_request.organization_id)
     or v_request.requester_id = v_actor then
    raise exception 'Solicitud inaccesible, desfasada o autoaprobación no permitida.' using errcode = '40001';
  end if;
  if p_decision = 'approved' then
    if v_request.work_session_id is not null then
      select * into v_session from public.work_sessions where id = v_request.work_session_id for update;
      if not found or v_session.revision is distinct from v_request.expected_session_revision then
        raise exception 'La jornada cambió desde la solicitud.' using errcode = '40001';
      end if;
      v_before := jsonb_build_object('clock_in_at', v_session.clock_in_at, 'clock_out_at', v_session.clock_out_at, 'status', v_session.status, 'revision', v_session.revision);
      update public.work_sessions set
        clock_in_at = v_request.proposed_clock_in_at,
        clock_out_at = v_request.proposed_clock_out_at,
        status = case when v_request.proposed_clock_out_at is null then 'open' else 'closed' end,
        clock_in_actor_id = coalesce(clock_in_actor_id, v_actor),
        clock_out_actor_id = case when v_request.proposed_clock_out_at is null then null else v_actor end
      where id = v_session.id returning * into v_session;
      v_after := jsonb_build_object('clock_in_at', v_session.clock_in_at, 'clock_out_at', v_session.clock_out_at, 'status', v_session.status, 'revision', v_session.revision);
      insert into public.work_session_audit_log (organization_id, worker_id, work_session_id, actor_id, action, reason, previous_values, next_values, resulting_revision)
      values (v_session.organization_id, v_session.worker_id, v_session.id, v_actor, 'admin_corrected', btrim(p_resolution_reason), v_before, v_after, v_session.revision);
    else
      insert into public.work_sessions (organization_id, worker_id, clock_in_at, clock_out_at, status, clock_in_actor_id, clock_out_actor_id)
      values (v_request.organization_id, v_request.worker_id, v_request.proposed_clock_in_at, v_request.proposed_clock_out_at, 'closed', v_actor, v_actor)
      returning * into v_session;
      insert into public.work_session_audit_log (organization_id, worker_id, work_session_id, actor_id, action, reason, resulting_revision)
      values (v_session.organization_id, v_session.worker_id, v_session.id, v_actor, 'admin_corrected', btrim(p_resolution_reason), v_session.revision);
    end if;
  end if;
  update public.work_session_correction_requests set status = p_decision, resolution_reason = btrim(p_resolution_reason), resolved_by = v_actor, resolved_at = clock_timestamp() where id = v_request.id returning * into v_result;
  insert into public.work_session_correction_request_audit_log (request_id, organization_id, worker_id, actor_id, action, previous_status, next_status, reason)
  values (v_request.id, v_request.organization_id, v_request.worker_id, v_actor, p_decision, 'pending', p_decision, btrim(p_resolution_reason));
  return v_result;
end;
$$;
alter function public.resolve_work_session_correction_request(uuid, integer, text, text) owner to postgres;
revoke all on function public.resolve_work_session_correction_request(uuid, integer, text, text) from public, anon;
grant execute on function public.resolve_work_session_correction_request(uuid, integer, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;

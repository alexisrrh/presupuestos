-- Fase 2A: vínculo seguro cuenta–trabajador y fichaje transaccional.
-- No crea UI ni solicitudes de corrección (2B/2C). Las horas se generan en
-- PostgreSQL como timestamptz (UTC); la presentación predeterminada será
-- Europe/Madrid en el futuro cliente, sin almacenar horas enviadas por él.
begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'priteca_attendance_writer') then
    create role priteca_attendance_writer nologin nosuperuser nobypassrls nocreaterole nocreatedb noinherit;
  end if;
end;
$$;

create schema if not exists priteca_private;
revoke all on schema priteca_private from public, anon;
grant usage on schema priteca_private to priteca_attendance_writer, authenticated;

-- A single Supabase identity can only be the active account identity of one
-- worker record. The existing worker trigger still prevents any direct change.
create unique index if not exists workers_user_id_unique_when_present
  on public.workers(user_id)
  where user_id is not null;

create table if not exists public.worker_identity_audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  previous_user_id uuid references auth.users(id) on delete set null,
  new_user_id uuid references auth.users(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('linked', 'unlinked', 'changed')),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  occurred_at timestamptz not null default clock_timestamp()
);

create index if not exists worker_identity_audit_worker_occurred_idx
  on public.worker_identity_audit_log(worker_id, occurred_at);

create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  status text not null check (status in ('open', 'closed')),
  clock_in_actor_id uuid references auth.users(id) on delete set null,
  clock_out_actor_id uuid references auth.users(id) on delete set null,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (
    (status = 'open' and clock_out_at is null)
    or (status = 'closed' and clock_out_at is not null and clock_out_at >= clock_in_at)
  )
);

-- This is the final database-level guard against two sessions being opened,
-- in addition to the worker-row lock used by the RPC.
create unique index if not exists work_sessions_one_open_worker_idx
  on public.work_sessions(worker_id)
  where status = 'open';
create index if not exists work_sessions_organization_worker_idx
  on public.work_sessions(organization_id, worker_id, clock_in_at desc);

create table if not exists public.work_session_audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  work_session_id uuid references public.work_sessions(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in (
    'clocked_in', 'clocked_out', 'clock_in_rejected_open', 'clock_out_rejected_no_open'
  )),
  occurred_at timestamptz not null default clock_timestamp()
);

create index if not exists work_session_audit_worker_occurred_idx
  on public.work_session_audit_log(worker_id, occurred_at);

create or replace function public.work_sessions_set_metadata()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.revision <> old.revision then
    raise exception 'La revision de jornada no puede establecerse directamente.' using errcode = '22023';
  end if;
  new.revision := old.revision + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
drop trigger if exists work_sessions_set_metadata on public.work_sessions;
create trigger work_sessions_set_metadata
before update on public.work_sessions
for each row execute function public.work_sessions_set_metadata();

-- Direct writes remain unavailable to browser roles. The technical role has
-- only the narrowly-scoped privileges required by the private RPCs.
revoke all on public.worker_identity_audit_log, public.work_sessions, public.work_session_audit_log
  from public, anon, authenticated;
grant select on public.worker_identity_audit_log, public.work_sessions, public.work_session_audit_log to authenticated;
grant select on public.workers, public.organization_members to priteca_attendance_writer;
grant insert, update on public.workers to priteca_attendance_writer;
grant insert, update on public.work_sessions to priteca_attendance_writer;
grant insert on public.worker_identity_audit_log, public.work_session_audit_log to priteca_attendance_writer;
grant usage, select on all sequences in schema public to priteca_attendance_writer;
grant usage on schema auth to priteca_attendance_writer;
grant select (id) on auth.users to priteca_attendance_writer;
grant execute on function priteca_private.request_actor_id() to priteca_attendance_writer;
grant execute on function public.is_organization_admin(uuid) to priteca_attendance_writer;

alter table public.worker_identity_audit_log enable row level security;
alter table public.work_sessions enable row level security;
alter table public.work_session_audit_log enable row level security;

-- These policies are intentionally only for the NOLOGIN technical writer.
-- Application roles cannot SET ROLE to it; they still need an authorized RPC.
drop policy if exists worker_identity_audit_writer_insert on public.worker_identity_audit_log;
create policy worker_identity_audit_writer_insert
on public.worker_identity_audit_log
for insert to priteca_attendance_writer
with check (true);
drop policy if exists work_sessions_writer_insert on public.work_sessions;
create policy work_sessions_writer_insert
on public.work_sessions
for insert to priteca_attendance_writer
with check (true);
drop policy if exists work_sessions_writer_update on public.work_sessions;
create policy work_sessions_writer_update
on public.work_sessions
for update to priteca_attendance_writer
using (true) with check (true);
drop policy if exists work_session_audit_writer_insert on public.work_session_audit_log;
create policy work_session_audit_writer_insert
on public.work_session_audit_log
for insert to priteca_attendance_writer
with check (true);

create or replace function public.is_current_active_worker(
  p_worker_id uuid,
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.workers w
    join public.organization_members om
      on om.organization_id = w.organization_id
     and om.user_id = auth.uid()
     and om.is_active
     and om.role in ('owner', 'admin', 'employee')
    where w.id = p_worker_id
      and w.organization_id = p_organization_id
      and w.user_id = auth.uid()
      and w.status = 'active'
  );
$$;
alter function public.is_current_active_worker(uuid, uuid) owner to postgres;
revoke all on function public.is_current_active_worker(uuid, uuid) from public, anon;
grant execute on function public.is_current_active_worker(uuid, uuid) to authenticated;

drop policy if exists worker_identity_audit_admin_read on public.worker_identity_audit_log;
create policy worker_identity_audit_admin_read
on public.worker_identity_audit_log
for select to authenticated
using (public.is_organization_admin(organization_id));

drop policy if exists work_sessions_authorized_read on public.work_sessions;
create policy work_sessions_authorized_read
on public.work_sessions
for select to authenticated
using (
  public.is_organization_admin(organization_id)
  or public.is_current_active_worker(worker_id, organization_id)
);

drop policy if exists work_session_audit_authorized_read on public.work_session_audit_log;
create policy work_session_audit_authorized_read
on public.work_session_audit_log
for select to authenticated
using (
  public.is_organization_admin(organization_id)
  or public.is_current_active_worker(worker_id, organization_id)
);

-- Only the controlled identity procedure may change workers.user_id. The GUC
-- is transaction-local and cannot provide a bypass because browser roles have
-- no direct UPDATE privilege on workers.
create or replace function public.prevent_worker_identity_reassignment()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.organization_id <> old.organization_id then
    raise exception 'No se permite reasignar la organizacion de un trabajador.' using errcode = '22023';
  end if;
  if new.user_id is distinct from old.user_id
     and current_setting('priteca.allow_worker_identity_change', true) <> 'on' then
    raise exception 'No se permite reasignar la identidad de un trabajador.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create type public.work_session_transition_result as (
  accepted boolean,
  rejection_code text,
  work_session_id uuid,
  status text,
  revision integer,
  occurred_at timestamptz
);

-- The technical writer deliberately lacks BYPASSRLS. This small, private
-- helper is owned by the migration owner solely so a linked employee can be
-- resolved without granting employees a general workers SELECT policy. It
-- validates the session actor itself and is executable only by that writer.
create or replace function priteca_private.current_active_worker_for_session()
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
    )
  for update;
  if not found then
    raise exception 'No hay una ficha activa vinculada.' using errcode = '42501';
  end if;
  return v_worker;
end;
$$;
alter function priteca_private.current_active_worker_for_session() owner to postgres;
revoke all on function priteca_private.current_active_worker_for_session() from public, anon, authenticated;
grant execute on function priteca_private.current_active_worker_for_session() to priteca_attendance_writer;

grant priteca_attendance_writer to postgres with set true, inherit false;
grant create on schema priteca_private to priteca_attendance_writer;
set local role priteca_attendance_writer;

create or replace function priteca_private.set_worker_identity_with_revision_impl(
  p_worker_id uuid,
  p_expected_revision integer,
  p_target_user_id uuid,
  p_reason text
)
returns public.workers
language plpgsql
security definer
set search_path = pg_catalog, public, priteca_private, auth
as $$
declare
  v_actor uuid;
  v_worker public.workers;
  v_previous_user_id uuid;
  v_reason text;
  v_action text;
begin
  v_actor := priteca_private.request_actor_id();
  if v_actor is null then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;
  if p_worker_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Entrada invalida.' using errcode = '22023';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) not between 3 and 500 then
    raise exception 'El motivo debe tener entre 3 y 500 caracteres.' using errcode = '22023';
  end if;

  select w.* into v_worker
  from public.workers w
  where w.id = p_worker_id
    and public.is_organization_admin(w.organization_id)
  for update;
  if not found or v_worker.revision <> p_expected_revision then
    raise exception 'Conflicto o ficha inaccesible.' using errcode = '40001';
  end if;
  if v_worker.user_id is not distinct from p_target_user_id then
    raise exception 'La vinculacion solicitada ya existe.' using errcode = '22023';
  end if;

  if p_target_user_id is not null then
    if not exists (select 1 from auth.users u where u.id = p_target_user_id) then
      raise exception 'Identidad no disponible.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.organization_members om
      where om.organization_id = v_worker.organization_id
        and om.user_id = p_target_user_id
        and om.is_active
        and om.role in ('owner', 'admin', 'employee')
    ) then
      raise exception 'La identidad no pertenece a la organizacion activa.' using errcode = '22023';
    end if;
  end if;

  v_action := case
    when v_worker.user_id is null then 'linked'
    when p_target_user_id is null then 'unlinked'
    else 'changed'
  end;
  v_previous_user_id := v_worker.user_id;
  perform set_config('priteca.allow_worker_identity_change', 'on', true);
  update public.workers
  set user_id = p_target_user_id
  where id = v_worker.id
    and revision = p_expected_revision
  returning * into v_worker;
  if not found then
    raise exception 'Conflicto o ficha inaccesible.' using errcode = '40001';
  end if;
  insert into public.worker_identity_audit_log (
    organization_id, worker_id, previous_user_id, new_user_id, actor_id, action, reason
  ) values (
    v_worker.organization_id, v_worker.id, v_previous_user_id,
    p_target_user_id, v_actor, v_action, v_reason
  );
  return v_worker;
exception
  when unique_violation then
    raise exception 'La identidad ya esta vinculada a otro trabajador.' using errcode = '22023';
end;
$$;

create or replace function priteca_private.clock_in_current_worker_impl()
returns public.work_session_transition_result
language plpgsql
security definer
set search_path = pg_catalog, public, priteca_private
as $$
declare
  v_actor uuid;
  v_worker public.workers;
  v_session public.work_sessions;
  v_now timestamptz;
begin
  v_actor := priteca_private.request_actor_id();
  if v_actor is null then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select * into v_worker from priteca_private.current_active_worker_for_session();
  select s.* into v_session from public.work_sessions s
  where s.worker_id = v_worker.id and s.status = 'open'
  for update;
  if found then
    insert into public.work_session_audit_log (organization_id, worker_id, work_session_id, actor_id, action)
    values (v_worker.organization_id, v_worker.id, v_session.id, v_actor, 'clock_in_rejected_open');
    return (false, 'open_session_exists', v_session.id, v_session.status, v_session.revision, v_session.clock_in_at)::public.work_session_transition_result;
  end if;
  v_now := clock_timestamp();
  insert into public.work_sessions (organization_id, worker_id, clock_in_at, status, clock_in_actor_id)
  values (v_worker.organization_id, v_worker.id, v_now, 'open', v_actor)
  returning * into v_session;
  insert into public.work_session_audit_log (organization_id, worker_id, work_session_id, actor_id, action)
  values (v_worker.organization_id, v_worker.id, v_session.id, v_actor, 'clocked_in');
  return (true, null, v_session.id, v_session.status, v_session.revision, v_session.clock_in_at)::public.work_session_transition_result;
end;
$$;

create or replace function priteca_private.clock_out_current_worker_impl()
returns public.work_session_transition_result
language plpgsql
security definer
set search_path = pg_catalog, public, priteca_private
as $$
declare
  v_actor uuid;
  v_worker public.workers;
  v_session public.work_sessions;
  v_now timestamptz;
begin
  v_actor := priteca_private.request_actor_id();
  if v_actor is null then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select * into v_worker from priteca_private.current_active_worker_for_session();
  select s.* into v_session from public.work_sessions s
  where s.worker_id = v_worker.id and s.status = 'open'
  for update;
  if not found then
    insert into public.work_session_audit_log (organization_id, worker_id, actor_id, action)
    values (v_worker.organization_id, v_worker.id, v_actor, 'clock_out_rejected_no_open');
    return (false, 'no_open_session', null, null, null, null)::public.work_session_transition_result;
  end if;
  v_now := clock_timestamp();
  update public.work_sessions
  set clock_out_at = v_now, status = 'closed', clock_out_actor_id = v_actor
  where id = v_session.id
  returning * into v_session;
  insert into public.work_session_audit_log (organization_id, worker_id, work_session_id, actor_id, action)
  values (v_worker.organization_id, v_worker.id, v_session.id, v_actor, 'clocked_out');
  return (true, null, v_session.id, v_session.status, v_session.revision, v_session.clock_out_at)::public.work_session_transition_result;
end;
$$;

revoke all on function priteca_private.set_worker_identity_with_revision_impl(uuid, integer, uuid, text) from public, anon;
revoke all on function priteca_private.clock_in_current_worker_impl() from public, anon;
revoke all on function priteca_private.clock_out_current_worker_impl() from public, anon;
grant execute on function priteca_private.set_worker_identity_with_revision_impl(uuid, integer, uuid, text) to authenticated;
grant execute on function priteca_private.clock_in_current_worker_impl() to authenticated;
grant execute on function priteca_private.clock_out_current_worker_impl() to authenticated;

reset role;

create or replace function public.set_worker_identity_with_revision(
  p_worker_id uuid,
  p_expected_revision integer,
  p_target_user_id uuid,
  p_reason text
)
returns public.workers
language sql
security invoker
set search_path = public, priteca_private
as $$
  select priteca_private.set_worker_identity_with_revision_impl(
    p_worker_id, p_expected_revision, p_target_user_id, p_reason
  );
$$;

create or replace function public.clock_in_current_worker()
returns public.work_session_transition_result
language sql
security invoker
set search_path = public, priteca_private
as $$ select priteca_private.clock_in_current_worker_impl(); $$;

create or replace function public.clock_out_current_worker()
returns public.work_session_transition_result
language sql
security invoker
set search_path = public, priteca_private
as $$ select priteca_private.clock_out_current_worker_impl(); $$;

revoke all on function public.set_worker_identity_with_revision(uuid, integer, uuid, text) from public, anon;
revoke all on function public.clock_in_current_worker() from public, anon;
revoke all on function public.clock_out_current_worker() from public, anon;
grant execute on function public.set_worker_identity_with_revision(uuid, integer, uuid, text) to authenticated;
grant execute on function public.clock_in_current_worker() to authenticated;
grant execute on function public.clock_out_current_worker() to authenticated;

revoke create on schema priteca_private from priteca_attendance_writer;
grant priteca_attendance_writer to postgres with set false;
notify pgrst, 'reload schema';
commit;

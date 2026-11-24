-- Fase 2D: provisión administrativa de acceso trabajador–Auth.
-- La cuenta de Auth se crea exclusivamente desde la función Edge privada. Esta
-- migración sólo acepta una identidad cuyo app_metadata fue sellado por ese
-- servidor, y conserva auth.uid() como actor de la vinculación y auditoría.
begin;

create table if not exists public.worker_access_provisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  worker_id uuid not null unique references public.workers(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  expected_revision integer not null check (expected_revision > 0),
  status text not null default 'pending' check (status in ('pending', 'linked')),
  target_user_id uuid unique references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz
);

alter table public.worker_access_provisions enable row level security;
revoke all on public.worker_access_provisions from public, anon, authenticated;

-- Only the narrowly scoped implementation reads auth.users metadata. User
-- metadata is deliberately not used: it is mutable by the account holder.
create or replace function priteca_private.auth_user_has_worker_access_provision(
  p_user_id uuid,
  p_provision_id uuid,
  p_worker_id uuid,
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, auth
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = p_user_id
      and u.raw_app_meta_data ->> 'priteca_worker_access_provision_id' = p_provision_id::text
      and u.raw_app_meta_data ->> 'priteca_worker_access_worker_id' = p_worker_id::text
      and u.raw_app_meta_data ->> 'priteca_worker_access_organization_id' = p_organization_id::text
  );
$$;
alter function priteca_private.auth_user_has_worker_access_provision(uuid, uuid, uuid, uuid) owner to postgres;
revoke all on function priteca_private.auth_user_has_worker_access_provision(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

-- Starting is idempotent for the same authorised administrator. It does not
-- write workers, memberships, identities or audit rows, so an Auth failure
-- leaves only a resumable, server-correlated request.
create or replace function public.begin_worker_access_provision(
  p_worker_id uuid,
  p_expected_revision integer
)
returns public.worker_access_provisions
language plpgsql
security invoker
set search_path = pg_catalog, public, priteca_private
as $$
declare
  v_actor uuid;
  v_worker public.workers;
  v_provision public.worker_access_provisions;
begin
  v_actor := priteca_private.request_actor_id();
  if v_actor is null or p_worker_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'No autorizado o entrada inválida.' using errcode = '42501';
  end if;

  select w.* into v_worker
  from public.workers w
  where w.id = p_worker_id
    and w.status = 'active'
    and public.is_organization_admin(w.organization_id)
  for update;
  if not found then
    raise exception 'Ficha inaccesible.' using errcode = '42501';
  end if;
  if v_worker.user_id is not null then
    raise exception 'La ficha ya tiene acceso vinculado.' using errcode = '22023';
  end if;
  if v_worker.revision <> p_expected_revision then
    raise exception 'La ficha ha cambiado.' using errcode = '40001';
  end if;

  select * into v_provision
  from public.worker_access_provisions
  where worker_id = v_worker.id
  for update;
  if found then
    if v_provision.status <> 'pending' or v_provision.requested_by <> v_actor then
      raise exception 'Existe una provisión pendiente no disponible.' using errcode = '42501';
    end if;
    return v_provision;
  end if;

  insert into public.worker_access_provisions (
    organization_id, worker_id, requested_by, expected_revision
  ) values (
    v_worker.organization_id, v_worker.id, v_actor, p_expected_revision
  ) returning * into v_provision;
  return v_provision;
end;
$$;

-- SECURITY DEFINER is required only to add the new employee membership: the
-- normal RLS matrix reserves membership writes to owners while this operation
-- is intentionally available to active owner/admin users. Every value that
-- grants authority is recovered under the caller's JWT; no organisation or
-- role comes from the Edge request body.
create or replace function priteca_private.finalize_worker_access_provision_impl(
  p_provision_id uuid,
  p_expected_revision integer,
  p_target_user_id uuid,
  p_reason text
)
returns public.workers
language plpgsql
security definer
set search_path = pg_catalog, public, priteca_private
as $$
declare
  v_actor uuid;
  v_provision public.worker_access_provisions;
  v_worker public.workers;
  v_result public.workers;
  v_reason text;
begin
  v_actor := priteca_private.request_actor_id();
  if v_actor is null then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if p_provision_id is null or p_target_user_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Entrada inválida.' using errcode = '22023';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) not between 3 and 500 then
    raise exception 'El motivo debe tener entre 3 y 500 caracteres.' using errcode = '22023';
  end if;

  select * into v_provision
  from public.worker_access_provisions
  where id = p_provision_id and status = 'pending' and requested_by = v_actor
  for update;
  if not found then raise exception 'Provisión inaccesible.' using errcode = '42501'; end if;

  select w.* into v_worker
  from public.workers w
  where w.id = v_provision.worker_id
    and w.organization_id = v_provision.organization_id
    and w.status = 'active'
    and w.user_id is null
    and public.is_organization_admin(w.organization_id)
  for update;
  if not found or v_worker.revision <> p_expected_revision then
    raise exception 'Conflicto o ficha inaccesible.' using errcode = '40001';
  end if;
  if not priteca_private.auth_user_has_worker_access_provision(
    p_target_user_id, v_provision.id, v_worker.id, v_worker.organization_id
  ) then
    raise exception 'La identidad no pertenece a esta provisión.' using errcode = '42501';
  end if;
  if exists (select 1 from public.workers w where w.user_id = p_target_user_id) then
    raise exception 'La identidad ya está vinculada a otro trabajador.' using errcode = '22023';
  end if;

  -- A pre-existing membership must already be the same ordinary employee.
  if exists (select 1 from public.organization_members om where om.user_id = p_target_user_id) then
    if not exists (
      select 1 from public.organization_members om
      where om.organization_id = v_worker.organization_id
        and om.user_id = p_target_user_id
        and om.role = 'employee'
        and om.is_active
    ) then
      raise exception 'La identidad ya pertenece a otro ámbito.' using errcode = '42501';
    end if;
  else
    insert into public.organization_members (organization_id, user_id, role, is_active)
    values (v_worker.organization_id, p_target_user_id, 'employee', true);
  end if;

  -- Reuse the established 2A operation so revision checking, actor capture,
  -- protected identity write and worker_identity_audit_log stay identical.
  select * into v_result
  from priteca_private.set_worker_identity_with_revision_impl(
    v_worker.id, p_expected_revision, p_target_user_id, v_reason
  );

  update public.worker_access_provisions
  set status = 'linked', target_user_id = p_target_user_id, completed_at = clock_timestamp()
  where id = v_provision.id;
  return v_result;
end;
$$;
alter function priteca_private.finalize_worker_access_provision_impl(uuid, integer, uuid, text) owner to postgres;
revoke all on function priteca_private.finalize_worker_access_provision_impl(uuid, integer, uuid, text)
  from public, anon, authenticated;

create or replace function public.finalize_worker_access_provision(
  p_provision_id uuid,
  p_expected_revision integer,
  p_target_user_id uuid,
  p_reason text
)
returns public.workers
language sql
security invoker
set search_path = public, priteca_private
as $$
  select priteca_private.finalize_worker_access_provision_impl(
    p_provision_id, p_expected_revision, p_target_user_id, p_reason
  );
$$;

revoke all on function public.begin_worker_access_provision(uuid, integer) from public, anon;
revoke all on function public.finalize_worker_access_provision(uuid, integer, uuid, text) from public, anon;
grant execute on function public.begin_worker_access_provision(uuid, integer) to authenticated;
grant execute on function public.finalize_worker_access_provision(uuid, integer, uuid, text) to authenticated;
notify pgrst, 'reload schema';
commit;

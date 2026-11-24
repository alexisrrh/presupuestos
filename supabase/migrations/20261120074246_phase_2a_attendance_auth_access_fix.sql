-- The migration executor has a grantable SELECT on auth.users but does not
-- own the auth schema. Keep that schema inaccessible to the technical writer:
-- this owner-controlled predicate discloses only existence to the already
-- authorised linking procedure.
begin;

create or replace function priteca_private.auth_user_exists(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, auth
as $$
  select p_user_id is not null and exists (select 1 from auth.users where id = p_user_id);
$$;
alter function priteca_private.auth_user_exists(uuid) owner to postgres;
revoke all on function priteca_private.auth_user_exists(uuid) from public, anon, authenticated;
grant execute on function priteca_private.auth_user_exists(uuid) to priteca_attendance_writer;

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
set search_path = pg_catalog, public, priteca_private
as $$
declare
  v_actor uuid;
  v_worker public.workers;
  v_previous_user_id uuid;
  v_reason text;
  v_action text;
begin
  v_actor := priteca_private.request_actor_id();
  if v_actor is null then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if p_worker_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Entrada invalida.' using errcode = '22023';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) not between 3 and 500 then
    raise exception 'El motivo debe tener entre 3 y 500 caracteres.' using errcode = '22023';
  end if;
  select w.* into v_worker
  from public.workers w
  where w.id = p_worker_id and public.is_organization_admin(w.organization_id)
  for update;
  if not found or v_worker.revision <> p_expected_revision then
    raise exception 'Conflicto o ficha inaccesible.' using errcode = '40001';
  end if;
  if v_worker.user_id is not distinct from p_target_user_id then
    raise exception 'La vinculacion solicitada ya existe.' using errcode = '22023';
  end if;
  if p_target_user_id is not null then
    if not priteca_private.auth_user_exists(p_target_user_id) then
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
  v_action := case when v_worker.user_id is null then 'linked' when p_target_user_id is null then 'unlinked' else 'changed' end;
  v_previous_user_id := v_worker.user_id;
  perform set_config('priteca.allow_worker_identity_change', 'on', true);
  update public.workers set user_id = p_target_user_id
  where id = v_worker.id and revision = p_expected_revision
  returning * into v_worker;
  if not found then raise exception 'Conflicto o ficha inaccesible.' using errcode = '40001'; end if;
  insert into public.worker_identity_audit_log (organization_id, worker_id, previous_user_id, new_user_id, actor_id, action, reason)
  values (v_worker.organization_id, v_worker.id, v_previous_user_id, p_target_user_id, v_actor, v_action, v_reason);
  return v_worker;
exception when unique_violation then
  raise exception 'La identidad ya esta vinculada a otro trabajador.' using errcode = '22023';
end;
$$;

reset role;
revoke create on schema priteca_private from priteca_attendance_writer;
grant priteca_attendance_writer to postgres with set false;
notify pgrst, 'reload schema';
commit;

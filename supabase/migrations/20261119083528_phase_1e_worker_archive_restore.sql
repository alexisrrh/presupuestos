-- Fase 1E: transiciones de archivo sin borrado físico.
-- La escritura directa de workers continúa revocada para authenticated. Las
-- implementaciones privadas son SECURITY DEFINER porque el rol técnico es el
-- único que conserva UPDATE; cada llamada recupera el actor de la sesión y
-- comprueba organización y rol antes de bloquear/modificar la fila.
begin;

alter table public.workers
  add column if not exists archived_previous_status text;

alter table public.workers
  drop constraint if exists workers_archived_previous_status_check;
alter table public.workers
  add constraint workers_archived_previous_status_check
  check (archived_previous_status is null or archived_previous_status in ('draft', 'active'));

-- The audit trigger reads an operation-scoped reason only for archive/recover
-- transitions. Generic edits cannot turn a caller-provided setting into an
-- audit reason, and the actor still comes from the authenticated request.
create or replace function public.audit_worker_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_action text;
  v_reason text;
begin
  v_action := case
    when tg_op = 'INSERT' then 'created'
    when old.status <> 'archived' and new.status = 'archived' then 'archived'
    when old.status = 'archived' and new.status <> 'archived' then 'recovered'
    else 'updated'
  end;

  v_reason := case
    when v_action in ('archived', 'recovered')
      then nullif(current_setting('priteca.worker_audit_reason', true), '')
    else null
  end;

  insert into public.worker_audit_log (organization_id, worker_id, actor_id, action, reason)
  values (new.organization_id, new.id, auth.uid(), v_action, v_reason);
  return new;
end;
$$;

grant priteca_worker_writer to postgres with set true, inherit false;
grant create on schema priteca_private to priteca_worker_writer;
set local role priteca_worker_writer;

create or replace function priteca_private.archive_worker_with_revision_impl(
  p_worker_id uuid,
  p_expected_revision integer,
  p_reason text
)
returns public.workers
language plpgsql
security definer
set search_path = pg_catalog, public, priteca_private
as $$
declare
  v_worker public.workers;
  v_actor uuid;
  v_reason text;
begin
  v_actor := priteca_private.request_actor_id();
  if v_actor is null then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;
  if p_worker_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Entrada invalida.' using errcode = '22023';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if length(v_reason) not between 3 and 500 then
    raise exception 'El motivo debe tener entre 3 y 500 caracteres.' using errcode = '22023';
  end if;

  select w.*
    into v_worker
  from public.workers w
  where w.id = p_worker_id
    and public.is_organization_admin(w.organization_id)
  for update;
  if not found or v_worker.revision <> p_expected_revision then
    raise exception 'Conflicto o ficha inaccesible.' using errcode = '40001';
  end if;
  if v_worker.status = 'archived' then
    raise exception 'La ficha ya está archivada.' using errcode = '22023';
  end if;

  perform set_config('priteca.worker_audit_reason', v_reason, true);
  update public.workers
  set status = 'archived',
      archived_at = clock_timestamp(),
      archived_reason = v_reason,
      archived_previous_status = v_worker.status
  where id = v_worker.id
    and revision = p_expected_revision
  returning * into v_worker;
  if not found then
    raise exception 'Conflicto o ficha inaccesible.' using errcode = '40001';
  end if;
  return v_worker;
end;
$$;

create or replace function priteca_private.restore_worker_with_revision_impl(
  p_worker_id uuid,
  p_expected_revision integer,
  p_reason text
)
returns public.workers
language plpgsql
security definer
set search_path = pg_catalog, public, priteca_private
as $$
declare
  v_worker public.workers;
  v_actor uuid;
  v_reason text;
begin
  v_actor := priteca_private.request_actor_id();
  if v_actor is null then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;
  if p_worker_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Entrada invalida.' using errcode = '22023';
  end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if length(v_reason) not between 3 and 500 then
    raise exception 'El motivo debe tener entre 3 y 500 caracteres.' using errcode = '22023';
  end if;

  select w.*
    into v_worker
  from public.workers w
  where w.id = p_worker_id
    and public.is_organization_admin(w.organization_id)
  for update;
  if not found or v_worker.revision <> p_expected_revision then
    raise exception 'Conflicto o ficha inaccesible.' using errcode = '40001';
  end if;
  if v_worker.status <> 'archived' then
    raise exception 'La ficha no está archivada.' using errcode = '22023';
  end if;

  perform set_config('priteca.worker_audit_reason', v_reason, true);
  update public.workers
  set status = coalesce(v_worker.archived_previous_status, 'active'),
      archived_at = null,
      archived_reason = null,
      archived_previous_status = null
  where id = v_worker.id
    and revision = p_expected_revision
  returning * into v_worker;
  if not found then
    raise exception 'Conflicto o ficha inaccesible.' using errcode = '40001';
  end if;
  return v_worker;
end;
$$;

revoke all on function priteca_private.archive_worker_with_revision_impl(uuid, integer, text) from public, anon;
revoke all on function priteca_private.restore_worker_with_revision_impl(uuid, integer, text) from public, anon;
grant execute on function priteca_private.archive_worker_with_revision_impl(uuid, integer, text) to authenticated;
grant execute on function priteca_private.restore_worker_with_revision_impl(uuid, integer, text) to authenticated;
reset role;

create or replace function public.archive_worker_with_revision(
  p_worker_id uuid,
  p_expected_revision integer,
  p_reason text
)
returns public.workers
language sql
security invoker
set search_path = public, priteca_private
as $$
  select priteca_private.archive_worker_with_revision_impl(p_worker_id, p_expected_revision, p_reason);
$$;

create or replace function public.restore_worker_with_revision(
  p_worker_id uuid,
  p_expected_revision integer,
  p_reason text
)
returns public.workers
language sql
security invoker
set search_path = public, priteca_private
as $$
  select priteca_private.restore_worker_with_revision_impl(p_worker_id, p_expected_revision, p_reason);
$$;

revoke all on function public.archive_worker_with_revision(uuid, integer, text) from public, anon;
revoke all on function public.restore_worker_with_revision(uuid, integer, text) from public, anon;
grant execute on function public.archive_worker_with_revision(uuid, integer, text) to authenticated;
grant execute on function public.restore_worker_with_revision(uuid, integer, text) to authenticated;

revoke create on schema priteca_private from priteca_worker_writer;
grant priteca_worker_writer to postgres with set false;
commit;

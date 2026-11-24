\set ON_ERROR_STOP on

-- Prerrequisito reproducible: .local/priteca-e2e/seed-fixtures.sql en la
-- instancia E2E aislada. Todos los IDs y usuarios son ficticios.
begin;

create function pg_temp.phase1e_assert(v boolean, m text) returns void
language plpgsql as $$
begin
  if v is distinct from true then
    raise exception 'FALLO: %', m;
  end if;
end;
$$;

create temp table archive_snapshot as
select
  w.id,
  to_jsonb(w) as worker_json,
  w.revision,
  coalesce(array_agg(a.id) filter (where a.id is not null), '{}'::bigint[]) as audit_ids
from public.workers w
left join public.worker_audit_log a on a.worker_id = w.id
where w.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
group by w.id, w.revision;
grant select on archive_snapshot to authenticated;

-- Owner A archives. The audit actor must be the session actor, never the
-- technical writer role; the worker remains physically present.
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select pg_temp.phase1e_assert(
  current_user = 'authenticated' and auth.uid() = '11111111-1111-1111-1111-111111111111'::uuid,
  'owner identity'
);
select pg_temp.phase1e_assert(
  (public.archive_worker_with_revision(
    (select id from archive_snapshot),
    (select revision from archive_snapshot),
    'Archivo E2E autorizado'
  )).status = 'archived',
  'owner archives worker'
);
reset role;
select pg_temp.phase1e_assert(
  exists (select 1 from public.workers where id = (select id from archive_snapshot) and status = 'archived'),
  'archive retains the worker row'
);
select pg_temp.phase1e_assert(
  (select revision from public.workers where id = (select id from archive_snapshot)) = (select revision + 1 from archive_snapshot),
  'archive increments revision exactly once'
);
select pg_temp.phase1e_assert(
  (select count(*) from public.worker_audit_log where worker_id = (select id from archive_snapshot) and id not in (select unnest(audit_ids) from archive_snapshot)) = 1,
  'archive emits exactly one new audit event'
);
select pg_temp.phase1e_assert(
  exists (
    select 1 from public.worker_audit_log
    where worker_id = (select id from archive_snapshot)
      and id not in (select unnest(audit_ids) from archive_snapshot)
      and action = 'archived'
      and actor_id = '11111111-1111-1111-1111-111111111111'::uuid
      and reason = 'Archivo E2E autorizado'
  ),
  'archive audit has the authenticated owner and reason'
);

update archive_snapshot
set worker_json = (select to_jsonb(w) from public.workers w where w.id = archive_snapshot.id),
    revision = (select w.revision from public.workers w where w.id = archive_snapshot.id),
    audit_ids = (select coalesce(array_agg(a.id), '{}'::bigint[]) from public.worker_audit_log a where a.worker_id = archive_snapshot.id);

-- Admin A restores to the recorded pre-archive status.
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select pg_temp.phase1e_assert(
  current_user = 'authenticated' and auth.uid() = '22222222-2222-2222-2222-222222222222'::uuid,
  'admin identity'
);
select pg_temp.phase1e_assert(
  (public.restore_worker_with_revision(
    (select id from archive_snapshot),
    (select revision from archive_snapshot),
    'Recuperación E2E autorizada'
  )).status = 'active',
  'admin restores the recorded active status'
);
reset role;
select pg_temp.phase1e_assert(
  (select revision from public.workers where id = (select id from archive_snapshot)) = (select revision + 1 from archive_snapshot),
  'restore increments revision exactly once'
);
select pg_temp.phase1e_assert(
  exists (
    select 1 from public.worker_audit_log
    where worker_id = (select id from archive_snapshot)
      and id not in (select unnest(audit_ids) from archive_snapshot)
      and action = 'recovered'
      and actor_id = '22222222-2222-2222-2222-222222222222'::uuid
      and reason = 'Recuperación E2E autorizada'
  ),
  'restore audit has the authenticated admin and reason'
);

update archive_snapshot
set worker_json = (select to_jsonb(w) from public.workers w where w.id = archive_snapshot.id),
    revision = (select w.revision from public.workers w where w.id = archive_snapshot.id),
    audit_ids = (select coalesce(array_agg(a.id), '{}'::bigint[]) from public.worker_audit_log a where a.worker_id = archive_snapshot.id);

-- An old revision, direct UPDATE, employee, cross-organisation owner and anon
-- all leave the full row and audit unchanged. These are deliberately narrow
-- exception handlers: any SQLSTATE other than the specified outcome fails.
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
do $$
begin
  begin
    perform public.archive_worker_with_revision((select id from archive_snapshot), (select revision - 1 from archive_snapshot), 'Conflicto de prueba');
    raise exception 'FALLO: stale archive accepted';
  exception when serialization_failure then null;
  end;
  begin
    update public.workers set status = 'archived' where id = (select id from archive_snapshot);
    raise exception 'FALLO: direct update accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select pg_temp.phase1e_assert(current_user = 'authenticated' and auth.uid() = '33333333-3333-3333-3333-333333333333'::uuid, 'employee identity');
do $$
begin
  begin
    perform public.archive_worker_with_revision((select id from archive_snapshot), (select revision from archive_snapshot), 'Employee no autorizado');
    raise exception 'FALLO: employee archive accepted';
  exception when serialization_failure then null;
  end;
  begin
    perform priteca_private.archive_worker_with_revision_impl((select id from archive_snapshot), (select revision from archive_snapshot), 'Bypass privado empleado');
    raise exception 'FALLO: employee private archive accepted';
  exception when serialization_failure then null;
  end;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
select pg_temp.phase1e_assert(current_user = 'authenticated' and auth.uid() = '44444444-4444-4444-4444-444444444444'::uuid, 'other organization identity');
do $$
begin
  begin
    perform public.archive_worker_with_revision((select id from archive_snapshot), (select revision from archive_snapshot), 'Organización ajena');
    raise exception 'FALLO: cross-organization archive accepted';
  exception when serialization_failure then null;
  end;
end;
$$;
reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.phase1e_assert(current_user = 'anon' and auth.uid() is null, 'anon identity');
do $$
begin
  begin
    perform public.archive_worker_with_revision((select id from archive_snapshot), (select revision from archive_snapshot), 'Anon no autorizado');
    raise exception 'FALLO: anon archive accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select pg_temp.phase1e_assert(
  (select to_jsonb(w) from public.workers w where w.id = (select id from archive_snapshot)) = (select worker_json from archive_snapshot),
  'all rejected archive attempts keep the complete worker'
);
select pg_temp.phase1e_assert(
  (select w.revision from public.workers w where w.id = (select id from archive_snapshot)) = (select revision from archive_snapshot),
  'all rejected archive attempts keep revision'
);
select pg_temp.phase1e_assert(
  (select coalesce(array_agg(a.id), '{}'::bigint[]) from public.worker_audit_log a where a.worker_id = (select id from archive_snapshot)) = (select audit_ids from archive_snapshot),
  'all rejected archive attempts keep audit history'
);
select pg_temp.phase1e_assert(
  not has_function_privilege('anon', 'public.archive_worker_with_revision(uuid,integer,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.restore_worker_with_revision(uuid,integer,text)', 'EXECUTE'),
  'anon has no archive or restore EXECUTE privilege'
);
select pg_temp.phase1e_assert(
  not has_table_privilege('authenticated', 'public.workers', 'UPDATE'),
  'authenticated retains no direct workers UPDATE privilege'
);

rollback;
select 'phase1e_worker_archive_restore: OK' as result;

\set ON_ERROR_STOP on

-- Phase 2A integration/security suite. Fixtures are fully fictitious and are
-- rolled back, so the E2E database remains reusable by the 1C–1E suites.
begin;

create function pg_temp.phase2a_assert(v boolean, m text) returns void
language plpgsql as $$
begin
  if v is distinct from true then
    raise exception 'FALLO: %', m;
  end if;
end;
$$;

-- Dedicated Auth identities, two organisations and valid workers.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('91000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase2a-owner-a@example.test', 'x', '{}', '{}', now(), now()),
  ('91000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase2a-admin-a@example.test', 'x', '{}', '{}', now(), now()),
  ('91000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase2a-employee-a@example.test', 'x', '{}', '{}', now(), now()),
  ('91000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase2a-employee2-a@example.test', 'x', '{}', '{}', now(), now()),
  ('91000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase2a-inactive-a@example.test', 'x', '{}', '{}', now(), now()),
  ('92000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase2a-owner-b@example.test', 'x', '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into public.organizations (id, name, created_by)
values
  ('a2000000-0000-0000-0000-000000000001', 'Fase 2A Organización A', '91000000-0000-0000-0000-000000000001'),
  ('b2000000-0000-0000-0000-000000000001', 'Fase 2A Organización B', '92000000-0000-0000-0000-000000000001');

insert into public.organization_members (organization_id, user_id, role, is_active)
values
  ('a2000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'owner', true),
  ('a2000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002', 'admin', true),
  ('a2000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000003', 'employee', true),
  ('a2000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000004', 'employee', true),
  ('a2000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000005', 'employee', false),
  ('b2000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 'owner', true);

insert into public.workers (id, organization_id, employee_code, document_type, document_normalized, first_name, last_name, email, phone, status)
values
  ('a2010000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'P2A-001', 'DNI', '00000000T', 'Elena', 'Fichaje', 'elena@example.test', '600001001', 'active'),
  ('a2010000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'P2A-002', 'DNI', '00000001R', 'Mateo', 'Olvido', 'mateo@example.test', '600001002', 'active'),
  ('b2010000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'P2B-001', 'DNI', '00000002W', 'Berta', 'Ajena', 'berta@example.test', '600002001', 'active');

create temp table phase2a_snapshot (
  worker_id uuid primary key,
  worker_json jsonb not null,
  revision integer not null,
  identity_audit jsonb not null,
  session_audit jsonb not null
);
grant select on phase2a_snapshot to authenticated;

-- Owner links a same-org authenticated employee. This is also a real
-- revision-controlled change, and records both worker and identity audits.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select pg_temp.phase2a_assert(current_user = 'authenticated' and auth.uid() = '91000000-0000-0000-0000-000000000001'::uuid, 'owner A identity');
select pg_temp.phase2a_assert(
  (public.set_worker_identity_with_revision(
    'a2010000-0000-0000-0000-000000000001', 1,
    '91000000-0000-0000-0000-000000000003', 'Vinculación inicial de prueba'
  )).user_id = '91000000-0000-0000-0000-000000000003'::uuid,
  'owner links same-organization identity'
);
reset role;
select pg_temp.phase2a_assert(
  (select revision from public.workers where id = 'a2010000-0000-0000-0000-000000000001') = 2,
  'link increments worker revision once'
);
select pg_temp.phase2a_assert(
  exists (select 1 from public.worker_identity_audit_log where worker_id = 'a2010000-0000-0000-0000-000000000001'
    and action = 'linked' and actor_id = '91000000-0000-0000-0000-000000000001'::uuid
    and new_user_id = '91000000-0000-0000-0000-000000000003'::uuid),
  'link audit records server session actor and reason'
);

-- An active admin can change and unlink, then the owner restores the link.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);
select pg_temp.phase2a_assert(current_user = 'authenticated' and auth.uid() = '91000000-0000-0000-0000-000000000002'::uuid, 'admin A identity');
select pg_temp.phase2a_assert(
  (public.set_worker_identity_with_revision('a2010000-0000-0000-0000-000000000001', 2, '91000000-0000-0000-0000-000000000004', 'Cambio de identidad autorizado')).user_id = '91000000-0000-0000-0000-000000000004'::uuid,
  'admin changes identity with revision'
);
select pg_temp.phase2a_assert(
  (public.set_worker_identity_with_revision('a2010000-0000-0000-0000-000000000001', 3, null, 'Desvinculación autorizada')).user_id is null,
  'admin unlinks with mandatory reason'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select pg_temp.phase2a_assert(
  (public.set_worker_identity_with_revision('a2010000-0000-0000-0000-000000000001', 4, '91000000-0000-0000-0000-000000000003', 'Vinculación para fichaje')).user_id = '91000000-0000-0000-0000-000000000003'::uuid,
  'owner restores linked employee'
);
reset role;
select pg_temp.phase2a_assert(
  (select count(*) from public.worker_identity_audit_log where worker_id = 'a2010000-0000-0000-0000-000000000001') = 4,
  'all link, change and unlink events are retained'
);

-- Snapshot after valid mutations. All rejected operations below must keep it.
insert into phase2a_snapshot
select w.id, to_jsonb(w), w.revision,
       coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.worker_identity_audit_log i where i.worker_id = w.id), '[]'::jsonb),
       coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.work_session_audit_log a where a.worker_id = w.id), '[]'::jsonb)
from public.workers w where w.id = 'a2010000-0000-0000-0000-000000000001';

-- Employee, inactive member and cross-org owner cannot bypass the linking RPC.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000003', true);
select pg_temp.phase2a_assert(current_user = 'authenticated' and auth.uid() = '91000000-0000-0000-0000-000000000003'::uuid, 'employee identity');
do $$ begin
  begin
    perform public.set_worker_identity_with_revision('a2010000-0000-0000-0000-000000000001', 5, '91000000-0000-0000-0000-000000000004', 'Autovinculación indebida');
    raise exception 'FALLO: employee changed identity';
  exception when serialization_failure then null;
  end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000005', true);
select pg_temp.phase2a_assert(current_user = 'authenticated' and auth.uid() = '91000000-0000-0000-0000-000000000005'::uuid, 'inactive identity');
do $$ begin
  begin
    perform public.set_worker_identity_with_revision('a2010000-0000-0000-0000-000000000001', 5, null, 'Inactivo no autorizado');
    raise exception 'FALLO: inactive member changed identity';
  exception when serialization_failure then null;
  end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-0000-0000-000000000001', true);
select pg_temp.phase2a_assert(current_user = 'authenticated' and auth.uid() = '92000000-0000-0000-0000-000000000001'::uuid, 'owner B identity');
do $$ begin
  begin
    perform public.set_worker_identity_with_revision('a2010000-0000-0000-0000-000000000001', 5, null, 'Organización ajena');
    raise exception 'FALLO: other organization changed identity';
  exception when serialization_failure then null;
  end;
end $$;
reset role;

-- Owner cannot link an identity from B, nor link an identity more than once.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
do $$ begin
  begin
    perform public.set_worker_identity_with_revision('a2010000-0000-0000-0000-000000000001', 5, '92000000-0000-0000-0000-000000000001', 'Cruce entre organizaciones');
    raise exception 'FALLO: cross-organization identity linked';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_worker_identity_with_revision('a2010000-0000-0000-0000-000000000002', 1, '91000000-0000-0000-0000-000000000003', 'Duplicado de identidad');
    raise exception 'FALLO: one identity linked to two workers';
  exception when invalid_parameter_value then null;
  end;
  begin
    update public.workers set user_id = '91000000-0000-0000-0000-000000000004' where id = 'a2010000-0000-0000-0000-000000000001';
    raise exception 'FALLO: direct worker identity UPDATE accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select pg_temp.phase2a_assert(
  (select to_jsonb(w) from public.workers w where w.id = (select worker_id from phase2a_snapshot)) = (select worker_json from phase2a_snapshot)
  and (select revision from public.workers w where w.id = (select worker_id from phase2a_snapshot)) = (select revision from phase2a_snapshot)
  and (select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]'::jsonb) from public.worker_identity_audit_log i where i.worker_id = (select worker_id from phase2a_snapshot)) = (select identity_audit from phase2a_snapshot),
  'all rejected identity operations retain worker revision and identity audit'
);

-- The linked employee clocks in. The database, not the browser, selects the
-- worker, organisation and timestamp. It returns an explicit rejection result
-- for normal state conflicts so that a future mobile UI can explain it.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000003', true);
select pg_temp.phase2a_assert(current_user = 'authenticated' and auth.uid() = '91000000-0000-0000-0000-000000000003'::uuid, 'clocking employee identity');
create temp table clock_result as
select * from public.clock_in_current_worker();
grant select on clock_result to authenticated;
select pg_temp.phase2a_assert((select accepted and status = 'open' and revision = 1 and rejection_code is null from clock_result), 'employee clocks in once');
create temp table double_in_result as
select * from public.clock_in_current_worker();
grant select on double_in_result to authenticated;
select pg_temp.phase2a_assert(
  not (select accepted from double_in_result)
  and (select rejection_code from double_in_result) = 'open_session_exists',
  'double clock-in is rejected without another open session'
);
reset role;
select pg_temp.phase2a_assert(
  (select count(*) from public.work_sessions where worker_id = 'a2010000-0000-0000-0000-000000000001' and status = 'open') = 1,
  'unique open-session invariant remains true'
);
select pg_temp.phase2a_assert(
  exists (select 1 from public.work_session_audit_log where worker_id = 'a2010000-0000-0000-0000-000000000001'
    and action = 'clocked_in' and actor_id = '91000000-0000-0000-0000-000000000003'::uuid)
  and exists (select 1 from public.work_session_audit_log where worker_id = 'a2010000-0000-0000-0000-000000000001'
    and action = 'clock_in_rejected_open' and actor_id = '91000000-0000-0000-0000-000000000003'::uuid),
  'accepted and rejected clock-in attempts are audited with session actor'
);

-- Close the same open session and prove its revision advances exactly once.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000003', true);
create temp table clock_out_result as select * from public.clock_out_current_worker();
grant select on clock_out_result to authenticated;
select pg_temp.phase2a_assert((select accepted and status = 'closed' and revision = 2 from clock_out_result), 'employee clocks out');
create temp table no_open_result as select * from public.clock_out_current_worker();
grant select on no_open_result to authenticated;
select pg_temp.phase2a_assert(
  not (select accepted from no_open_result)
  and (select rejection_code from no_open_result) = 'no_open_session',
  'clock-out without an open session is rejected'
);
reset role;
select pg_temp.phase2a_assert(
  exists (select 1 from public.work_sessions where id = (select work_session_id from clock_result)
    and status = 'closed' and revision = 2 and clock_out_at >= clock_in_at),
  'closed session retains real entry, exit and revision'
);

-- A pre-existing open session crossing UTC midnight may close normally; no
-- process auto-closes it. A separate open session remains open when forgotten.
insert into public.work_sessions (id, organization_id, worker_id, clock_in_at, status, clock_in_actor_id)
values ('a2020000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a2010000-0000-0000-0000-000000000001', clock_timestamp() - interval '26 hours', 'open', '91000000-0000-0000-0000-000000000003');
insert into public.workers (id, organization_id, user_id, employee_code, document_type, document_normalized, first_name, last_name, status)
values ('a2010000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000004', 'P2A-003', 'DNI', '00000003A', 'Laura', 'Abierta', 'active');
insert into public.work_sessions (id, organization_id, worker_id, clock_in_at, status, clock_in_actor_id)
values ('a2020000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'a2010000-0000-0000-0000-000000000003', clock_timestamp() - interval '2 hours', 'open', '91000000-0000-0000-0000-000000000004');
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000003', true);
create temp table cross_midnight_result as select * from public.clock_out_current_worker();
grant select on cross_midnight_result to authenticated;
select pg_temp.phase2a_assert((select accepted and status = 'closed' from cross_midnight_result), 'cross-midnight session can close');
reset role;
select pg_temp.phase2a_assert(
  (select clock_in_at::date < clock_out_at::date from public.work_sessions where id = 'a2020000-0000-0000-0000-000000000001'),
  'cross-midnight timestamps are retained'
);
select pg_temp.phase2a_assert(
  exists (select 1 from public.work_sessions where id = 'a2020000-0000-0000-0000-000000000002' and status = 'open' and clock_out_at is null),
  'forgotten session remains open; no exit is invented'
);

-- Direct DML and RLS are denied; employee A sees only their own sessions,
-- while the B session is invisible. Anon cannot call or read the feature.
insert into public.work_sessions (id, organization_id, worker_id, clock_in_at, status, clock_in_actor_id)
values ('b2020000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'b2010000-0000-0000-0000-000000000001', clock_timestamp(), 'open', '92000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000003', true);
do $$ begin
  begin
    insert into public.work_sessions (organization_id, worker_id, clock_in_at, status) values ('a2000000-0000-0000-0000-000000000001', 'a2010000-0000-0000-0000-000000000001', clock_timestamp(), 'open');
    raise exception 'FALLO: direct work-session insert accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.work_session_audit_log (organization_id, worker_id, actor_id, action) values ('a2000000-0000-0000-0000-000000000001', 'a2010000-0000-0000-0000-000000000001', auth.uid(), 'clocked_in');
    raise exception 'FALLO: direct work-session audit insert accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.phase2a_assert((select count(*) from public.work_sessions where organization_id = 'b2000000-0000-0000-0000-000000000001') = 0, 'employee cannot read organisation B sessions');
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.phase2a_assert(current_user = 'anon' and auth.uid() is null, 'anon identity');
do $$ begin
  begin
    perform public.clock_in_current_worker();
    raise exception 'FALLO: anon clock-in accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pg_temp.phase2a_assert(
  not has_table_privilege('authenticated', 'public.work_sessions', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.work_session_audit_log', 'INSERT,UPDATE,DELETE')
  and not has_function_privilege('anon', 'public.clock_in_current_worker()', 'EXECUTE')
  and not pg_has_role('authenticated', 'priteca_attendance_writer', 'member')
  and not pg_has_role('authenticated', 'priteca_attendance_writer', 'usage'),
  'application roles retain no direct write or technical-role privilege'
);

rollback;
select 'phase2a_time_tracking: OK' as result;

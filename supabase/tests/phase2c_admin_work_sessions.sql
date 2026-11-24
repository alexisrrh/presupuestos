\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_condition is distinct from true then
    raise exception 'FALLO: %', p_message;
  end if;
end;
$$;

-- These dedicated fixtures are rolled back. Auth/users and organisations are
-- prepared by .local/priteca-e2e/seed-fixtures.sql, while application calls
-- below always run as authenticated or anon, never postgres.
delete from public.work_session_audit_log where work_session_id in (
  'c2010000-0000-0000-0000-000000000001',
  'c2010000-0000-0000-0000-000000000002',
  'c2020000-0000-0000-0000-000000000001'
);
delete from public.work_sessions where id in (
  'c2010000-0000-0000-0000-000000000001',
  'c2010000-0000-0000-0000-000000000002',
  'c2020000-0000-0000-0000-000000000001'
);
insert into public.work_sessions (id, organization_id, worker_id, clock_in_at, clock_out_at, status, clock_in_actor_id, clock_out_actor_id)
values
  ('c2010000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '2026-11-20 08:00+00', '2026-11-20 16:00+00', 'closed', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111'),
  ('c2010000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '2026-11-21 08:00+00', null, 'open', '33333333-3333-3333-3333-333333333333', null),
  ('c2020000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '2026-11-20 08:00+00', '2026-11-20 16:00+00', 'closed', '44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444');

-- Owner lists only their own organisation through the SECURITY INVOKER read
-- projection, then corrects the entry atomically with a non-empty reason.
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select pg_temp.assert_true(current_user = 'authenticated' and auth.uid() = '11111111-1111-1111-1111-111111111111'::uuid, 'owner identity');
select pg_temp.assert_true(
  (select count(*) from public.admin_list_work_sessions()) = 2,
  'owner lists exactly organisation A sessions'
);
create temp table corrected as
select * from public.admin_update_work_session_with_revision(
  'c2010000-0000-0000-0000-000000000001', 1, 'correct',
  '{"clock_in_at":"2026-11-20T07:30:00Z"}'::jsonb, 'Corrección de entrada comunicada'
);
grant select on corrected to authenticated;
select pg_temp.assert_true(
  (select revision = 2 and clock_in_at = '2026-11-20 07:30+00'::timestamptz from corrected),
  'owner correction persists and increments revision once'
);
select pg_temp.assert_true(
  exists (select 1 from public.work_session_audit_log where work_session_id = 'c2010000-0000-0000-0000-000000000001'
    and action = 'admin_corrected' and actor_id = auth.uid()
    and reason = 'Corrección de entrada comunicada' and resulting_revision = 2
    and previous_values ->> 'clock_in_at' like '2026-11-20T08:00:00%'
    and next_values ->> 'clock_in_at' like '2026-11-20T07:30:00%'),
  'correction audit retains actor reason before after and resulting revision'
);
reset role;

-- A stale write, blank reason and direct DML leave both row and audit intact.
create temp table protected_snapshot as
select to_jsonb(s) as session_json,
       coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb) as audit_json
from public.work_sessions s
left join public.work_session_audit_log a on a.work_session_id = s.id
where s.id = 'c2010000-0000-0000-0000-000000000001'
group by s.id;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select pg_temp.assert_true(current_user = 'authenticated' and auth.uid() = '22222222-2222-2222-2222-222222222222'::uuid, 'admin identity');
do $$ begin
  begin
    perform public.admin_update_work_session_with_revision('c2010000-0000-0000-0000-000000000001', 1, 'correct', '{"clock_out_at":"2026-11-20T16:15:00Z"}', 'Revisión antigua válida');
    raise exception 'FALLO: stale revision accepted';
  exception when serialization_failure then null;
  end;
  begin
    perform public.admin_update_work_session_with_revision('c2010000-0000-0000-0000-000000000001', 2, 'correct', '{"clock_out_at":"2026-11-20T16:15:00Z"}', '  ');
    raise exception 'FALLO: blank reason accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    update public.work_sessions set clock_out_at = '2026-11-20T16:15:00Z' where id = 'c2010000-0000-0000-0000-000000000001';
    raise exception 'FALLO: direct update accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select pg_temp.assert_true(
  (select to_jsonb(s) from public.work_sessions s where s.id = 'c2010000-0000-0000-0000-000000000001') = (select session_json from protected_snapshot)
  and (select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb) from public.work_session_audit_log a where a.work_session_id = 'c2010000-0000-0000-0000-000000000001') = (select audit_json from protected_snapshot),
  'rejected operations retain whole session revision and audit'
);

-- Admin closes a forgotten open session and voids a different record without
-- physical deletion. The voided session is no longer an open-session blocker.
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select pg_temp.assert_true(
  (public.admin_update_work_session_with_revision('c2010000-0000-0000-0000-000000000002', 1, 'close_forgotten', '{"clock_out_at":"2026-11-21T16:00:00Z"}', 'Salida olvidada confirmada')).status = 'closed',
  'admin closes forgotten session with stated exit'
);
select pg_temp.assert_true(
  (public.admin_update_work_session_with_revision('c2010000-0000-0000-0000-000000000001', 2, 'void', '{}'::jsonb, 'Registro erróneo duplicado')).status = 'voided',
  'admin voids without physical delete'
);
reset role;
select pg_temp.assert_true(
  exists (select 1 from public.work_sessions where id = 'c2010000-0000-0000-0000-000000000001' and status = 'voided')
  and exists (select 1 from public.work_session_audit_log where work_session_id = 'c2010000-0000-0000-0000-000000000001' and action = 'voided')
  and exists (select 1 from public.work_session_audit_log where work_session_id = 'c2010000-0000-0000-0000-000000000002' and action = 'admin_closed'),
  'void and close records plus audit remain stored'
);

-- Employee, cross-organisation owner and anon cannot list administrative
-- data or invoke the controlled operation.
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select pg_temp.assert_true(current_user = 'authenticated' and auth.uid() = '33333333-3333-3333-3333-333333333333'::uuid, 'employee identity');
select pg_temp.assert_true((select count(*) from public.admin_list_work_sessions()) = 0, 'employee cannot use the administrative listing through RLS');
do $$ begin
  begin
    perform public.admin_update_work_session_with_revision('c2010000-0000-0000-0000-000000000002', 2, 'void', '{}'::jsonb, 'Acción indebida');
    raise exception 'FALLO: employee admin write accepted';
  exception when serialization_failure then null;
  end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
select pg_temp.assert_true(current_user = 'authenticated' and auth.uid() = '44444444-4444-4444-4444-444444444444'::uuid, 'other organisation identity');
select pg_temp.assert_true((select count(*) from public.admin_list_work_sessions()) = 1, 'other owner sees only B session');
do $$ begin
  begin
    perform public.admin_update_work_session_with_revision('c2010000-0000-0000-0000-000000000002', 2, 'void', '{}'::jsonb, 'Cruce de organización');
    raise exception 'FALLO: other organisation write accepted';
  exception when serialization_failure then null;
  end;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  begin
    perform public.admin_update_work_session_with_revision('c2010000-0000-0000-0000-000000000002', 2, 'void', '{}'::jsonb, 'Anónimo indebido');
    raise exception 'FALLO: anon write accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.work_sessions', 'UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.work_session_audit_log', 'INSERT,UPDATE,DELETE')
  and not has_function_privilege('anon', 'public.admin_update_work_session_with_revision(uuid,integer,text,jsonb,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'priteca_private.admin_update_work_session_impl(uuid,integer,text,jsonb,text)', 'EXECUTE'),
  'direct DML and private RPC remain denied to application roles'
);

rollback;
select 'phase2c_admin_work_sessions: OK' as result;

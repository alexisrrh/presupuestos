\set ON_ERROR_STOP on
\set VERBOSITY terse
begin;

create or replace function pg_temp.assert_true(p_ok boolean, p_label text)
returns void language plpgsql as $$
begin
  if coalesce(p_ok, false) is not true then
    raise exception 'ASSERTION FAILED: %', p_label using errcode = 'P0001';
  end if;
  raise notice 'PASS: %', p_label;
end;
$$;

create or replace function pg_temp.assert_sqlstate(p_sql text, p_expected text, p_label text)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ASSERTION FAILED: % (no error)', p_label using errcode = 'P0001';
exception
  when others then
    if sqlstate <> p_expected then
      raise exception 'ASSERTION FAILED: % (expected %, got %: %)', p_label, p_expected, sqlstate, sqlerrm using errcode = 'P0001';
    end if;
    raise notice 'PASS: % (SQLSTATE %)', p_label, sqlstate;
end;
$$;

do $$
declare
  v_org_a constant uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_org_b constant uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_worker constant uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
  v_worker_admin constant uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
  v_worker_b constant uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  v_session constant uuid := '2f000000-0000-0000-0000-000000000001';
  v_session_b constant uuid := '2f000000-0000-0000-0000-000000000002';
  v_employee constant uuid := '33333333-3333-3333-3333-333333333333';
  v_admin constant uuid := '22222222-2222-2222-2222-222222222222';
  v_owner_b constant uuid := '44444444-4444-4444-4444-444444444444';
  v_request uuid;
  v_request_reject uuid;
  v_request_full uuid;
  v_request_midnight uuid;
  v_request_dst uuid;
  v_before_revision integer;
  v_before_phone text;
  v_before_audit bigint;
  v_after_revision integer;
  v_after_audit bigint;
  v_status text;
  v_count integer;
begin
  perform pg_temp.assert_true(current_user = 'postgres', 'fixtures run as administrator');
  delete from public.work_session_correction_request_audit_log where request_id in (select id from public.work_session_correction_requests where worker_id in (v_worker, v_worker_b));
  delete from public.work_session_correction_requests where worker_id in (v_worker, v_worker_b);
  delete from public.work_session_audit_log where work_session_id in (v_session, v_session_b);
  delete from public.work_sessions where id in (v_session, v_session_b);
  insert into public.work_sessions (id, organization_id, worker_id, clock_in_at, clock_out_at, status, clock_in_actor_id, clock_out_actor_id)
  values (v_session, v_org_a, v_worker, '2026-11-24 08:00:00+01', '2026-11-24 16:00:00+01', 'closed', v_employee, v_employee),
         (v_session_b, v_org_b, v_worker_b, '2026-11-24 08:00:00+01', '2026-11-24 16:00:00+01', 'closed', v_owner_b, v_owner_b);
  select revision into v_before_revision from public.work_sessions where id = v_session;
  select count(*) into v_before_audit from public.work_session_audit_log where work_session_id = v_session;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_employee::text, true);
  perform pg_temp.assert_true(current_user = 'authenticated' and auth.uid() = v_employee, 'employee identity is effective');
  select (public.submit_work_session_correction_request(v_worker, v_session, 'time_correction', '2026-11-24 08:15:00+01', '2026-11-24 16:15:00+01', 'Olvide fichar correctamente')).id into v_request;
  perform pg_temp.assert_true(v_request is not null, 'employee submits request');
  perform pg_temp.assert_true((select count(*) from public.list_my_work_session_correction_requests(50) where id = v_request) = 1, 'employee sees own request');
  perform pg_temp.assert_true((select count(*) from public.admin_list_work_session_correction_requests('pending', null, null, null, 100) where requester_id = v_employee) = 1
    and (select count(*) from public.admin_list_work_session_correction_requests('pending', null, null, null, 100) where requester_id <> v_employee) = 0,
    'employee sees only own request in queue query');
  perform pg_temp.assert_sqlstate(format('select public.resolve_work_session_correction_request(%L::uuid, 1, %L, %L)', v_request, 'approved', 'No corresponde'), '40001', 'employee cannot resolve request');
  perform pg_temp.assert_sqlstate(format('select public.submit_work_session_correction_request(%L::uuid, %L::uuid, %L, %L::timestamptz, %L::timestamptz, %L)', v_worker, v_session, 'time_correction', '2026-11-24 08:15:00+01', '2026-11-24 16:15:00+01', 'Solicitud duplicada'), '23505', 'duplicate pending request rejected');
  perform pg_temp.assert_true((select revision from public.work_sessions where id = v_session) = v_before_revision, 'pending request does not change session revision');
  perform pg_temp.assert_true((select count(*) from public.work_session_audit_log where work_session_id = v_session) = v_before_audit, 'pending request does not add work audit');
  perform pg_temp.assert_sqlstate(format('select public.submit_work_session_correction_request(%L::uuid, %L::uuid, %L, %L::timestamptz, null, %L)', v_worker_b, v_session_b, 'time_correction', '2026-11-24 09:00:00+01', 'Otra organización'), '42501', 'employee cannot submit for another organization');

  reset role;
  update public.workers set status = 'archived' where id = v_worker;
  perform pg_temp.assert_sqlstate(format('select public.submit_work_session_correction_request(%L::uuid, null, %L, %L::timestamptz, %L::timestamptz, %L)', v_worker, 'full_day_forgotten', '2026-11-25 08:00:00+01', '2026-11-25 16:00:00+01', 'Jornada olvidada'), '42501', 'archived worker cannot submit');
  update public.workers set status = 'active' where id = v_worker;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_employee::text, true);
  perform pg_temp.assert_sqlstate(format('insert into public.work_session_correction_requests (organization_id, worker_id, requester_id, kind, proposed_clock_in_at, reason) values (%L::uuid, %L::uuid, %L::uuid, %L, %L::timestamptz, %L)', v_org_a, v_worker, v_employee, 'time_correction', '2026-11-26 08:00:00+01', 'Escritura directa'), '42501', 'employee cannot insert request directly');

  reset role;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform pg_temp.assert_true(current_user = 'authenticated' and auth.uid() = v_admin, 'admin identity is effective');
  perform pg_temp.assert_true((select count(*) from public.admin_list_work_session_correction_requests('pending', null, null, null, 100) where id = v_request) = 1, 'admin sees organization queue');
  select revision into v_before_revision from public.work_session_correction_requests where id = v_request;
  select (public.resolve_work_session_correction_request(v_request, v_before_revision, 'approved', 'Corrección revisada')).status into v_status;
  perform pg_temp.assert_true(v_status = 'approved', 'admin approves request');
  select revision into v_after_revision from public.work_sessions where id = v_session;
  select count(*) into v_after_audit from public.work_session_audit_log where work_session_id = v_session and action = 'admin_corrected';
  perform pg_temp.assert_true(v_after_revision = v_before_revision + 1, 'approval increments session revision exactly once');
  perform pg_temp.assert_true(v_after_audit = 1, 'approval creates exactly one correction audit');
  perform pg_temp.assert_true((select actor_id from public.work_session_audit_log where work_session_id = v_session and action = 'admin_corrected' order by id desc limit 1) = v_admin, 'audit actor is admin');
  perform pg_temp.assert_true((select clock_in_at from public.work_sessions where id = v_session) = '2026-11-24 08:15:00+01'::timestamptz, 'approved entry persisted');
  perform pg_temp.assert_sqlstate(format('select public.resolve_work_session_correction_request(%L::uuid, %s, %L, %L)', v_request, v_before_revision, 'approved', 'Segundo intento'), '40001', 'stale request revision rejected');
  perform pg_temp.assert_true((select revision from public.work_sessions where id = v_session) = v_after_revision, 'stale resolution preserves revision');
  perform pg_temp.assert_true((select count(*) from public.work_session_audit_log where work_session_id = v_session and action = 'admin_corrected') = 1, 'stale resolution creates no audit');

  reset role;
  perform set_config('priteca.allow_worker_identity_change', 'on', true);
  update public.workers set user_id = v_admin where id = v_worker_admin;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  select (public.submit_work_session_correction_request(v_worker_admin, null, 'full_day_forgotten', '2026-11-26 08:15:00+01', '2026-11-26 16:30:00+01', 'Solicitud propia')).id into v_request_reject;
  reset role;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  perform pg_temp.assert_sqlstate(format('select public.resolve_work_session_correction_request(%L::uuid, 1, %L, %L)', v_request_reject, 'approved', 'No debería autoaprobar'), '40001', 'admin cannot approve own request');
  reset role;
  delete from public.work_session_correction_request_audit_log where request_id = v_request_reject;
  delete from public.work_session_correction_requests where id = v_request_reject;
  perform set_config('priteca.allow_worker_identity_change', 'on', true);
  update public.workers set user_id = null where id = v_worker_admin;
  perform set_config('request.jwt.claim.sub', v_employee::text, true);
  select (public.submit_work_session_correction_request(v_worker, v_session, 'exit_forgotten', '2026-11-24 08:15:00+01', '2026-11-24 16:30:00+01', 'Salida olvidada')).id into v_request_reject;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  select (public.resolve_work_session_correction_request(v_request_reject, 1, 'rejected', 'No procede')).status into v_status;
  perform pg_temp.assert_true(v_status = 'rejected', 'admin rejects request with reason');
  perform pg_temp.assert_true((select revision from public.work_sessions where id = v_session) = v_after_revision, 'rejection preserves session');
  perform pg_temp.assert_true((select count(*) from public.work_session_audit_log where work_session_id = v_session and action = 'admin_corrected') = 1, 'rejection adds no work correction audit');

  reset role;
  perform set_config('request.jwt.claim.sub', v_employee::text, true);
  select (public.submit_work_session_correction_request(v_worker, null, 'full_day_forgotten', '2026-11-27 08:00:00+01', '2026-11-27 16:00:00+01', 'Jornada completa olvidada')).id into v_request_full;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  select (public.resolve_work_session_correction_request(v_request_full, 1, 'approved', 'Alta de jornada olvidada')).status into v_status;
  perform pg_temp.assert_true(v_status = 'approved', 'full-day request approved');
  perform pg_temp.assert_true((select count(*) from public.work_sessions where worker_id = v_worker and clock_in_at = '2026-11-27 08:00:00+01'::timestamptz) = 1, 'full-day approval creates one persisted session');

  reset role;
  perform set_config('request.jwt.claim.sub', v_employee::text, true);
  set local role authenticated;
  select (public.submit_work_session_correction_request(v_worker, null, 'full_day_forgotten', '2026-10-24 23:30:00+02', '2026-10-25 01:30:00+02', 'Cruce de medianoche')).id into v_request_midnight;
  reset role;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  perform public.resolve_work_session_correction_request(v_request_midnight, 1, 'approved', 'Cruce revisado');
  perform pg_temp.assert_true((select extract(epoch from (clock_out_at - clock_in_at)) from public.work_sessions where worker_id = v_worker and clock_in_at = '2026-10-24 21:30:00+00'::timestamptz) = 7200, 'cross-midnight interval preserved');

  reset role;
  perform set_config('request.jwt.claim.sub', v_employee::text, true);
  set local role authenticated;
  select (public.submit_work_session_correction_request(v_worker, null, 'full_day_forgotten', '2026-03-29 01:30:00+01', '2026-03-29 04:30:00+02', 'Cambio horario verano')).id into v_request_dst;
  reset role;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  perform public.resolve_work_session_correction_request(v_request_dst, 1, 'approved', 'Cambio horario revisado');
  perform pg_temp.assert_true((select extract(epoch from (clock_out_at - clock_in_at)) from public.work_sessions where worker_id = v_worker and clock_in_at = '2026-03-29 00:30:00+00'::timestamptz) = 7200, 'DST interval uses real instants');

  reset role;
  perform set_config('request.jwt.claim.sub', v_owner_b::text, true);
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_owner_b::text, true);
  perform pg_temp.assert_true((select count(*) from public.admin_list_work_session_correction_requests(null, null, null, null, 100) where organization_id = v_org_a) = 0, 'other organization cannot read requests');
  perform pg_temp.assert_sqlstate(format('select public.resolve_work_session_correction_request(%L::uuid, 1, %L, %L)', v_request_full, 'approved', 'Acceso ajeno'), '40001', 'other organization cannot resolve request');

  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.assert_sqlstate(format('select public.list_my_work_session_correction_requests(10)'), '42501', 'anon cannot list requests');
end;
$$;

rollback;
select 'phase2f_time_correction_requests_behavior: OK' as result;

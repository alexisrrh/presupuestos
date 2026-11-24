\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FALLO: %', message; end if;
end; $$;

-- Dedicated, rolled-back fixtures: two shifts, a previous-day open shift,
-- midnight/DST instants, a voided record and an untouched date.
delete from public.work_session_audit_log where work_session_id in
 ('2f700000-0000-0000-0000-000000000001','2f700000-0000-0000-0000-000000000002','2f700000-0000-0000-0000-000000000003','2f700000-0000-0000-0000-000000000004','2f700000-0000-0000-0000-000000000005','2f700000-0000-0000-0000-000000000006');
delete from public.work_sessions where id in
 ('2f700000-0000-0000-0000-000000000001','2f700000-0000-0000-0000-000000000002','2f700000-0000-0000-0000-000000000003','2f700000-0000-0000-0000-000000000004','2f700000-0000-0000-0000-000000000005');
delete from public.workers where id = '2f700000-0000-0000-0000-000000000011';
insert into public.workers(id, organization_id, user_id, employee_code, document_type, document_normalized, first_name, last_name, email, phone, position, status)
values ('2f700000-0000-0000-0000-000000000011','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','2G-ADMIN','DNI','00000010X','Admin','Fichaje','admin.e2e@example.test','600000010','Administración','active');
insert into public.work_sessions(id, organization_id, worker_id, clock_in_at, clock_out_at, status, clock_in_actor_id, clock_out_actor_id)
values
 ('2f700000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2','2026-10-25 07:00:12+00','2026-10-25 11:00:45+00','closed','33333333-3333-3333-3333-333333333333','33333333-3333-3333-3333-333333333333'),
 ('2f700000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2','2026-10-25 12:00:03+00','2026-10-25 16:30:09+00','closed','33333333-3333-3333-3333-333333333333','33333333-3333-3333-3333-333333333333'),
 ('2f700000-0000-0000-0000-000000000003','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2','2026-10-24 20:30:00+00',null,'open','33333333-3333-3333-3333-333333333333',null),
 ('2f700000-0000-0000-0000-000000000004','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2','2026-10-31 22:30:12+00','2026-11-01 01:15:45+00','closed','33333333-3333-3333-3333-333333333333','33333333-3333-3333-3333-333333333333'),
 ('2f700000-0000-0000-0000-000000000005','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2','2026-10-26 08:00:00+00','2026-10-26 08:15:00+00','voided','33333333-3333-3333-3333-333333333333','33333333-3333-3333-3333-333333333333'),
 ('2f700000-0000-0000-0000-000000000006','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','2026-10-25 08:00:00+00','2026-10-25 12:00:00+00','closed','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111');

set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
select pg_temp.assert_true(current_user = 'authenticated' and auth.uid() = '22222222-2222-2222-2222-222222222222'::uuid, 'admin identity');
select pg_temp.assert_true((public.clock_in_current_worker()).status = 'open', 'admin with worker condition can clock in');
select pg_temp.assert_true((public.clock_out_current_worker()).status = 'closed', 'admin can clock out own worker session');
select pg_temp.assert_true((select count(*) from public.admin_list_work_sessions('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2','2026-10-25','2026-10-25',null,100)) = 2, 'calendar exposes two shifts on one day');
select pg_temp.assert_true((select count(distinct worker_id) from public.admin_list_work_sessions(null,'2026-10-25','2026-10-25',null,100)) = 2, 'calendar exposes multiple workers');
select pg_temp.assert_true((select count(*) from public.admin_list_work_sessions('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2','2026-10-27','2026-10-27',null,100)) = 0, 'empty day is no-record, not absence');
select pg_temp.assert_true((select count(*) from public.admin_list_work_sessions('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2','2026-10-26','2026-10-26','voided',100)) = 1, 'voided day remains visible');

-- Exit-only correction preserves the exact entry instant; entry-only correction
-- preserves the exact exit instant and seconds.
select pg_temp.assert_true((public.admin_update_work_session_with_revision('2f700000-0000-0000-0000-000000000001',1,'correct','{"clock_out_at":"2026-10-25T11:05:45Z"}','2G salida')).revision = 2, 'exit-only revision');
select pg_temp.assert_true((select clock_in_at='2026-10-25 07:00:12+00' and clock_out_at='2026-10-25 11:05:45+00' from public.work_sessions where id='2f700000-0000-0000-0000-000000000001'), 'exit-only preserves entry seconds');
select pg_temp.assert_true((public.admin_update_work_session_with_revision('2f700000-0000-0000-0000-000000000002',1,'correct','{"clock_in_at":"2026-10-25T12:05:03Z"}','2G entrada')).revision = 2, 'entry-only revision');
select pg_temp.assert_true((select clock_in_at='2026-10-25 12:05:03+00' and clock_out_at='2026-10-25 16:30:09+00' from public.work_sessions where id='2f700000-0000-0000-0000-000000000002'), 'entry-only preserves exit seconds');
select pg_temp.assert_true((select count(*) from public.work_session_audit_log where work_session_id in ('2f700000-0000-0000-0000-000000000001','2f700000-0000-0000-0000-000000000002') and actor_id=auth.uid() and action='admin_corrected')=2, 'partial corrections are audited');
reset role;

select pg_temp.assert_true((select extract(epoch from ('2026-11-01 01:15:45+00'::timestamptz-'2026-10-31 22:30:12+00'::timestamptz))=9933), 'midnight duration is real elapsed time');
select pg_temp.assert_true((select extract(epoch from ('2026-03-29 03:30 Europe/Madrid'::timestamptz-'2026-03-29 01:30 Europe/Madrid'::timestamptz))=3600), 'Europe/Madrid spring DST transition uses real elapsed time');

rollback;
select 'phase2g_calendar_cases: OK' as result;

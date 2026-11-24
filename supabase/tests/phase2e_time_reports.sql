\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(v boolean, m text) returns void language plpgsql as $$
begin if v is distinct from true then raise exception 'FALLO: %', m; end if; end $$;

-- Fictitious fixtures are isolated and rolled back.
delete from public.work_session_audit_log where work_session_id in (
  '2e000000-0000-0000-0000-000000000001', '2e000000-0000-0000-0000-000000000002', '2e000000-0000-0000-0000-000000000003', '2e000000-0000-0000-0000-000000000004', '2e000000-0000-0000-0000-000000000005'
);
delete from public.work_sessions where id in (
  '2e000000-0000-0000-0000-000000000001', '2e000000-0000-0000-0000-000000000002', '2e000000-0000-0000-0000-000000000003', '2e000000-0000-0000-0000-000000000004', '2e000000-0000-0000-0000-000000000005'
);
insert into public.work_sessions (id, organization_id, worker_id, clock_in_at, clock_out_at, status, clock_in_actor_id, clock_out_actor_id)
values
 ('2e000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','2026-10-31 22:30+00','2026-11-01 07:30+00','closed','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111'),
 ('2e000000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','2026-11-02 08:00+00','2026-11-02 16:00+00','closed','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111'),
 ('2e000000-0000-0000-0000-000000000003','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','2026-11-03 08:00+00',null,'open','11111111-1111-1111-1111-111111111111',null),
 ('2e000000-0000-0000-0000-000000000004','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','2026-11-04 08:00+00','2026-11-04 16:00+00','voided','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111'),
 ('2e000000-0000-0000-0000-000000000005','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','2026-10-25 00:30+00','2026-10-25 03:30+00','closed','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111');

set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
select pg_temp.assert_true(current_user='authenticated' and auth.uid()='22222222-2222-2222-2222-222222222222'::uuid,'admin identity');
create temp table report_admin as select public.admin_time_report(null,'2026-11-01','2026-11-03') report;
grant select on report_admin to authenticated;
select pg_temp.assert_true((select (report->>'timezone')='Europe/Madrid' and (report->>'total_seconds')::bigint=59400 from report_admin),'closed total uses local inclusive period');
select pg_temp.assert_true((select (jsonb_array_length(report->'rows')=3 and (report->>'closed_count')::int=2 and (report->>'open_count')::int=1) from report_admin),'details include closed and pending open');
select pg_temp.assert_true((select exists(select 1 from jsonb_array_elements(report->'rows') row where row->>'status'='open' and (row->>'pending_open')::boolean) from report_admin),'open session is pending, not computed');
select pg_temp.assert_true((select (public.admin_time_report(null,'2026-11-02','2026-11-02')->>'total_seconds')::bigint=28800),'exact local-day boundaries');
select pg_temp.assert_true((select (public.admin_time_report(null,'2026-10-25','2026-10-25')->>'total_seconds')::bigint=10800),'DST transition uses real elapsed seconds');
reset role;
update public.workers set status = 'archived' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
select pg_temp.assert_true((select (public.admin_time_report(null,'2026-11-02','2026-11-02')->>'closed_count')::int=1),'archived worker history remains reportable');
select pg_temp.assert_true((select (public.admin_time_report(null,'2026-11-04','2026-11-04')->>'total_seconds')::bigint=0),'voided sessions are excluded from totals');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
select pg_temp.assert_true((select jsonb_array_length(public.admin_time_report(null,'2026-11-01','2026-11-03')->'rows')=0),'employee cannot read administrative report');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',true);
select pg_temp.assert_true((select not exists (select 1 from jsonb_array_elements(public.admin_time_report(null,'2026-11-01','2026-11-30')->'rows') row where row->>'employee_code'='E2E-BASE')),'other organisation cannot read organisation A report');
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  begin perform public.admin_time_report(null,'2026-11-01','2026-11-03'); raise exception 'FALLO: anon report access';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

rollback;
select 'phase2e_time_reports: OK' as result;

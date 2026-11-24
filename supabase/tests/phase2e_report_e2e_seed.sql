\set ON_ERROR_STOP on
begin;
delete from public.work_session_audit_log where work_session_id = '2e000000-0000-0000-0000-000000000009';
delete from public.work_sessions where id = '2e000000-0000-0000-0000-000000000009';
insert into public.work_sessions (id, organization_id, worker_id, clock_in_at, clock_out_at, status, clock_in_actor_id, clock_out_actor_id)
values ('2e000000-0000-0000-0000-000000000009','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','2026-11-04 08:00+00','2026-11-04 16:00+00','closed','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111');
commit;

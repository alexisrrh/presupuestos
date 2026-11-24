\set ON_ERROR_STOP on

begin;

-- Dedicated cross-organization admin and worker; transaction rollback keeps
-- the offline baseline reusable for the other suites.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-b@example.test', 'x', '{}', '{}', now(), now())
on conflict (id) do nothing;
insert into public.organization_members (organization_id, user_id, role, is_active)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000202', 'admin', true)
on conflict (organization_id, user_id) do update set role = excluded.role, is_active = excluded.is_active;
insert into public.workers (id, organization_id, employee_code, document_type, document_normalized, first_name, last_name, phone, status)
values ('40000000-0000-0000-0000-000000000020', '20000000-0000-0000-0000-000000000001', 'B-TEST-020', 'DNI', '00000002W', 'Berta', 'Prueba', '600020020', 'active')
on conflict (id) do update set phone = excluded.phone;

create function pg_temp.phase1d_roles_assert(v boolean, m text) returns void
language plpgsql as $$ begin if v is distinct from true then raise exception 'FALLO: %', m; end if; end $$;

create temp table snapshot_a as
select to_jsonb(w) worker_json, w.id, w.revision,
       coalesce(jsonb_agg(to_jsonb(a) order by a.id) filter (where a.id is not null), '[]'::jsonb) audit_json
from public.workers w left join public.worker_audit_log a on a.worker_id=w.id
where w.id='40000000-0000-0000-0000-000000000001'
group by w.id,w.revision;
grant select on snapshot_a to authenticated;

-- Owner A: permitted on its organization.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',true);
select pg_temp.phase1d_roles_assert(current_user='authenticated' and auth.uid()='00000000-0000-0000-0000-000000000101'::uuid,'owner A identity');
select pg_temp.phase1d_roles_assert((public.update_worker_with_revision((select id from snapshot_a),(select revision from snapshot_a),'{"phone":"600101101"}'::jsonb)).phone='600101101','owner A writes A');
reset role;
select pg_temp.phase1d_roles_assert((select revision from public.workers where id=(select id from snapshot_a))=(select revision+1 from snapshot_a),'owner increments revision once');
update snapshot_a set worker_json=(select to_jsonb(w) from public.workers w where w.id=snapshot_a.id), revision=(select revision from public.workers w where w.id=snapshot_a.id), audit_json=(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.worker_audit_log a where a.worker_id=snapshot_a.id);

-- Admin A: permitted on its organization.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true);
select pg_temp.phase1d_roles_assert(current_user='authenticated' and auth.uid()='00000000-0000-0000-0000-000000000102'::uuid,'admin A identity');
select pg_temp.phase1d_roles_assert((public.update_worker_with_revision((select id from snapshot_a),(select revision from snapshot_a),'{"position":"Admin prueba"}'::jsonb)).position='Admin prueba','admin A writes A');
reset role;
update snapshot_a set worker_json=(select to_jsonb(w) from public.workers w where w.id=snapshot_a.id), revision=(select revision from public.workers w where w.id=snapshot_a.id), audit_json=(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.worker_audit_log a where a.worker_id=snapshot_a.id);

-- No direct UPDATE bypass exists, even for an active admin.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true);
do $$ begin
  begin
    update public.workers set phone='600102102' where id=(select id from snapshot_a);
    raise exception 'FALLO: direct UPDATE accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select pg_temp.phase1d_roles_assert((select to_jsonb(w) from public.workers w where w.id=(select id from snapshot_a))=(select worker_json from snapshot_a),'direct update keeps worker');
select pg_temp.phase1d_roles_assert((select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.worker_audit_log a where a.worker_id=(select id from snapshot_a))=(select audit_json from snapshot_a),'direct update keeps audit');

-- Denied identities all yield the controlled inaccessible/conflict result and
-- leave the complete row, revision, and audit snapshot untouched.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',true);
select pg_temp.phase1d_roles_assert(current_user='authenticated' and auth.uid()='00000000-0000-0000-0000-000000000103'::uuid,'employee identity');
do $$ begin begin perform public.update_worker_with_revision((select id from snapshot_a),(select revision from snapshot_a),'{"phone":"600103103"}'::jsonb); raise exception 'FALLO: employee write accepted'; exception when serialization_failure then null; end; end $$;
do $$ begin begin perform priteca_private.update_worker_with_revision_impl((select id from snapshot_a),(select revision from snapshot_a),'{"phone":"600103104"}'::jsonb); raise exception 'FALLO: employee private write accepted'; exception when serialization_failure then null; end; end $$;
reset role;
select pg_temp.phase1d_roles_assert((select to_jsonb(w) from public.workers w where w.id=(select id from snapshot_a))=(select worker_json from snapshot_a),'employee keeps worker');
select pg_temp.phase1d_roles_assert((select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.worker_audit_log a where a.worker_id=(select id from snapshot_a))=(select audit_json from snapshot_a),'employee keeps audit');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000105',true);
select pg_temp.phase1d_roles_assert(current_user='authenticated' and auth.uid()='00000000-0000-0000-0000-000000000105'::uuid,'inactive identity');
do $$ begin begin perform public.update_worker_with_revision((select id from snapshot_a),(select revision from snapshot_a),'{"phone":"600105105"}'::jsonb); raise exception 'FALLO: inactive write accepted'; exception when serialization_failure then null; end; end $$;
reset role;
select pg_temp.phase1d_roles_assert((select to_jsonb(w) from public.workers w where w.id=(select id from snapshot_a))=(select worker_json from snapshot_a),'inactive keeps worker');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000202',true);
select pg_temp.phase1d_roles_assert(current_user='authenticated' and auth.uid()='00000000-0000-0000-0000-000000000202'::uuid,'admin B identity');
do $$ begin begin perform public.update_worker_with_revision((select id from snapshot_a),(select revision from snapshot_a),'{"phone":"600202202"}'::jsonb); raise exception 'FALLO: admin B wrote A'; exception when serialization_failure then null; end; end $$;
select pg_temp.phase1d_roles_assert((public.update_worker_with_revision('40000000-0000-0000-0000-000000000020',(select revision from public.workers where id='40000000-0000-0000-0000-000000000020'),'{"phone":"600202202"}'::jsonb)).phone='600202202','admin B writes B only');
reset role;
select pg_temp.phase1d_roles_assert((select to_jsonb(w) from public.workers w where w.id=(select id from snapshot_a))=(select worker_json from snapshot_a),'admin B keeps A worker');
select pg_temp.phase1d_roles_assert((select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.worker_audit_log a where a.worker_id=(select id from snapshot_a))=(select audit_json from snapshot_a),'admin B keeps A audit');

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.phase1d_roles_assert(current_user='anon' and auth.uid() is null,'anon identity');
do $$ begin begin perform public.update_worker_with_revision((select id from snapshot_a),(select revision from snapshot_a),'{"phone":"600000000"}'::jsonb); raise exception 'FALLO: anon execution accepted'; exception when insufficient_privilege then null; end; end $$;
reset role;
select pg_temp.phase1d_roles_assert((select to_jsonb(w) from public.workers w where w.id=(select id from snapshot_a))=(select worker_json from snapshot_a),'anon keeps worker');
select pg_temp.phase1d_roles_assert((select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.worker_audit_log a where a.worker_id=(select id from snapshot_a))=(select audit_json from snapshot_a),'anon keeps audit');

rollback;
select 'phase1d_worker_roles: OK' as result;

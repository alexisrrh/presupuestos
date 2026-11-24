\set ON_ERROR_STOP on
create or replace function public.phase1c_acl_assert(v boolean, m text) returns void language plpgsql as $$ begin if v is not true then raise exception '%',m; end if; end $$;
select public.phase1c_acl_assert(not has_table_privilege('authenticated','public.workers','delete'),'workers DELETE');
select public.phase1c_acl_assert(not has_table_privilege('authenticated','public.workers','truncate'),'workers TRUNCATE');
select public.phase1c_acl_assert(not has_table_privilege('authenticated','public.worker_audit_log','insert'),'audit INSERT');
select public.phase1c_acl_assert(not has_table_privilege('authenticated','public.worker_audit_log','update'),'audit UPDATE');
select public.phase1c_acl_assert(not has_table_privilege('authenticated','public.worker_audit_log','delete'),'audit DELETE');

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',true);
select public.phase1c_acl_assert(current_user='authenticated' and auth.uid()='00000000-0000-0000-0000-000000000103'::uuid,'employee identity');
select public.phase1c_acl_assert((select count(*) from public.organization_members)=1,'employee only self membership');
select public.phase1c_acl_assert((select count(*) from public.workers)=0,'employee workers denied');
rollback;

-- Grupo 1: anon e inactivo no leen ni escriben negocio.
begin;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select public.phase1c_acl_assert(current_user='anon' and auth.uid() is null,'anon identity');
do $$ begin begin perform 1 from public.workers; raise exception 'anon workers allowed'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin insert into public.workers(organization_id,employee_code,document_type,document_normalized,first_name,last_name) values ('10000000-0000-0000-0000-000000000001','X','DNI','99999999R','X','X'); raise exception 'anon worker insert allowed'; exception when insufficient_privilege then null; end; begin insert into public.worker_audit_log(organization_id,worker_id,action) values ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','updated'); raise exception 'anon audit insert allowed'; exception when insufficient_privilege then null; end; end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000105',true);
select public.phase1c_acl_assert(current_user='authenticated' and auth.uid()='00000000-0000-0000-0000-000000000105'::uuid,'inactive identity');
select public.phase1c_acl_assert((select count(*) from public.workers)=0,'inactive workers denied');
do $$ begin begin update public.workers set phone='x'; if found then raise exception 'inactive worker update allowed'; end if; exception when insufficient_privilege then null; end; begin insert into public.worker_audit_log(organization_id,worker_id,action) values ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','updated'); raise exception 'inactive audit insert allowed'; exception when insufficient_privilege then null; end; end $$;
rollback;

-- Grupo 2: A no observa B; owner B ve su trabajador existente.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',true);
select public.phase1c_acl_assert(exists(select 1 from public.workers where id='40000000-0000-0000-0000-000000000001') and not exists(select 1 from public.workers where organization_id='20000000-0000-0000-0000-000000000001'),'owner A cannot read B worker');
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000201',true);
select public.phase1c_acl_assert(exists(select 1 from public.workers where id='40000000-0000-0000-0000-000000000002') and not exists(select 1 from public.workers where organization_id='10000000-0000-0000-0000-000000000001'),'owner B reads own worker');
rollback;

-- Grupo 3: escritura directa de auditoria rechazada por ACL, con fila valida.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true);
create temp table phase1c_audit_before as select count(*) audit_count from public.worker_audit_log where worker_id='40000000-0000-0000-0000-000000000001';
do $$ begin begin insert into public.worker_audit_log(organization_id,worker_id,actor_id,action) values ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','updated'); raise exception 'audit insert allowed'; exception when insufficient_privilege then null; end; end $$;
select public.phase1c_acl_assert((select count(*) from public.worker_audit_log where worker_id='40000000-0000-0000-0000-000000000001')=(select audit_count from phase1c_audit_before),'audit unchanged after direct insert');
rollback;

-- Grupo 2: segundo employee y aislamiento de B sin filtros de frontend.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000106',true);
select public.phase1c_acl_assert(current_user='authenticated' and auth.uid()='00000000-0000-0000-0000-000000000106'::uuid,'employee2 identity');
select public.phase1c_acl_assert((select count(*) from public.organization_members)=1,'employee2 only self membership');
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true);
select public.phase1c_acl_assert(exists(select 1 from public.workers where id='40000000-0000-0000-0000-000000000001') and not exists(select 1 from public.workers where organization_id='20000000-0000-0000-0000-000000000001'),'admin A cannot read B worker');
select public.phase1c_acl_assert(exists(select 1 from public.worker_audit_log where worker_id='40000000-0000-0000-0000-000000000001') and not exists(select 1 from public.worker_audit_log where organization_id='20000000-0000-0000-0000-000000000001'),'admin A cannot read B audit');
do $$ begin begin update public.workers set phone='699999999' where id='40000000-0000-0000-0000-000000000002'; raise exception 'admin A direct update B allowed'; exception when insufficient_privilege then null; end; end $$;
select public.phase1c_acl_assert(not exists(select 1 from public.workers where id='40000000-0000-0000-0000-000000000002' and phone='699999999'),'admin A cannot modify B');
rollback;

-- Grupo 3: owner/admin no falsifican ni alteran historial; cada rechazo conserva filas.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',true);
do $$ begin begin update public.worker_audit_log set reason='x'; raise exception 'audit update allowed'; exception when insufficient_privilege then null; end; begin delete from public.worker_audit_log; raise exception 'audit delete allowed'; exception when insufficient_privilege then null; end; begin execute 'truncate public.worker_audit_log'; raise exception 'audit truncate allowed'; exception when insufficient_privilege then null; end; end $$;
select public.phase1c_acl_assert((select count(*) from public.worker_audit_log)>0,'owner audit retained');
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true);
create temp table phase1c_legitimate_audit_before as select count(*) audit_count from public.worker_audit_log where worker_id='40000000-0000-0000-0000-000000000001';
do $$ begin begin update public.worker_audit_log set reason='x'; raise exception 'audit update allowed'; exception when insufficient_privilege then null; end; begin delete from public.worker_audit_log; raise exception 'audit delete allowed'; exception when insufficient_privilege then null; end; begin execute 'truncate public.worker_audit_log'; raise exception 'audit truncate allowed'; exception when insufficient_privilege then null; end; end $$;
select public.update_worker_with_revision('40000000-0000-0000-0000-000000000001',(select revision from public.workers where id='40000000-0000-0000-0000-000000000001'),'{"phone":"611111111"}'::jsonb);
select public.phase1c_acl_assert((select count(*) from public.worker_audit_log where worker_id='40000000-0000-0000-0000-000000000001')=(select audit_count+1 from phase1c_legitimate_audit_before),'legitimate update audits once');
rollback;

-- Grupo 4: no hay cascada alcanzable por cuentas de aplicacion sobre expediente/auditoria.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',true);
do $$ begin begin delete from public.organizations where id='10000000-0000-0000-0000-000000000001'; if found then raise exception 'organization delete allowed'; end if; exception when insufficient_privilege then null; end; end $$;
select public.phase1c_acl_assert(exists(select 1 from public.workers where id='40000000-0000-0000-0000-000000000001'),'indirect worker delete denied');
select public.phase1c_acl_assert(exists(select 1 from public.worker_audit_log where worker_id='40000000-0000-0000-0000-000000000001'),'indirect audit delete denied');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true);
select public.phase1c_acl_assert((select count(*) from public.organization_members)=6,'admin reads A members');
select public.update_worker_with_revision('40000000-0000-0000-0000-000000000001',(select revision from public.workers where id='40000000-0000-0000-0000-000000000001'),'{"phone":"600000000"}'::jsonb);
select public.phase1c_acl_assert((select actor_id='00000000-0000-0000-0000-000000000102'::uuid from public.worker_audit_log order by id desc limit 1),'audit actor');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true);
do $$ begin begin delete from public.workers where id='40000000-0000-0000-0000-000000000001'; raise exception 'delete allowed'; exception when insufficient_privilege then null; end; end $$;
select public.phase1c_acl_assert((select count(*) from public.workers where id='40000000-0000-0000-0000-000000000001')=1,'worker retained');
rollback;
drop function public.phase1c_acl_assert(boolean,text);
select 'phase1c_acl_membership: OK' as result;

\set ON_ERROR_STOP on
create or replace function public.phase1d_assert(v boolean, m text) returns void language plpgsql as $$ begin if v is not true then raise exception '%',m; end if; end $$;
begin;
update public.workers set email='baseline@example.test', phone='600000000', position='Inicial'
where id='40000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true);
select public.phase1d_assert(current_user='authenticated' and auth.uid()='00000000-0000-0000-0000-000000000102'::uuid,'admin identity');
create temp table baseline as select w.*, (select count(*) from public.worker_audit_log a where a.worker_id=w.id) audit_count from public.workers w where id='40000000-0000-0000-0000-000000000001';
select public.phase1d_assert((select count(*) from baseline)=1,'unique baseline');
select public.phase1d_assert((public.update_worker_with_revision((select id from baseline),(select revision from baseline),'{"employee_code":"A-002","document_type":"DNI","document_normalized":"00000000T","first_name":"Ana","last_name":"Prueba","email":null,"phone":"600123456","start_date":"2026-01-02","position":"Encargada"}'::jsonb)).revision=(select revision+1 from baseline),'authorized revision');
select public.phase1d_assert((select employee_code='A-002' and document_type='DNI' and document_normalized='00000000T' and first_name='Ana' and last_name='Prueba' and email is null and phone='600123456' and start_date='2026-01-02'::date and position='Encargada' and revision=(select revision+1 from baseline) from public.workers where id=(select id from baseline)),'nine fields and explicit null');
select public.phase1d_assert((select count(*) from public.worker_audit_log where worker_id=(select id from baseline))=(select audit_count+1 from baseline),'one audit');
select public.phase1d_assert((select actor_id from public.worker_audit_log where worker_id=(select id from baseline) order by id desc limit 1)=auth.uid(),'audit actor');
create temp table after_full as select * from public.workers where id=(select id from baseline);
select public.phase1d_assert((public.update_worker_with_revision((select id from after_full),(select revision from after_full),'{"phone":"600654321"}'::jsonb)).revision=(select revision+1 from after_full),'partial revision');
select public.phase1d_assert((select employee_code=(select employee_code from after_full) and document_type=(select document_type from after_full) and document_normalized=(select document_normalized from after_full) and first_name=(select first_name from after_full) and last_name=(select last_name from after_full) and email is not distinct from (select email from after_full) and start_date is not distinct from (select start_date from after_full) and position is not distinct from (select position from after_full) and phone='600654321' from public.workers where id=(select id from after_full)),'partial preserves business fields');
do $$ begin begin perform public.update_worker_with_revision('40000000-0000-0000-0000-000000000001',(select revision from baseline),'{"phone":"x"}'::jsonb); raise exception 'stale allowed'; exception when serialization_failure then null; end; end $$;
select public.phase1d_assert((select phone='600654321' from public.workers where id=(select id from baseline)),'stale unchanged');
do $$ begin begin update public.workers set phone='x' where id=(select id from baseline); raise exception 'direct update allowed'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin perform public.update_worker_with_revision((select id from baseline),(select revision+1 from baseline),'{}'::jsonb); raise exception 'empty allowed'; exception when invalid_parameter_value then null; end; begin perform public.update_worker_with_revision((select id from baseline),(select revision+1 from baseline),'{"revision":9}'::jsonb); raise exception 'protected allowed'; exception when invalid_parameter_value then null; end; end $$;
rollback;
drop function public.phase1d_assert(boolean,text);
select 'phase1d_worker_general: OK' as result;

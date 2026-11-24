-- Contrato estructural de solicitudes de fichaje olvidado.
-- La batería de identidad/RLS debe ejecutarse con Auth local; este archivo
-- no presenta una sesión postgres como prueba de permisos de aplicación.
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(v boolean, m text) returns void language plpgsql as $$
begin if v is distinct from true then raise exception 'FALLO: %', m; end if; end $$;
select pg_temp.assert_true(to_regclass('public.work_session_correction_requests') is not null, 'tabla de solicitudes');
select pg_temp.assert_true(to_regclass('public.work_session_correction_request_audit_log') is not null, 'auditoría de solicitudes');
select pg_temp.assert_true(to_regprocedure('public.submit_work_session_correction_request(uuid,uuid,text,timestamptz,timestamptz,text)') is not null, 'RPC de envío');
select pg_temp.assert_true(to_regprocedure('public.list_my_work_session_correction_requests(integer)') is not null, 'RPC de lectura propia');
select pg_temp.assert_true(to_regprocedure('public.admin_list_work_session_correction_requests(text,uuid,date,date,integer)') is not null, 'RPC administrativa de lectura');
select pg_temp.assert_true(to_regprocedure('public.resolve_work_session_correction_request(uuid,integer,text,text)') is not null, 'RPC de resolución');
select pg_temp.assert_true(not has_function_privilege('anon', 'public.resolve_work_session_correction_request(uuid,integer,text,text)', 'execute'), 'anon no puede resolver solicitudes');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.work_session_correction_requests', 'insert'), 'authenticated no tiene INSERT directo');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.work_session_correction_requests', 'update'), 'authenticated no tiene UPDATE directo');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.work_session_correction_requests', 'delete'), 'authenticated no tiene DELETE directo');
rollback;

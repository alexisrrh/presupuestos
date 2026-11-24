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

-- The fixtures are the dedicated E2E identities.  This suite is run after
-- seed-fixtures.sql and never accepts a worker or organisation parameter.
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select pg_temp.assert_true(current_user = 'authenticated' and auth.uid() = '33333333-3333-3333-3333-333333333333'::uuid, 'identidad employee');
select pg_temp.assert_true(
  (select worker_id from public.get_current_worker_time_tracking_state()) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid,
  'estado limitado a la ficha propia'
);
select pg_temp.assert_true(
  not exists (select 1 from public.get_current_worker_time_tracking_state() where organization_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  'sin organización ajena en estado personal'
);
select pg_temp.assert_true(
  not exists (select 1 from public.workers),
  'employee mantiene prohibido SELECT directo sobre workers'
);
select pg_temp.assert_true(
  not exists (
    select 1 from public.list_current_worker_work_sessions(30) h
    join public.work_sessions s on s.id = h.session_id
    where s.worker_id <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid
  ),
  'historial limitado a la ficha propia'
);
rollback;

begin;
set local role authenticated;
create function pg_temp.assert_true(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_condition is distinct from true then
    raise exception 'FALLO: %', p_message;
  end if;
end;
$$;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
select pg_temp.assert_true(current_user = 'authenticated' and auth.uid() = '44444444-4444-4444-4444-444444444444'::uuid, 'identidad otra organización');
select pg_temp.assert_true(
  (select worker_id from public.get_current_worker_time_tracking_state()) = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid
  and not exists (select 1 from public.get_current_worker_time_tracking_state() where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  'administrador con ficha solo obtiene su propia jornada de B'
);
rollback;

begin;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  perform * from public.get_current_worker_time_tracking_state();
  raise exception 'FALLO: anon ejecutó la lectura personal';
exception
  when insufficient_privilege then null;
end;
$$;
rollback;

select 'phase2b_personal_time_tracking_read: OK' as result;

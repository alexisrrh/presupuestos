-- PRITECA: managed PostgreSQL smoke for the approved phase 2 release.
-- Reviewed against commit b34776a8e1549350487a5711c073f085d4b9595b.
-- LOCAL ARTIFACT ONLY: creation of this file does not authorize its execution.
--
-- Run the entire file on ONE administrative connection, stopping on the FIRST
-- error. With psql use -v ON_ERROR_STOP=1; with a connector submit one SQL request
-- and require its successful completion. On error, ROLLBACK/close that same
-- connection; never continue to the final PASS after a failed statement.
--
-- Inject reviewed SET LOCAL values at the marker immediately after BEGIN:
--   priteca.smoke.daniel_id       UUID of the existing administrative actor
--   priteca.smoke.alexis_id       UUID of the existing actor used for attendance
--   priteca.smoke.organization_id UUID of the existing PRITECA organization
-- No real account identifiers, emails, passwords or tokens belong in this file.
--
-- Guards: both existing accounts must have active owner/admin membership in the
-- target; workers and attendance/audit tables must be empty. No Auth accounts,
-- profiles, memberships, business settings or budgets are written. The sole
-- worker fixture and every resulting audit/session row are rolled back.
-- PostgreSQL nextval() is NOT transactional: audit sequence values can be
-- consumed despite ROLLBACK. Do not reset sequences to hide those gaps.
-- This verifies database permissions/RPCs, not HTTP login or the employee role.

begin transaction isolation level repeatable read;
-- PRITECA_MANAGED_SMOKE_PARAMETERS
set local lock_timeout = '3s';
set local statement_timeout = '30s';
set local idle_in_transaction_session_timeout = '45s';
set local timezone = 'UTC';
set local row_security = on;

do $preflight$
declare
  v_daniel uuid := nullif(current_setting('priteca.smoke.daniel_id', true), '')::uuid;
  v_alexis uuid := nullif(current_setting('priteca.smoke.alexis_id', true), '')::uuid;
  v_org uuid := nullif(current_setting('priteca.smoke.organization_id', true), '')::uuid;
  v_actor uuid;
  v_allowed jsonb;
  v_expected jsonb := '{}'::jsonb;
  v_baseline jsonb;
  v_fixture uuid := ('f2e0aa00' || substr(gen_random_uuid()::text, 9))::uuid;
  v_visible bigint;
  v_denied bigint;
begin
  if v_daniel is null or v_alexis is null or v_org is null or v_daniel = v_alexis then
    raise exception 'SMOKE: supply two distinct reviewed actors and the target organization.';
  end if;
  if row_security_active('public.workers') or row_security_active('public.budgets') then
    raise exception 'SMOKE: preflight requires an administrative view of existing rows.';
  end if;
  if (select count(*) from auth.users where id in (v_daniel, v_alexis)) <> 2
     or not exists (select 1 from public.organizations where id = v_org)
     or (select count(*) from public.organization_members
         where organization_id = v_org and user_id in (v_daniel, v_alexis)
           and is_active and role in ('owner', 'admin')) <> 2 then
    raise exception 'SMOKE: existing accounts/organization/memberships do not match the required baseline.';
  end if;
  if exists (select 1 from public.workers)
     or exists (select 1 from public.work_sessions)
     or exists (select 1 from public.worker_audit_log)
     or exists (select 1 from public.worker_identity_audit_log)
     or exists (select 1 from public.work_session_audit_log) then
    raise exception 'SMOKE: requires the reviewed empty worker/attendance baseline; no existing worker will be changed.';
  end if;
  if exists (select 1 from public.workers where id = v_fixture
             or employee_code like 'SMOKE_MANAGED_%'
             or (organization_id = v_org and document_normalized = '00000000T')) then
    raise exception 'SMOKE: synthetic fixture collision.';
  end if;

  foreach v_actor in array array[v_daniel, v_alexis] loop
    select coalesce(jsonb_agg(organization_id::text), '[]'::jsonb)
      into v_allowed
    from public.organization_members
    where user_id = v_actor and is_active and role in ('owner', 'admin');
    select count(*) filter (where v_allowed ? organization_id::text),
           count(*) filter (where not (v_allowed ? organization_id::text))
      into v_visible, v_denied
    from public.budgets;
    v_expected := v_expected || jsonb_build_object(v_actor::text,
      jsonb_build_object('orgs', v_allowed, 'visible_budgets', v_visible,
        'denied_budgets', v_denied,
        'profile_exists', exists (select 1 from public.profiles where id = v_actor)));
  end loop;
  if (v_expected -> v_daniel::text ->> 'denied_budgets')::bigint = 0 then
    raise exception 'SMOKE: no existing budget outside Daniel''s authorized organizations; negative RLS case cannot be demonstrated.';
  end if;

  -- Counts plus a fingerprint of budget IDs/tenant links; no document content
  -- or identifiers are emitted. The same snapshot is checked before rollback.
  select jsonb_build_object(
    'auth_users', (select count(*) from auth.users),
    'profiles', (select count(*) from public.profiles),
    'organizations', (select count(*) from public.organizations),
    'memberships', (select count(*) from public.organization_members),
    'settings', (select count(*) from public.company_settings),
    'clients', (select count(*) from public.clients),
    'budgets', (select count(*) from public.budgets),
    'chapters', (select count(*) from public.budget_chapters),
    'items', (select count(*) from public.budget_items),
    'budget_tenants', (select md5(coalesce(string_agg(
      id::text || ':' || organization_id::text, ',' order by id), '')) from public.budgets)
  ) into v_baseline;
  perform set_config('priteca.smoke.expected', v_expected::text, true);
  perform set_config('priteca.smoke.baseline', v_baseline::text, true);
  perform set_config('priteca.smoke.fixture_id', v_fixture::text, true);
end;
$preflight$;

set local role authenticated;

do $rls_read$
declare
  v_actor uuid;
  v_org uuid := current_setting('priteca.smoke.organization_id')::uuid;
  v_expected jsonb;
  v_visible bigint;
begin
  if current_user <> 'authenticated'
     or not row_security_active('public.budgets')
     or not row_security_active('public.company_settings') then
    raise exception 'SMOKE: authenticated role/RLS is not active.';
  end if;
  foreach v_actor in array array[
    current_setting('priteca.smoke.daniel_id')::uuid,
    current_setting('priteca.smoke.alexis_id')::uuid
  ] loop
    perform set_config('request.jwt.claim.sub', v_actor::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      jsonb_build_object('sub', v_actor, 'role', 'authenticated')::text, true);
    v_expected := current_setting('priteca.smoke.expected')::jsonb -> v_actor::text;
    if auth.uid() is distinct from v_actor
       or not public.is_organization_admin(v_org)
       or (exists (select 1 from public.profiles where id = v_actor))
            is distinct from (v_expected ->> 'profile_exists')::boolean
       or not exists (select 1 from public.company_settings where organization_id = v_org) then
      raise exception 'SMOKE: authenticated actor cannot read the expected own profile/organization configuration.';
    end if;
    select count(*) into v_visible from public.budgets;
    if v_visible <> (v_expected ->> 'visible_budgets')::bigint
       or exists (select 1 from public.budgets
                  where not ((v_expected -> 'orgs') ? organization_id::text))
       or exists (select 1 from public.company_settings
                  where not ((v_expected -> 'orgs') ? organization_id::text)) then
      raise exception 'SMOKE: budget/configuration tenant isolation or authorized row count failed.';
    end if;
  end loop;
end;
$rls_read$;

do $create_and_link$
declare
  v_daniel uuid := current_setting('priteca.smoke.daniel_id')::uuid;
  v_alexis uuid := current_setting('priteca.smoke.alexis_id')::uuid;
  v_org uuid := current_setting('priteca.smoke.organization_id')::uuid;
  v_fixture uuid := current_setting('priteca.smoke.fixture_id')::uuid;
  v_worker public.workers;
  v_reason text := 'Smoke gestionado transaccional; fixture sin persistencia';
begin
  perform set_config('request.jwt.claim.sub', v_daniel::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_daniel, 'role', 'authenticated')::text, true);
  if current_user <> 'authenticated' or auth.uid() is distinct from v_daniel then
    raise exception 'SMOKE: creation/link must use the administrative application actor.';
  end if;
  insert into public.workers (
    id, organization_id, employee_code, document_type, document_normalized,
    first_name, last_name, status
  ) values (
    v_fixture, v_org, 'SMOKE_MANAGED_' || replace(v_fixture::text, '-', ''),
    'DNI', '00000000T', 'Prueba', 'Transaccional', 'active'
  ) returning * into v_worker;
  if v_worker.revision <> 1 or v_worker.user_id is not null then
    raise exception 'SMOKE: new worker revision/identity is unexpected.';
  end if;
  select * into v_worker from public.set_worker_identity_with_revision(
    p_worker_id => v_fixture,
    p_expected_revision => 1,
    p_target_user_id => v_alexis,
    p_reason => v_reason
  );
  if v_worker.id is distinct from v_fixture
     or v_worker.organization_id is distinct from v_org
     or v_worker.user_id is distinct from v_alexis
     or v_worker.revision <> 2 then
    raise exception 'SMOKE: identity RPC did not return the expected linked worker/revision.';
  end if;
  if (select count(*) from public.worker_identity_audit_log
      where worker_id = v_fixture and organization_id = v_org
        and actor_id = v_daniel and previous_user_id is null
        and new_user_id = v_alexis and action = 'linked' and reason = v_reason) <> 1
     or (select count(*) from public.worker_audit_log
         where worker_id = v_fixture and actor_id = v_daniel
           and action in ('created', 'updated')) <> 2 then
    raise exception 'SMOKE: creation/link audit evidence is missing or has the wrong actor.';
  end if;
end;
$create_and_link$;

do $attendance$
declare
  v_alexis uuid := current_setting('priteca.smoke.alexis_id')::uuid;
  v_org uuid := current_setting('priteca.smoke.organization_id')::uuid;
  v_fixture uuid := current_setting('priteca.smoke.fixture_id')::uuid;
  v_in public.work_session_transition_result;
  v_out public.work_session_transition_result;
  v_session public.work_sessions;
  v_before timestamptz;
  v_after timestamptz;
  v_sql text;
begin
  perform set_config('request.jwt.claim.sub', v_alexis::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_alexis, 'role', 'authenticated')::text, true);
  if current_user <> 'authenticated' or auth.uid() is distinct from v_alexis then
    raise exception 'SMOKE: attendance must use the linked application actor.';
  end if;

  v_before := clock_timestamp();
  select * into v_in from public.clock_in_current_worker();
  v_after := clock_timestamp();
  if v_in.accepted is distinct from true or v_in.rejection_code is not null
     or v_in.work_session_id is null or v_in.status is distinct from 'open'
     or v_in.revision is distinct from 1 or v_in.occurred_at is null
     or v_in.occurred_at < v_before or v_in.occurred_at > v_after then
    raise exception 'SMOKE: clock-in result/revision/server timestamp is invalid.';
  end if;
  select * into v_session from public.work_sessions where id = v_in.work_session_id;
  if not found or v_session.worker_id is distinct from v_fixture
     or v_session.organization_id is distinct from v_org
     or v_session.status is distinct from 'open'
     or v_session.clock_in_actor_id is distinct from v_alexis
     or v_session.clock_out_at is not null then
    raise exception 'SMOKE: clock-in row is missing or belongs to the wrong worker/tenant.';
  end if;

  -- Each statement deliberately targets ZERO rows. Even if an ACL regressed,
  -- it cannot fabricate/change a session; absence of 42501 fails the test.
  foreach v_sql in array array[
    'insert into public.work_sessions (organization_id, worker_id, clock_in_at, status) select null::uuid, null::uuid, clock_timestamp(), ''open'' where false',
    'update public.work_sessions set status = status where false',
    'delete from public.work_sessions where false'
  ] loop
    begin
      execute v_sql;
      raise exception 'SMOKE: direct attendance DML was permitted.';
    exception when insufficient_privilege then
      null;
    end;
  end loop;

  v_before := clock_timestamp();
  select * into v_out from public.clock_out_current_worker();
  v_after := clock_timestamp();
  if v_out.accepted is distinct from true or v_out.rejection_code is not null
     or v_out.work_session_id is distinct from v_in.work_session_id
     or v_out.status is distinct from 'closed' or v_out.revision is distinct from 2
     or v_out.occurred_at is null or v_out.occurred_at < v_before
     or v_out.occurred_at > v_after then
    raise exception 'SMOKE: clock-out result/revision/server timestamp is invalid.';
  end if;
  select * into v_session from public.work_sessions where id = v_out.work_session_id;
  if not found or v_session.status is distinct from 'closed'
     or v_session.revision <> 2
     or v_session.clock_in_at is distinct from v_in.occurred_at
     or v_session.clock_out_at is distinct from v_out.occurred_at
     or v_session.clock_out_actor_id is distinct from v_alexis then
    raise exception 'SMOKE: closed session does not match the RPC evidence.';
  end if;
  if (select count(*) from public.work_session_audit_log
      where worker_id = v_fixture and work_session_id = v_session.id
        and organization_id = v_org and actor_id = v_alexis) <> 2
     or (select count(*) from public.work_session_audit_log
         where work_session_id = v_session.id and action = 'clocked_in') <> 1
     or (select count(*) from public.work_session_audit_log
         where work_session_id = v_session.id and action = 'clocked_out') <> 1 then
    raise exception 'SMOKE: attendance audit actions/actors are invalid.';
  end if;
  perform set_config('priteca.smoke.session_id', v_session.id::text, true);
end;
$attendance$;

do $report$
declare
  v_daniel uuid := current_setting('priteca.smoke.daniel_id')::uuid;
  v_fixture uuid := current_setting('priteca.smoke.fixture_id')::uuid;
  v_session public.work_sessions;
  v_report jsonb;
  v_row jsonb;
  v_seconds numeric;
begin
  perform set_config('request.jwt.claim.sub', v_daniel::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_daniel, 'role', 'authenticated')::text, true);
  if current_user <> 'authenticated' or auth.uid() is distinct from v_daniel then
    raise exception 'SMOKE: report must use the administrative application actor.';
  end if;
  select * into v_session from public.work_sessions
  where id = current_setting('priteca.smoke.session_id')::uuid;
  if not found then raise exception 'SMOKE: administrator cannot read the closed fixture session.'; end if;
  select public.admin_time_report(
    p_worker_id => v_fixture,
    p_from => (v_session.clock_in_at at time zone 'Europe/Madrid')::date,
    p_to => (v_session.clock_out_at at time zone 'Europe/Madrid')::date
  ) into v_report;
  v_row := v_report -> 'rows' -> 0;
  v_seconds := extract(epoch from v_session.clock_out_at - v_session.clock_in_at);
  if (v_report ->> 'timezone') is distinct from 'Europe/Madrid'
     or jsonb_array_length(v_report -> 'rows') is distinct from 1
     or (v_report ->> 'closed_count')::bigint is distinct from 1::bigint
     or (v_report ->> 'open_count')::bigint is distinct from 0::bigint
     or (v_report ->> 'total_seconds')::bigint is distinct from v_seconds::bigint
     or (v_row ->> 'session_id')::uuid is distinct from v_session.id
     or (v_row ->> 'worker_id')::uuid is distinct from v_fixture
     or (v_row ->> 'revision')::integer is distinct from 2
     or (v_row ->> 'status') is distinct from 'closed'
     or (v_row ->> 'duration_seconds')::numeric is distinct from v_seconds then
    raise exception 'SMOKE: administrative report does not match the closed fixture session.';
  end if;
end;
$report$;

reset role;

do $preservation$
declare
  v_observed jsonb;
  v_fixture uuid := current_setting('priteca.smoke.fixture_id')::uuid;
begin
  if row_security_active('public.workers') or row_security_active('public.budgets') then
    raise exception 'SMOKE: final preservation check requires the original administrative view.';
  end if;
  select jsonb_build_object(
    'auth_users', (select count(*) from auth.users),
    'profiles', (select count(*) from public.profiles),
    'organizations', (select count(*) from public.organizations),
    'memberships', (select count(*) from public.organization_members),
    'settings', (select count(*) from public.company_settings),
    'clients', (select count(*) from public.clients),
    'budgets', (select count(*) from public.budgets),
    'chapters', (select count(*) from public.budget_chapters),
    'items', (select count(*) from public.budget_items),
    'budget_tenants', (select md5(coalesce(string_agg(
      id::text || ':' || organization_id::text, ',' order by id), '')) from public.budgets)
  ) into v_observed;
  if v_observed is distinct from current_setting('priteca.smoke.baseline')::jsonb then
    raise exception 'SMOKE: protected baseline counts/budget tenant links changed.';
  end if;
  if (select count(*) from public.workers) <> 1
     or (select count(*) from public.work_sessions) <> 1
     or (select count(*) from public.worker_audit_log) <> 2
     or (select count(*) from public.worker_identity_audit_log) <> 1
     or (select count(*) from public.work_session_audit_log) <> 2
     or not exists (select 1 from public.workers where id = v_fixture and revision = 2) then
    raise exception 'SMOKE: writes extended beyond the expected synthetic fixture.';
  end if;
end;
$preservation$;

rollback;
select 'PASS'::text as phase2_managed_smoke;

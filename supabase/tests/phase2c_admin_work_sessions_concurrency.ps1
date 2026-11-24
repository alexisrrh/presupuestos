$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Two independently connected psql processes run inside the private E2E
# container. No host port, offline volume or remote database is involved.
$docker = 'C:\Users\alexi\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
$container = 'priteca-e2e-db'
$organizationId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
$adminA = '11111111-1111-1111-1111-111111111111'
$adminB = '22222222-2222-2222-2222-222222222222'
$employee = '33333333-3333-3333-3333-333333333333'

function Invoke-E2EPsql([string]$Sql, [switch]$TuplesOnly) {
  $arguments = @('exec', '-i', $container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres')
  if ($TuplesOnly) { $arguments += @('-At', '-F', '|') }
  $output = $Sql | & $docker @arguments 2>&1 | Out-String
  [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output }
}

function Start-E2EPsql([string]$Sql) {
  Start-Job -ScriptBlock {
    param($DockerPath, $ContainerName, $Document)
    $output = $Document | & $DockerPath exec -i $ContainerName psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres 2>&1 | Out-String
    [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output }
  } -ArgumentList $docker, $container, $Sql
}

function Assert-Overlap($first, $second, [string]$name) {
  Start-Sleep -Milliseconds 900
  if ($first.State -ne 'Running' -or $second.State -ne 'Running') {
    throw "$name did not overlap: first=$($first.State), second=$($second.State)"
  }
}

function Invoke-AdminConflictScenario {
  $sessionId = 'c3010000-0000-0000-0000-000000000001'
  $fixture = @"
delete from public.work_session_audit_log where work_session_id = '$sessionId';
delete from public.work_sessions where id = '$sessionId';
insert into public.work_sessions (id, organization_id, worker_id, clock_in_at, clock_out_at, status, clock_in_actor_id, clock_out_actor_id)
values ('$sessionId', '$organizationId', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '2026-11-20 08:00+00', '2026-11-20 16:00+00', 'closed', '$adminA', '$adminA');
"@
  $prepared = Invoke-E2EPsql $fixture
  if ($prepared.ExitCode -ne 0) { throw "admin/admin fixture failed: $($prepared.Output)" }

  $sqlA = @"
\set VERBOSITY verbose
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '$adminA', true);
select pg_backend_pid() as pid_a, current_user, auth.uid();
select * from public.admin_update_work_session_with_revision('$sessionId', 1, 'correct', '{"clock_in_at":"2026-11-20T07:30:00Z"}'::jsonb, 'Corrección A concurrente');
select pg_sleep(3);
commit;
"@
  $sqlB = @"
\set VERBOSITY verbose
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '$adminB', true);
select pg_backend_pid() as pid_b, current_user, auth.uid();
select * from public.admin_update_work_session_with_revision('$sessionId', 1, 'correct', '{"clock_in_at":"2026-11-20T07:45:00Z"}'::jsonb, 'Corrección B concurrente');
commit;
"@
  $jobA = Start-E2EPsql $sqlA
  Start-Sleep -Milliseconds 450
  $jobB = Start-E2EPsql $sqlB
  Assert-Overlap $jobA $jobB 'admin/admin'
  $resultA = Receive-Job -Job $jobA -Wait -AutoRemoveJob
  $resultB = Receive-Job -Job $jobB -Wait -AutoRemoveJob
  if ($resultA.ExitCode -ne 0 -or $resultB.ExitCode -eq 0 -or $resultB.Output -notmatch '40001') {
    throw "admin/admin unexpected exits A=$($resultA.ExitCode), B=$($resultB.ExitCode): $($resultB.Output)"
  }
  $final = Invoke-E2EPsql "select revision, clock_in_at, status, (select count(*) from public.work_session_audit_log where work_session_id='$sessionId' and action='admin_corrected'), (select actor_id::text from public.work_session_audit_log where work_session_id='$sessionId' and action='admin_corrected') from public.work_sessions where id='$sessionId';" -TuplesOnly
  if ($final.ExitCode -ne 0 -or $final.Output.Trim() -notmatch '2\|2026-11-20 07:30:00\+00\|closed\|1\|11111111-1111-1111-1111-111111111111') {
    throw "admin/admin final state unexpected: $($final.Output)"
  }
  [pscustomobject]@{ Scenario = 'admin-admin-stale-correction'; PidA = $resultA.Output -match 'pid_a'; PidB = $resultB.Output -match 'pid_b'; AExit = $resultA.ExitCode; BExit = $resultB.ExitCode; Final = $final.Output.Trim() }
}

function Invoke-AdminEmployeeScenario {
  $sessionId = 'c3010000-0000-0000-0000-000000000002'
  $fixture = @"
delete from public.work_session_audit_log where work_session_id = '$sessionId';
delete from public.work_sessions where id = '$sessionId';
insert into public.work_sessions (id, organization_id, worker_id, clock_in_at, status, clock_in_actor_id)
values ('$sessionId', '$organizationId', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '2026-11-21 08:00+00', 'open', '$employee');
"@
  $prepared = Invoke-E2EPsql $fixture
  if ($prepared.ExitCode -ne 0) { throw "admin/employee fixture failed: $($prepared.Output)" }

  $sqlA = @"
\set VERBOSITY verbose
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '$adminA', true);
select pg_backend_pid() as pid_a, current_user, auth.uid();
select * from public.admin_update_work_session_with_revision('$sessionId', 1, 'correct', '{"clock_in_at":"2026-11-21T07:45:00Z"}'::jsonb, 'Corrección administrativa concurrente');
select pg_sleep(3);
commit;
"@
  $sqlB = @"
\set VERBOSITY verbose
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '$employee', true);
select pg_backend_pid() as pid_b, current_user, auth.uid();
select * from public.clock_out_current_worker();
commit;
"@
  $jobA = Start-E2EPsql $sqlA
  Start-Sleep -Milliseconds 450
  $jobB = Start-E2EPsql $sqlB
  Assert-Overlap $jobA $jobB 'admin/employee'
  $resultA = Receive-Job -Job $jobA -Wait -AutoRemoveJob
  $resultB = Receive-Job -Job $jobB -Wait -AutoRemoveJob
  if ($resultA.ExitCode -ne 0 -or $resultB.ExitCode -ne 0 -or $resultB.Output -notmatch 't\s*\|') {
    throw "admin/employee unexpected exits A=$($resultA.ExitCode), B=$($resultB.ExitCode): $($resultB.Output)"
  }
  $final = Invoke-E2EPsql "select revision, clock_in_at, status, (clock_out_at is not null), (select count(*) from public.work_session_audit_log where work_session_id='$sessionId' and action in ('admin_corrected','clocked_out')), (select count(*) from public.work_session_audit_log where work_session_id='$sessionId' and action='admin_corrected'), (select count(*) from public.work_session_audit_log where work_session_id='$sessionId' and action='clocked_out') from public.work_sessions where id='$sessionId';" -TuplesOnly
  if ($final.ExitCode -ne 0 -or $final.Output.Trim() -notmatch '3\|2026-11-21 07:45:00\+00\|closed\|t\|2\|1\|1') {
    throw "admin/employee final state unexpected: $($final.Output)"
  }
  [pscustomobject]@{ Scenario = 'admin-employee-close-after-correction'; PidA = $resultA.Output -match 'pid_a'; PidB = $resultB.Output -match 'pid_b'; AExit = $resultA.ExitCode; BExit = $resultB.ExitCode; Final = $final.Output.Trim() }
}

try {
  $adminAdmin = Invoke-AdminConflictScenario
  $adminEmployee = Invoke-AdminEmployeeScenario
  $adminAdmin
  $adminEmployee
} finally {
  $cleanup = @"
delete from public.work_session_audit_log where work_session_id in ('c3010000-0000-0000-0000-000000000001', 'c3010000-0000-0000-0000-000000000002');
delete from public.work_sessions where id in ('c3010000-0000-0000-0000-000000000001', 'c3010000-0000-0000-0000-000000000002');
"@
  $cleaned = Invoke-E2EPsql $cleanup
  if ($cleaned.ExitCode -ne 0) { Write-Error "2C concurrency cleanup failed: $($cleaned.Output)" }
}

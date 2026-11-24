$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Only targets the private PRITECA E2E database; it never addresses offline,
# rebuild4 or a hosted project. The worker fixture is removed administratively
# after the third-connection verification.
$docker = 'C:\Users\alexi\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
$container = 'priteca-e2e-db'
$workerId = 'a2030000-0000-0000-0000-000000000001'
$employeeId = '00000000-0000-0000-0000-000000000106'
$organizationId = '10000000-0000-0000-0000-000000000001'

function Invoke-E2EPsql([string]$Sql) {
  $output = $Sql | & $docker exec -i $container psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres 2>&1 | Out-String
  [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output }
}

try {
  $fixture = @"
delete from public.work_session_audit_log where worker_id = '$workerId';
delete from public.work_sessions where worker_id = '$workerId';
delete from public.worker_audit_log where worker_id = '$workerId';
delete from public.worker_identity_audit_log where worker_id = '$workerId';
delete from public.workers where id = '$workerId';
insert into public.workers (id, organization_id, user_id, employee_code, document_type, document_normalized, first_name, last_name, status)
values ('$workerId', '$organizationId', '$employeeId', 'P2A-CONC', 'DNI', '00000004G', 'Concha', 'Concurrente', 'active');
"@
  $prepared = Invoke-E2EPsql $fixture
  if ($prepared.ExitCode -ne 0) { throw "fixture failed: $($prepared.Output)" }

  $sessionA = @"
\set VERBOSITY verbose
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '$employeeId', true);
select pg_backend_pid() as pid_a, current_user, auth.uid();
select * from public.clock_in_current_worker();
select pg_sleep(3);
commit;
"@
  $sessionB = @"
\set VERBOSITY verbose
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '$employeeId', true);
select pg_backend_pid() as pid_b, current_user, auth.uid();
select * from public.clock_in_current_worker();
commit;
"@

  $jobA = Start-Job -ScriptBlock {
    param($DockerPath, $ContainerName, $Sql)
    $output = $Sql | & $DockerPath exec -i $ContainerName psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres 2>&1 | Out-String
    [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output }
  } -ArgumentList $docker, $container, $sessionA

  Start-Sleep -Milliseconds 500
  $jobB = Start-Job -ScriptBlock {
    param($DockerPath, $ContainerName, $Sql)
    $output = $Sql | & $DockerPath exec -i $ContainerName psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres 2>&1 | Out-String
    [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output }
  } -ArgumentList $docker, $container, $sessionB

  Start-Sleep -Milliseconds 800
  if ($jobA.State -ne 'Running' -or $jobB.State -ne 'Running') {
    throw "No hubo solapamiento verificable: A=$($jobA.State); B=$($jobB.State)"
  }

  $resultA = Receive-Job -Job $jobA -Wait -AutoRemoveJob
  $resultB = Receive-Job -Job $jobB -Wait -AutoRemoveJob
  if ($resultA.ExitCode -ne 0 -or $resultB.ExitCode -ne 0) {
    throw "La concurrencia produjo un error inesperado: A=$($resultA.ExitCode) $($resultA.Output); B=$($resultB.ExitCode) $($resultB.Output)"
  }
  if ($resultA.Output -notmatch 'pid_a' -or $resultB.Output -notmatch 'pid_b') { throw 'No se registraron ambos PID.' }
  if ($resultA.Output -notmatch 't\s+\|' -or $resultB.Output -notmatch 'open_session_exists') {
    throw "Resultados de transición inesperados: A=$($resultA.Output); B=$($resultB.Output)"
  }

  $verificationSql = @"
select
  (select count(*) from public.work_sessions where worker_id = '$workerId' and status = 'open'),
  (select revision from public.work_sessions where worker_id = '$workerId' and status = 'open'),
  (select count(*) from public.work_session_audit_log where worker_id = '$workerId' and action = 'clocked_in'),
  (select count(*) from public.work_session_audit_log where worker_id = '$workerId' and action = 'clock_in_rejected_open'),
  (select actor_id::text from public.work_session_audit_log where worker_id = '$workerId' and action = 'clocked_in');
"@
  $final = $verificationSql | & $docker exec -i $container psql -X -At -F '|' -v ON_ERROR_STOP=1 -U postgres -d postgres 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { throw "third-connection verification failed: $final" }
  if ($final.Trim() -ne "1|1|1|1|$employeeId") { throw "Estado final inesperado: $final" }

  [pscustomobject]@{
    Scenario = 'same-worker-two-independent-clock-ins'
    PidA = $true
    PidB = $true
    AExit = $resultA.ExitCode
    BExit = $resultB.ExitCode
    BRejected = $resultB.Output -match 'open_session_exists'
    Final = $final.Trim()
  }
}
finally {
  $cleanup = @"
delete from public.work_session_audit_log where worker_id = '$workerId';
delete from public.work_sessions where worker_id = '$workerId';
delete from public.worker_audit_log where worker_id = '$workerId';
delete from public.worker_identity_audit_log where worker_id = '$workerId';
delete from public.workers where id = '$workerId';
"@
  $cleanupResult = Invoke-E2EPsql $cleanup
  if ($cleanupResult.ExitCode -ne 0) { Write-Error "fixture cleanup failed: $($cleanupResult.Output)" }
}

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Solo para la instancia E2E privada. No apunta a offline, rebuild4 ni remoto.
$docker = 'C:\Users\alexi\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
$container = 'priteca-e2e-db'
$workerId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaae1'

function Invoke-E2EPsql([string]$sql) {
  $output = $sql | & $docker exec -i $container psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres 2>&1 | Out-String
  [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output }
}

$fixture = @"
delete from public.worker_audit_log where worker_id = '$workerId';
delete from public.workers where id = '$workerId';
insert into public.workers(id, organization_id, employee_code, document_type, document_normalized, first_name, last_name, phone, status)
values('$workerId', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'E2E-ARCH-CONC', 'DNI', '00000003A', 'Archivo', 'Concurrente', '600777777', 'active');
select id, revision, status, (select count(*) from public.worker_audit_log a where a.worker_id = w.id) as audit_before
from public.workers w where id = '$workerId';
"@
$prepared = Invoke-E2EPsql $fixture
if ($prepared.ExitCode -ne 0) { throw "fixture failed: $($prepared.Output)" }

$sessionA = @"
\set VERBOSITY verbose
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select pg_backend_pid() as pid_a, clock_timestamp() as a_before;
select public.archive_worker_with_revision('$workerId', 1, 'Archivo concurrente A');
select pg_sleep(3);
commit;
"@
$sessionB = @"
\set VERBOSITY verbose
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select pg_backend_pid() as pid_b, clock_timestamp() as b_before;
select public.archive_worker_with_revision('$workerId', 1, 'Archivo concurrente B');
commit;
"@

$jobA = Start-Job -ScriptBlock {
  param($dockerPath, $containerName, $sql)
  $output = $sql | & $dockerPath exec -i $containerName psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres 2>&1 | Out-String
  [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output }
} -ArgumentList $docker, $container, $sessionA

Start-Sleep -Milliseconds 500
$jobB = Start-Job -ScriptBlock {
  param($dockerPath, $containerName, $sql)
  $output = $sql | & $dockerPath exec -i $containerName psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres 2>&1 | Out-String
  [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output }
} -ArgumentList $docker, $container, $sessionB

Start-Sleep -Milliseconds 800
if ($jobB.State -ne 'Running') { throw "La segunda conexión no quedó esperando: $($jobB.State)" }

$resultA = Receive-Job -Job $jobA -Wait -AutoRemoveJob
$resultB = Receive-Job -Job $jobB -Wait -AutoRemoveJob
if ($resultA.ExitCode -ne 0) { throw "La primera conexión no confirmó: $($resultA.Output)" }
if ($resultB.ExitCode -eq 0 -or $resultB.Output -notmatch '40001') {
  throw "La segunda conexión no recibió conflicto 40001: exit=$($resultB.ExitCode) output=$($resultB.Output)"
}

$verificationSql = @"
select revision, status, archived_reason,
       (select count(*) from public.worker_audit_log a where a.worker_id = w.id) as audit_count,
       (select actor_id::text from public.worker_audit_log a where a.worker_id = w.id and a.action = 'archived') as archive_actor
from public.workers w where id = '$workerId';
"@
$verificationOutput = $verificationSql | & $docker exec -i $container psql -X -At -F '|' -v ON_ERROR_STOP=1 -U postgres -d postgres 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) { throw "third-connection verification failed: $verificationOutput" }
if ($verificationOutput.Trim() -ne '2|archived|Archivo concurrente A|2|11111111-1111-1111-1111-111111111111') {
  throw "Estado final inesperado: $verificationOutput"
}

[pscustomobject]@{
  Scenario = 'archive-same-revision'
  PidA = [bool]($resultA.Output | Select-String -Pattern 'pid_a')
  PidB = [bool]($resultB.Output | Select-String -Pattern 'pid_b')
  AExit = $resultA.ExitCode
  BExit = $resultB.ExitCode
  BConflict = $resultB.Output -match '40001'
  Final = $verificationOutput.Trim()
}

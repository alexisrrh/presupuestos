$ErrorActionPreference = 'Stop'
$docker = 'C:\Users\alexi\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
$container = 'priteca-sql-tests-offline'

function Invoke-Psql([string]$sql) {
  $sql | & $docker exec -i $container psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres 2>&1
  return @{ ExitCode = $LASTEXITCODE; Output = ($input | Out-String) }
}

function Invoke-Scenario([string]$id, [string]$patchA, [string]$patchB, [int]$lock) {
  $document = if ($lock -eq 93130) { '00000004G' } else { '00000005M' }
  $prep = @"
delete from public.workers where id='$id';
insert into public.workers(id,organization_id,employee_code,document_type,document_normalized,first_name,last_name,phone,position,status)
values('$id','10000000-0000-0000-0000-000000000001','C-$lock','DNI','$document','Concurrencia','Prueba','600300300','Inicial','active');
select id,revision,(select count(*) from public.worker_audit_log a where a.worker_id=w.id) audit_before from public.workers w where id='$id';
"@
  $prep | & $docker exec -i $container psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'fixture preparation failed' }
  $a = @"
\set VERBOSITY verbose
begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',true); select pg_backend_pid() as pid_a, clock_timestamp() as before_lock; select pg_advisory_xact_lock($lock); select clock_timestamp() as acquired_a; select public.update_worker_with_revision('$id',1,'$patchA'::jsonb); select pg_sleep(3); commit;
"@
  $b = @"
\set VERBOSITY verbose
begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true); select pg_backend_pid() as pid_b, clock_timestamp() as before_lock; select pg_advisory_xact_lock($lock); select clock_timestamp() as acquired_b; select public.update_worker_with_revision('$id',1,'$patchB'::jsonb); commit;
"@
  $jobA = Start-Job -ScriptBlock { param($d,$c,$s) $o = $s | & $d exec -i $c psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres 2>&1 | Out-String; [pscustomobject]@{ ExitCode=$LASTEXITCODE; Output=$o } } -ArgumentList $docker,$container,$a
  Start-Sleep -Milliseconds 500
  $jobB = Start-Job -ScriptBlock { param($d,$c,$s) $o = $s | & $d exec -i $c psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres 2>&1 | Out-String; [pscustomobject]@{ ExitCode=$LASTEXITCODE; Output=$o } } -ArgumentList $docker,$container,$b
  Start-Sleep -Milliseconds 1000
  if ($jobB.State -ne 'Running') { throw "second connection did not wait ($($jobB.State))" }
  $ra = Receive-Job -Job $jobA -Wait -AutoRemoveJob
  $rb = Receive-Job -Job $jobB -Wait -AutoRemoveJob
  if ($ra.ExitCode -ne 0 -or $rb.ExitCode -eq 0 -or $rb.Output -notmatch '40001') { throw "unexpected results A=$($ra.ExitCode) B=$($rb.ExitCode): $($rb.Output)" }
  $verify = "select revision,phone,position,(select count(*) from public.worker_audit_log a where a.worker_id=w.id) audit_count from public.workers w where id='$id';"
  $out = $verify | & $docker exec -i $container psql -X -At -v ON_ERROR_STOP=1 -U postgres -d postgres
  if ($LASTEXITCODE -ne 0 -or $out -notmatch '^2\|') { throw "final verification failed: $out" }
  [pscustomobject]@{ Scenario=$id; PidA=($ra.Output -match 'pid_a'); PidB=($rb.Output -match 'pid_b'); AExit=$ra.ExitCode; BExit=$rb.ExitCode; Final=$out.Trim() }
}

$same = Invoke-Scenario '40000000-0000-0000-0000-000000000030' '{"phone":"600300301"}' '{"phone":"600300302"}' 93130
$different = Invoke-Scenario '40000000-0000-0000-0000-000000000031' '{"phone":"600310301"}' '{"position":"Otro"}' 93131
$same; $different

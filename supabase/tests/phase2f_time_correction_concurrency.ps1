$ErrorActionPreference = 'Stop'
$container = 'priteca-e2e-db'
$stamp = [DateTime]::UtcNow.ToString('yyyyMMddHHmmssfff')
$requestId = "2f000000-0000-0000-0000-$stamp".Replace('-', '').Substring(0, 8) + '-0000-0000-0000-0000000000c1'
$sessionId = '2f000000-0000-0000-0000-0000000000c2'
$workerId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
$orgId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
$employeeId = '33333333-3333-3333-3333-333333333333'
$adminId = '22222222-2222-2222-2222-222222222222'
$requestId = '2f000000-0000-0000-0000-0000000000c1'

$setup = @"
begin;
delete from public.work_session_correction_request_audit_log where request_id = '$requestId';
delete from public.work_session_correction_requests where id = '$requestId';
delete from public.work_session_audit_log where work_session_id = '$sessionId';
delete from public.work_sessions where id = '$sessionId';
insert into public.work_sessions (id, organization_id, worker_id, clock_in_at, clock_out_at, status, clock_in_actor_id, clock_out_actor_id)
values ('$sessionId', '$orgId', '$workerId', '2026-11-30 08:00:00+01', '2026-11-30 16:00:00+01', 'closed', '$employeeId', '$employeeId');
insert into public.work_session_correction_requests (id, organization_id, worker_id, work_session_id, requester_id, kind, proposed_clock_in_at, proposed_clock_out_at, reason, expected_session_revision)
values ('$requestId', '$orgId', '$workerId', '$sessionId', '$employeeId', 'time_correction', '2026-11-30 08:15:00+01', '2026-11-30 16:15:00+01', 'Solicitud concurrente E2E', 1);
insert into public.work_session_correction_request_audit_log (request_id, organization_id, worker_id, actor_id, action, next_status, reason)
values ('$requestId', '$orgId', '$workerId', '$employeeId', 'submitted', 'pending', 'Solicitud concurrente E2E');
commit;
"@
$a = @"
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '$adminId', true);
select public.resolve_work_session_correction_request('$requestId'::uuid, 1, 'approved', 'Aprobación A');
select pg_sleep(3);
commit;
"@
$b = @"
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '$adminId', true);
select public.resolve_work_session_correction_request('$requestId'::uuid, 1, 'approved', 'Aprobación B');
commit;
"@
$root = Join-Path $env:TEMP "priteca-2f-concurrency-$stamp"
New-Item -ItemType Directory -Path $root -Force | Out-Null
$setupFile = Join-Path $root 'setup.sql'; $aFile = Join-Path $root 'a.sql'; $bFile = Join-Path $root 'b.sql'
$aOut = Join-Path $root 'a.out'; $bOut = Join-Path $root 'b.out'
Set-Content -LiteralPath $setupFile -Value $setup -NoNewline
Set-Content -LiteralPath $aFile -Value $a -NoNewline
Set-Content -LiteralPath $bFile -Value $b -NoNewline
Get-Content -Raw $setupFile | docker exec -i $container psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres | Out-Null
docker cp $aFile "$container`:/tmp/phase2f-a.sql" | Out-Null
docker cp $bFile "$container`:/tmp/phase2f-b.sql" | Out-Null
$procA = Start-Process docker -ArgumentList @('exec','-i',$container,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-f','/tmp/phase2f-a.sql') -RedirectStandardOutput $aOut -RedirectStandardError ($aOut + '.err') -PassThru
Start-Sleep -Milliseconds 400
$procB = Start-Process docker -ArgumentList @('exec','-i',$container,'psql','-X','-v','ON_ERROR_STOP=0','-U','postgres','-d','postgres','-f','/tmp/phase2f-b.sql') -RedirectStandardOutput $bOut -RedirectStandardError ($bOut + '.err') -PassThru
$procA.WaitForExit(); $procB.WaitForExit()
$aText = (Get-Content -Raw $aOut) + (Get-Content -Raw ($aOut + '.err'))
$bText = (Get-Content -Raw $bOut) + (Get-Content -Raw ($bOut + '.err'))
if ($aText -notmatch 'COMMIT' -or $aText -match 'ERROR') { throw "Sesión A inesperada: $aText" }
if ($bText -notmatch '40001|Solicitud inaccesible') { throw "Sesión B no recibió el conflicto esperado: $bText" }
$final = docker exec $container psql -X -At -U postgres -d postgres -c "select status || '|' || revision from public.work_session_correction_requests where id = '$requestId'; select revision from public.work_sessions where id = '$sessionId'; select count(*) from public.work_session_audit_log where work_session_id = '$sessionId' and action = 'admin_corrected';"
if (($final -join ' ') -notmatch 'approved\|1') { throw "Estado de solicitud inesperado: $final" }
if (($final -join ' ') -notmatch 'approved\|1\s+2\s+1') { throw "Revisión/auditoría concurrente inesperada: $final" }
Write-Output "phase2f_time_correction_concurrency: OK (PID_A=$($procA.Id), PID_B=$($procB.Id), B=40001)"

-- The transaction first locks the current open session. Limit that read to
-- the NOLOGIN writer; application roles retain only their RLS-protected reads.
begin;
grant select on public.work_sessions to priteca_attendance_writer;
drop policy if exists work_sessions_writer_select on public.work_sessions;
create policy work_sessions_writer_select
on public.work_sessions
for select to priteca_attendance_writer
using (true);
commit;

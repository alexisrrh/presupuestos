-- Existing membership RLS has a permissive owner policy evaluated alongside
-- the admin policy. The NOLOGIN technical writer needs this helper only to
-- read a target membership inside the authorised linking RPC.
begin;
grant execute on function public.is_organization_owner(uuid) to priteca_attendance_writer;
commit;

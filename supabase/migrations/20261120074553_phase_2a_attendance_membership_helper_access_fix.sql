-- Required by the inherited employee-self membership SELECT policy during the
-- technical writer's authorised membership validation. Browser roles keep
-- their existing grants; only the NOLOGIN writer receives this privilege.
begin;
grant execute on function public.has_active_role(uuid, text[]) to priteca_attendance_writer;
commit;

-- La entrada pública es el contrato controlado; la implementación privada no
-- debe ser invocable por authenticated. SECURITY DEFINER es necesario aquí
-- porque authenticated no tiene UPDATE sobre work_sessions. La implementación
-- comprueba actor, rol activo, organización, estado y revisión antes de DML.
begin;

create or replace function public.admin_update_work_session_with_revision(
  p_work_session_id uuid,
  p_expected_revision integer,
  p_operation text,
  p_changes jsonb default '{}'::jsonb,
  p_reason text default null
)
returns public.work_sessions
language sql security definer
set search_path = public, priteca_private
as $$
  select priteca_private.admin_update_work_session_impl(
    p_work_session_id, p_expected_revision, p_operation, p_changes, p_reason
  );
$$;
alter function public.admin_update_work_session_with_revision(uuid, integer, text, jsonb, text) owner to postgres;
revoke all on function priteca_private.admin_update_work_session_impl(uuid, integer, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.admin_update_work_session_with_revision(uuid, integer, text, jsonb, text) from public, anon;
grant execute on function public.admin_update_work_session_with_revision(uuid, integer, text, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
commit;

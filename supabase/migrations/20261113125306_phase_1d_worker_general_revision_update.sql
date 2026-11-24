-- Operacion invoker: solo campos editables; identidad, organizacion y auditoria no entran en el payload.
create or replace function public.update_worker_with_revision(p_worker_id uuid, p_expected_revision integer, p_changes jsonb)
returns public.workers language plpgsql security invoker set search_path = public as $$
declare result public.workers;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object'
    or p_changes ?| array['id','organization_id','user_id','created_at','updated_at','revision'] then
    raise exception 'Cambios de trabajador invalidos.' using errcode='22023';
  end if;
  update public.workers set
    employee_code = coalesce(p_changes->>'employee_code', employee_code),
    document_type = coalesce(p_changes->>'document_type', document_type),
    document_normalized = coalesce(p_changes->>'document_normalized', document_normalized),
    first_name = coalesce(p_changes->>'first_name', first_name),
    last_name = coalesce(p_changes->>'last_name', last_name),
    email = coalesce(p_changes->>'email', email), phone = coalesce(p_changes->>'phone', phone),
    start_date = coalesce((p_changes->>'start_date')::date, start_date),
    position = coalesce(p_changes->>'position', position)
  where id=p_worker_id and revision=p_expected_revision returning * into result;
  if not found then raise exception 'Conflicto de revision o ficha inaccesible.' using errcode='40001'; end if;
  return result;
end;
$$;
revoke all on function public.update_worker_with_revision(uuid,integer,jsonb) from public, anon;
grant execute on function public.update_worker_with_revision(uuid,integer,jsonb) to authenticated;

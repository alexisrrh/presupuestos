create or replace function public.bootstrap_current_organization()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_organization_name text;
begin
  if v_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  select om.organization_id, o.name
  into v_organization_id, v_organization_name
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  where om.user_id = v_user_id
  order by om.created_at asc
  limit 1;

  if v_organization_id is null then
    insert into public.organizations (name, created_by)
    values ('Mi empresa', v_user_id)
    returning id, name
    into v_organization_id, v_organization_name;

    insert into public.organization_members (
      organization_id,
      user_id,
      role
    )
    values (
      v_organization_id,
      v_user_id,
      'owner'
    );

    insert into public.company_settings (organization_id)
    values (v_organization_id)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'id', v_organization_id,
    'name', v_organization_name
  );
end;
$$;

alter function public.bootstrap_current_organization() owner to postgres;

revoke all on function public.bootstrap_current_organization() from public;
grant execute on function public.bootstrap_current_organization() to authenticated;

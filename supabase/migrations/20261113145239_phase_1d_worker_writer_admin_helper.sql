grant usage on schema public to priteca_worker_writer;
grant execute on function public.is_organization_admin(uuid) to priteca_worker_writer;
do $check$
begin
  if not pg_catalog.has_function_privilege('priteca_worker_writer','public.is_organization_admin(uuid)','EXECUTE') then
    raise exception 'El permiso EXECUTE del helper sigue ausente';
  end if;
end;
$check$;

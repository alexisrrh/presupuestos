-- The begin step must call the sealed actor bridge while keeping its own
-- organization/status/revision checks. No client role receives access to the
-- private helper; the public entry point remains narrowly executable.
begin;
alter function public.begin_worker_access_provision(uuid, integer) security definer;
alter function public.begin_worker_access_provision(uuid, integer) set search_path = pg_catalog, public, priteca_private;
alter function public.begin_worker_access_provision(uuid, integer) owner to postgres;
alter function public.finalize_worker_access_provision(uuid, integer, uuid, text) security definer;
alter function public.finalize_worker_access_provision(uuid, integer, uuid, text) set search_path = pg_catalog, public, priteca_private;
alter function public.finalize_worker_access_provision(uuid, integer, uuid, text) owner to postgres;
revoke all on function public.begin_worker_access_provision(uuid, integer) from public, anon;
grant execute on function public.begin_worker_access_provision(uuid, integer) to authenticated;
notify pgrst, 'reload schema';
commit;

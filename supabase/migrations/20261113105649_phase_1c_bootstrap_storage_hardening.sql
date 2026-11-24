-- Fase 1C.1: cerrar bootstrap legado y Storage privado por organizacion.

revoke all on function public.bootstrap_current_organization() from public;
revoke all on function public.bootstrap_current_organization() from anon;
revoke all on function public.bootstrap_current_organization() from authenticated;

do $$
declare policy_record record;
begin
  for policy_record in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'company_assets_%'
  loop
    execute format('drop policy if exists %I on storage.objects', policy_record.policyname);
  end loop;
end $$;

create policy company_assets_select_owner_admin
on storage.objects for select
using (
  bucket_id = 'company-assets'
  and name ~ '^organizations/[0-9a-fA-F-]{36}/[^/].*$'
  and public.is_organization_admin(split_part(name, '/', 2)::uuid)
);

create policy company_assets_insert_owner_admin
on storage.objects for insert
with check (
  bucket_id = 'company-assets'
  and name ~ '^organizations/[0-9a-fA-F-]{36}/[^/].*$'
  and public.is_organization_admin(split_part(name, '/', 2)::uuid)
);

create policy company_assets_update_owner_admin
on storage.objects for update
using (
  bucket_id = 'company-assets'
  and name ~ '^organizations/[0-9a-fA-F-]{36}/[^/].*$'
  and public.is_organization_admin(split_part(name, '/', 2)::uuid)
)
with check (
  bucket_id = 'company-assets'
  and name ~ '^organizations/[0-9a-fA-F-]{36}/[^/].*$'
  and public.is_organization_admin(split_part(name, '/', 2)::uuid)
);

create policy company_assets_delete_owner_admin
on storage.objects for delete
using (
  bucket_id = 'company-assets'
  and name ~ '^organizations/[0-9a-fA-F-]{36}/[^/].*$'
  and public.is_organization_admin(split_part(name, '/', 2)::uuid)
);

revoke insert, update, delete on public.worker_audit_log from anon, authenticated;
grant select on public.worker_audit_log to authenticated;

-- ACL minimo: expedientes y auditoria se conservan; no hay borrado fisico de aplicacion.
revoke all on public.workers, public.worker_audit_log from public, anon, authenticated;
grant select, insert, update on public.workers to authenticated;
grant select on public.worker_audit_log to authenticated;

drop policy if exists workers_admin_only on public.workers;
create policy workers_admin_select on public.workers for select using (public.is_organization_admin(organization_id));
create policy workers_admin_insert on public.workers for insert with check (public.is_organization_admin(organization_id));
create policy workers_admin_update on public.workers for update using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));

drop policy if exists members_read_active on public.organization_members;
create policy members_read_owner_admin on public.organization_members for select using (public.is_organization_admin(organization_id));
create policy members_read_employee_self on public.organization_members for select using (
  user_id = auth.uid() and public.has_active_role(organization_id, array['employee'])
);

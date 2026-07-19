drop policy if exists "organizations_select_member"
on public.organizations;

create policy "organizations_select_member_or_creator"
on public.organizations
for select
to authenticated
using (
  created_by = (select auth.uid())
  or public.is_organization_member(id)
);

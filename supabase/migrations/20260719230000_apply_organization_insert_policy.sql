drop policy if exists "organizations_insert_authenticated"
on public.organizations;

create policy "organizations_insert_authenticated"
on public.organizations
for insert
to authenticated
with check (
  created_by = (select auth.uid())
);

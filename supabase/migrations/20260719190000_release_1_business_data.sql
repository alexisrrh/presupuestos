create extension if not exists pgcrypto;

alter table public.organizations
  add column if not exists created_by uuid references auth.users(id),
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.organization_members
  alter column role set default 'owner',
  alter column created_at set default now();

alter table public.company_settings
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists business_name text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists province text,
  add column if not exists logo_url text,
  add column if not exists logo_data_url text,
  add column if not exists default_tax numeric,
  add column if not exists default_discount numeric default 0,
  add column if not exists professional_defaults jsonb default '{}'::jsonb;

create unique index if not exists company_settings_id_key on public.company_settings(id);

alter table public.budgets
  add column if not exists title text,
  add column if not exists document_type text,
  add column if not exists client_name text,
  add column if not exists client_tax_id text,
  add column if not exists client_email text,
  add column if not exists client_phone text,
  add column if not exists client_address text,
  add column if not exists issue_date date,
  add column if not exists validity_date date,
  add column if not exists notes text,
  add column if not exists technical_report jsonb default '{}'::jsonb,
  add column if not exists tax_rate numeric default 0,
  add column if not exists discount_rate numeric default 0,
  add column if not exists subtotal numeric default 0,
  add column if not exists discount_amount numeric default 0,
  add column if not exists tax_amount numeric default 0,
  add column if not exists total numeric default 0;

alter table public.budget_chapters
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists subtotal numeric default 0;

update public.budget_chapters
set title = coalesce(title, name)
where title is null;

alter table public.budget_items
  add column if not exists total numeric default 0;

alter table public.budgets
  drop constraint if exists budgets_document_type_check,
  add constraint budgets_document_type_check check (
    document_type is null or document_type in ('quick', 'professional')
  ),
  drop constraint if exists budgets_discount_rate_non_negative,
  add constraint budgets_discount_rate_non_negative check (discount_rate >= 0),
  drop constraint if exists budgets_tax_rate_non_negative,
  add constraint budgets_tax_rate_non_negative check (tax_rate >= 0),
  drop constraint if exists budgets_totals_non_negative,
  add constraint budgets_totals_non_negative check (
    subtotal >= 0 and discount_amount >= 0 and tax_amount >= 0 and total >= 0
  );

alter table public.budget_items
  drop constraint if exists budget_items_values_non_negative,
  add constraint budget_items_values_non_negative check (
    quantity >= 0 and unit_price >= 0 and total >= 0
  );

create index if not exists budgets_organization_id_idx on public.budgets(organization_id);
create index if not exists budget_chapters_budget_id_idx on public.budget_chapters(budget_id);
create index if not exists budget_items_chapter_id_idx on public.budget_items(chapter_id);

create or replace function public.is_organization_owner(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

drop policy if exists "organizations_update_admin" on public.organizations;
drop policy if exists "organizations_update_owner" on public.organizations;
create policy "organizations_update_owner" on public.organizations
for update
using (public.is_organization_owner(id))
with check (public.is_organization_owner(id));

drop policy if exists "organization_members_insert_admin" on public.organization_members;
drop policy if exists "organization_members_update_admin" on public.organization_members;
drop policy if exists "organization_members_delete_admin" on public.organization_members;
drop policy if exists "organization_members_insert_owner" on public.organization_members;
drop policy if exists "organization_members_update_owner" on public.organization_members;
drop policy if exists "organization_members_delete_owner" on public.organization_members;
create policy "organization_members_insert_owner" on public.organization_members
for insert
with check (public.is_organization_owner(organization_id));
create policy "organization_members_update_owner" on public.organization_members
for update
using (public.is_organization_owner(organization_id))
with check (public.is_organization_owner(organization_id));
create policy "organization_members_delete_owner" on public.organization_members
for delete
using (public.is_organization_owner(organization_id));

drop policy if exists "company_settings_insert_admin" on public.company_settings;
drop policy if exists "company_settings_update_admin" on public.company_settings;
drop policy if exists "company_settings_insert_member_v1" on public.company_settings;
drop policy if exists "company_settings_update_member_v1" on public.company_settings;
create policy "company_settings_insert_member_v1" on public.company_settings
for insert
with check (public.is_organization_member(organization_id));
create policy "company_settings_update_member_v1" on public.company_settings
for update
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists "budgets_delete_admin" on public.budgets;
drop policy if exists "budgets_delete_member_v1" on public.budgets;
create policy "budgets_delete_member_v1" on public.budgets
for delete
using (public.is_organization_member(organization_id));

drop policy if exists "budget_chapters_delete_admin" on public.budget_chapters;
drop policy if exists "budget_chapters_delete_member_v1" on public.budget_chapters;
create policy "budget_chapters_delete_member_v1" on public.budget_chapters
for delete
using (public.is_organization_member(organization_id));

drop policy if exists "budget_items_delete_admin" on public.budget_items;
drop policy if exists "budget_items_delete_member_v1" on public.budget_items;
create policy "budget_items_delete_member_v1" on public.budget_items
for delete
using (public.is_organization_member(organization_id));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  organization_id uuid;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;

  insert into public.organizations (name, created_by)
  values ('Mi empresa', new.id)
  returning id into organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (organization_id, new.id, 'owner')
  on conflict do nothing;

  insert into public.company_settings (
    organization_id,
    name,
    business_name,
    legal_name,
    default_tax,
    default_vat,
    default_validity_days
  )
  values (
    organization_id,
    'PRITECA',
    'PRITECA',
    'PRITECA Construcciones',
    21,
    21,
    30
  )
  on conflict (organization_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.save_budget_with_details(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  budget_payload jsonb := payload->'budget';
  chapters_payload jsonb := coalesce(payload->'chapters', '[]'::jsonb);
  v_organization_id uuid := (budget_payload->>'organization_id')::uuid;
  v_budget_id uuid;
  chapter_payload jsonb;
  item_payload jsonb;
  chapter_id uuid;
begin
  if auth.uid() is null or not public.is_organization_member(v_organization_id) then
    raise exception 'No autorizado.';
  end if;

  v_budget_id := nullif(budget_payload->>'id', '')::uuid;

  if v_budget_id is null then
    insert into public.budgets (
      organization_id, budget_number, title, status, document_type,
      client_name, client_tax_id, client_email, client_phone, client_address,
      project_address, issue_date, validity_days, notes, conditions,
      technical_report, tax_rate, discount_rate, subtotal, discount_amount,
      tax_amount, total, created_by
    )
    values (
      v_organization_id,
      budget_payload->>'budget_number',
      budget_payload->>'title',
      coalesce(budget_payload->>'status', 'draft'),
      coalesce(budget_payload->>'document_type', 'quick'),
      budget_payload->>'client_name',
      budget_payload->>'client_tax_id',
      budget_payload->>'client_email',
      budget_payload->>'client_phone',
      budget_payload->>'client_address',
      budget_payload->>'project_address',
      nullif(budget_payload->>'issue_date', '')::date,
      coalesce(nullif(budget_payload->>'validity_days', '')::integer, 0),
      budget_payload->>'notes',
      coalesce(budget_payload->'conditions', '{}'::jsonb),
      coalesce(budget_payload->'technical_report', '{}'::jsonb),
      coalesce(nullif(budget_payload->>'tax_rate', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'discount_rate', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'subtotal', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'discount_amount', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'tax_amount', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'total', '')::numeric, 0),
      auth.uid()
    )
    returning id into v_budget_id;
  else
    update public.budgets
    set
      budget_number = budget_payload->>'budget_number',
      title = budget_payload->>'title',
      status = coalesce(budget_payload->>'status', 'draft'),
      document_type = coalesce(budget_payload->>'document_type', 'quick'),
      client_name = budget_payload->>'client_name',
      client_tax_id = budget_payload->>'client_tax_id',
      client_email = budget_payload->>'client_email',
      client_phone = budget_payload->>'client_phone',
      client_address = budget_payload->>'client_address',
      project_address = budget_payload->>'project_address',
      issue_date = nullif(budget_payload->>'issue_date', '')::date,
      validity_days = coalesce(nullif(budget_payload->>'validity_days', '')::integer, 0),
      notes = budget_payload->>'notes',
      conditions = coalesce(budget_payload->'conditions', '{}'::jsonb),
      technical_report = coalesce(budget_payload->'technical_report', '{}'::jsonb),
      tax_rate = coalesce(nullif(budget_payload->>'tax_rate', '')::numeric, 0),
      discount_rate = coalesce(nullif(budget_payload->>'discount_rate', '')::numeric, 0),
      subtotal = coalesce(nullif(budget_payload->>'subtotal', '')::numeric, 0),
      discount_amount = coalesce(nullif(budget_payload->>'discount_amount', '')::numeric, 0),
      tax_amount = coalesce(nullif(budget_payload->>'tax_amount', '')::numeric, 0),
      total = coalesce(nullif(budget_payload->>'total', '')::numeric, 0)
    where id = v_budget_id and organization_id = v_organization_id;
  end if;

  delete from public.budget_chapters where budget_id = v_budget_id;

  for chapter_payload in select * from jsonb_array_elements(chapters_payload)
  loop
    insert into public.budget_chapters (
      budget_id, title, name, description, position, subtotal, organization_id
    )
    values (
      v_budget_id,
      chapter_payload->>'title',
      chapter_payload->>'title',
      chapter_payload->>'description',
      coalesce(nullif(chapter_payload->>'position', '')::integer, 0),
      coalesce(nullif(chapter_payload->>'subtotal', '')::numeric, 0),
      v_organization_id
    )
    returning id into chapter_id;

    for item_payload in select * from jsonb_array_elements(coalesce(chapter_payload->'items', '[]'::jsonb))
    loop
      insert into public.budget_items (
        chapter_id, organization_id, description, unit, quantity, unit_price, total, position
      )
      values (
        chapter_id,
        v_organization_id,
        item_payload->>'description',
        item_payload->>'unit',
        coalesce(nullif(item_payload->>'quantity', '')::numeric, 0),
        coalesce(nullif(item_payload->>'unit_price', '')::numeric, 0),
        coalesce(nullif(item_payload->>'total', '')::numeric, 0),
        coalesce(nullif(item_payload->>'position', '')::integer, 0)
      );
    end loop;
  end loop;

  return jsonb_build_object('id', v_budget_id);
end;
$$;

insert into storage.buckets (id, name, public)
values ('company-assets', 'company-assets', false)
on conflict (id) do nothing;

drop policy if exists "company_assets_read_members" on storage.objects;
create policy "company_assets_read_members"
on storage.objects for select
using (
  bucket_id = 'company-assets'
  and split_part(name, '/', 1) = 'organizations'
  and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_organization_member((split_part(name, '/', 2))::uuid)
);

drop policy if exists "company_assets_write_members" on storage.objects;
create policy "company_assets_write_members"
on storage.objects for insert
with check (
  bucket_id = 'company-assets'
  and split_part(name, '/', 1) = 'organizations'
  and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_organization_member((split_part(name, '/', 2))::uuid)
);

drop policy if exists "company_assets_update_members" on storage.objects;
create policy "company_assets_update_members"
on storage.objects for update
using (
  bucket_id = 'company-assets'
  and split_part(name, '/', 1) = 'organizations'
  and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_organization_member((split_part(name, '/', 2))::uuid)
)
with check (
  bucket_id = 'company-assets'
  and split_part(name, '/', 1) = 'organizations'
  and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_organization_member((split_part(name, '/', 2))::uuid)
);

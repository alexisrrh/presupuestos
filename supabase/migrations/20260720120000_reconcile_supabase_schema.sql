create extension if not exists pgcrypto;

alter table public.organizations
  add column if not exists created_by uuid references auth.users(id),
  alter column name set not null,
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.organization_members
  alter column role set default 'member',
  alter column created_at set default now();

alter table public.company_settings
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists name text,
  add column if not exists business_name text,
  add column if not exists legal_name text,
  add column if not exists tax_id text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists address text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists province text,
  add column if not exists iban text,
  add column if not exists logo_path text,
  add column if not exists logo_url text,
  add column if not exists logo_data_url text,
  add column if not exists default_vat numeric default 21,
  add column if not exists default_tax numeric default 21,
  add column if not exists default_discount numeric default 0,
  add column if not exists default_validity_days integer default 30,
  add column if not exists default_payment_terms text default '',
  add column if not exists default_execution_time text default '',
  add column if not exists default_observations text default '',
  add column if not exists professional_defaults jsonb default '{}'::jsonb,
  alter column id set default gen_random_uuid(),
  alter column default_vat set default 21,
  alter column default_tax set default 21,
  alter column default_discount set default 0,
  alter column default_validity_days set default 30,
  alter column default_payment_terms set default '',
  alter column default_execution_time set default '',
  alter column default_observations set default '',
  alter column professional_defaults set default '{}'::jsonb,
  alter column created_at set default now(),
  alter column updated_at set default now();

update public.company_settings
set
  business_name = coalesce(business_name, name, legal_name),
  name = coalesce(name, business_name, legal_name, 'PRITECA'),
  default_tax = coalesce(default_tax, default_vat, 21),
  default_vat = coalesce(default_vat, default_tax, 21),
  default_discount = coalesce(default_discount, 0),
  default_validity_days = coalesce(default_validity_days, 30),
  default_payment_terms = coalesce(default_payment_terms, ''),
  default_execution_time = coalesce(default_execution_time, ''),
  default_observations = coalesce(default_observations, ''),
  professional_defaults = coalesce(professional_defaults, '{}'::jsonb);

create unique index if not exists company_settings_id_key on public.company_settings(id);

alter table public.clients
  alter column name set not null,
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.budgets
  add column if not exists client_id uuid,
  add column if not exists budget_number text,
  add column if not exists status text default 'draft',
  add column if not exists document_type text default 'quick',
  add column if not exists title text,
  add column if not exists client_name text,
  add column if not exists client_tax_id text,
  add column if not exists client_email text,
  add column if not exists client_phone text,
  add column if not exists client_address text,
  add column if not exists project_address text,
  add column if not exists issue_date date,
  add column if not exists validity_days integer default 30,
  add column if not exists notes text default '',
  add column if not exists conditions jsonb default '{}'::jsonb,
  add column if not exists technical_report jsonb default '{}'::jsonb,
  add column if not exists tax_rate numeric default 21,
  add column if not exists discount_rate numeric default 0,
  add column if not exists subtotal numeric default 0,
  add column if not exists discount_amount numeric default 0,
  add column if not exists tax_amount numeric default 0,
  add column if not exists total numeric default 0,
  add column if not exists budget_date date,
  add column if not exists project_name text,
  add column if not exists client_snapshot jsonb default '{}'::jsonb,
  add column if not exists discount_percentage numeric default 0,
  add column if not exists vat_percentage numeric default 21,
  add column if not exists created_by uuid references auth.users(id),
  alter column status set default 'draft',
  alter column document_type set default 'quick',
  alter column validity_days set default 30,
  alter column notes set default '',
  alter column conditions set default '{}'::jsonb,
  alter column technical_report set default '{}'::jsonb,
  alter column tax_rate set default 21,
  alter column discount_rate set default 0,
  alter column subtotal set default 0,
  alter column discount_amount set default 0,
  alter column tax_amount set default 0,
  alter column total set default 0,
  alter column client_snapshot set default '{}'::jsonb,
  alter column discount_percentage set default 0,
  alter column vat_percentage set default 21,
  alter column created_at set default now(),
  alter column updated_at set default now();

do $$
begin
  alter table public.budgets alter column conditions type jsonb using coalesce(conditions::jsonb, '{}'::jsonb);
  alter table public.budgets alter column technical_report type jsonb using coalesce(technical_report::jsonb, '{}'::jsonb);
  alter table public.budgets alter column client_snapshot type jsonb using coalesce(client_snapshot::jsonb, '{}'::jsonb);
  alter table public.budgets alter column tax_rate type numeric using coalesce(tax_rate::numeric, 21);
  alter table public.budgets alter column discount_rate type numeric using coalesce(discount_rate::numeric, 0);
  alter table public.budgets alter column subtotal type numeric using coalesce(subtotal::numeric, 0);
  alter table public.budgets alter column discount_amount type numeric using coalesce(discount_amount::numeric, 0);
  alter table public.budgets alter column tax_amount type numeric using coalesce(tax_amount::numeric, 0);
  alter table public.budgets alter column total type numeric using coalesce(total::numeric, 0);
  alter table public.budgets alter column discount_percentage type numeric using coalesce(discount_percentage::numeric, 0);
  alter table public.budgets alter column vat_percentage type numeric using coalesce(vat_percentage::numeric, 21);
exception
  when others then
    raise notice 'No se pudieron convertir automaticamente algunos tipos de budgets: %', sqlerrm;
end $$;

update public.budgets
set
  budget_number = coalesce(nullif(budget_number, ''), 'PR-LEGACY-' || left(id::text, 8)),
  title = coalesce(nullif(title, ''), nullif(project_name, ''), 'Presupuesto de obra'),
  issue_date = coalesce(issue_date, budget_date),
  tax_rate = coalesce(tax_rate, vat_percentage, 21),
  discount_rate = coalesce(discount_rate, discount_percentage, 0),
  client_name = coalesce(nullif(client_name, ''), client_snapshot->>'name', client_snapshot->>'client_name'),
  client_tax_id = coalesce(nullif(client_tax_id, ''), client_snapshot->>'tax_id', client_snapshot->>'taxId', client_snapshot->>'client_tax_id'),
  client_email = coalesce(nullif(client_email, ''), client_snapshot->>'email', client_snapshot->>'client_email'),
  client_phone = coalesce(nullif(client_phone, ''), client_snapshot->>'phone', client_snapshot->>'client_phone'),
  client_address = coalesce(nullif(client_address, ''), client_snapshot->>'address', client_snapshot->>'client_address'),
  document_type = coalesce(nullif(document_type, ''), 'quick'),
  status = coalesce(nullif(status, ''), 'draft'),
  validity_days = coalesce(validity_days, 30),
  notes = coalesce(notes, conditions->>'notes', ''),
  conditions = coalesce(conditions, '{}'::jsonb),
  technical_report = coalesce(technical_report, '{}'::jsonb),
  subtotal = coalesce(subtotal, 0),
  discount_amount = coalesce(discount_amount, 0),
  tax_amount = coalesce(tax_amount, 0),
  total = coalesce(total, 0),
  budget_date = coalesce(budget_date, issue_date),
  project_name = coalesce(nullif(project_name, ''), title),
  discount_percentage = coalesce(discount_percentage, discount_rate, 0),
  vat_percentage = coalesce(vat_percentage, tax_rate, 21),
  client_snapshot = coalesce(client_snapshot, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'name', client_name,
    'tax_id', client_tax_id,
    'email', client_email,
    'phone', client_phone,
    'address', client_address
  ));

with duplicated_budgets as (
  select
    id,
    row_number() over (
      partition by organization_id, budget_number
      order by created_at, id
    ) as duplicate_position
  from public.budgets
)
update public.budgets b
set budget_number = b.budget_number || '-' || left(b.id::text, 8)
from duplicated_budgets d
where b.id = d.id
  and d.duplicate_position > 1;

alter table public.budgets
  alter column budget_number set not null,
  alter column status set not null,
  alter column document_type set not null;

alter table public.budget_chapters
  add column if not exists title text,
  add column if not exists name text,
  add column if not exists description text default '',
  add column if not exists position integer default 0,
  add column if not exists subtotal numeric default 0,
  alter column description set default '',
  alter column position set default 0,
  alter column subtotal set default 0,
  alter column created_at set default now(),
  alter column updated_at set default now();

update public.budget_chapters
set
  title = coalesce(nullif(title, ''), nullif(name, ''), 'Capitulo'),
  name = coalesce(nullif(name, ''), nullif(title, ''), 'Capitulo'),
  description = coalesce(description, ''),
  position = coalesce(position, 0),
  subtotal = coalesce(subtotal, 0);

alter table public.budget_items
  add column if not exists description text default '',
  add column if not exists unit text default '',
  add column if not exists quantity numeric default 0,
  add column if not exists unit_price numeric default 0,
  add column if not exists total numeric default 0,
  add column if not exists position integer default 0,
  alter column description set default '',
  alter column unit set default '',
  alter column quantity set default 0,
  alter column unit_price set default 0,
  alter column total set default 0,
  alter column position set default 0,
  alter column created_at set default now(),
  alter column updated_at set default now();

update public.budget_items
set
  description = coalesce(description, ''),
  unit = coalesce(unit, ''),
  quantity = coalesce(quantity, 0),
  unit_price = coalesce(unit_price, 0),
  total = coalesce(total, quantity * unit_price, 0),
  position = coalesce(position, 0);

alter table public.budgets
  drop constraint if exists budgets_status_check,
  add constraint budgets_status_check check (status in ('draft', 'sent', 'accepted', 'rejected')),
  drop constraint if exists budgets_document_type_check,
  add constraint budgets_document_type_check check (document_type in ('quick', 'professional')),
  drop constraint if exists budgets_discount_rate_non_negative,
  add constraint budgets_discount_rate_non_negative check (discount_rate >= 0),
  drop constraint if exists budgets_tax_rate_non_negative,
  add constraint budgets_tax_rate_non_negative check (tax_rate >= 0),
  drop constraint if exists budgets_totals_non_negative,
  add constraint budgets_totals_non_negative check (subtotal >= 0 and discount_amount >= 0 and tax_amount >= 0 and total >= 0);

alter table public.budget_items
  drop constraint if exists budget_items_values_non_negative,
  add constraint budget_items_values_non_negative check (quantity >= 0 and unit_price >= 0 and total >= 0);

alter table public.organization_members
  drop constraint if exists organization_members_role_check,
  add constraint organization_members_role_check check (role in ('owner', 'admin', 'member'));

do $$
begin
  if exists (
    select 1
    from public.budgets b
    left join public.clients c on c.id = b.client_id and c.organization_id = b.organization_id
    where b.client_id is not null and c.id is null
  ) then
    update public.budgets b
    set client_id = null
    where b.client_id is not null
      and not exists (
        select 1 from public.clients c
        where c.id = b.client_id and c.organization_id = b.organization_id
      );
  end if;
end $$;

alter table public.budgets drop constraint if exists budgets_organization_id_fkey;
alter table public.budgets
  add constraint budgets_organization_id_fkey foreign key (organization_id)
  references public.organizations(id) on delete cascade not valid;
alter table public.budgets validate constraint budgets_organization_id_fkey;

alter table public.budgets drop constraint if exists budgets_client_id_fkey;
alter table public.budgets
  add constraint budgets_client_id_fkey foreign key (client_id)
  references public.clients(id) on delete set null not valid;
alter table public.budgets validate constraint budgets_client_id_fkey;

alter table public.budget_chapters drop constraint if exists budget_chapters_budget_id_fkey;
alter table public.budget_chapters
  add constraint budget_chapters_budget_id_fkey foreign key (budget_id)
  references public.budgets(id) on delete cascade not valid;
alter table public.budget_chapters validate constraint budget_chapters_budget_id_fkey;

alter table public.budget_chapters drop constraint if exists budget_chapters_organization_id_fkey;
alter table public.budget_chapters
  add constraint budget_chapters_organization_id_fkey foreign key (organization_id)
  references public.organizations(id) on delete cascade not valid;
alter table public.budget_chapters validate constraint budget_chapters_organization_id_fkey;

alter table public.budget_items drop constraint if exists budget_items_chapter_id_fkey;
alter table public.budget_items
  add constraint budget_items_chapter_id_fkey foreign key (chapter_id)
  references public.budget_chapters(id) on delete cascade not valid;
alter table public.budget_items validate constraint budget_items_chapter_id_fkey;

alter table public.budget_items drop constraint if exists budget_items_organization_id_fkey;
alter table public.budget_items
  add constraint budget_items_organization_id_fkey foreign key (organization_id)
  references public.organizations(id) on delete cascade not valid;
alter table public.budget_items validate constraint budget_items_organization_id_fkey;

create unique index if not exists budgets_organization_budget_number_key on public.budgets(organization_id, budget_number);
create index if not exists organization_members_user_id_idx on public.organization_members(user_id);
create index if not exists clients_organization_id_idx on public.clients(organization_id);
create index if not exists clients_name_idx on public.clients(name);
create index if not exists budgets_organization_id_idx on public.budgets(organization_id);
create index if not exists budgets_client_id_idx on public.budgets(client_id);
create index if not exists budgets_status_idx on public.budgets(status);
create index if not exists budgets_issue_date_idx on public.budgets(issue_date);
create index if not exists budget_chapters_budget_id_idx on public.budget_chapters(budget_id);
create index if not exists budget_chapters_organization_id_idx on public.budget_chapters(organization_id);
create index if not exists budget_items_chapter_id_idx on public.budget_items(chapter_id);
create index if not exists budget_items_organization_id_idx on public.budget_items(organization_id);

create or replace function public.is_organization_member(target_organization_id uuid)
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
  );
$$;

create or replace function public.is_organization_admin(target_organization_id uuid)
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
      and role in ('owner', 'admin')
  );
$$;

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

alter function public.is_organization_member(uuid) owner to postgres;
alter function public.is_organization_admin(uuid) owner to postgres;
alter function public.is_organization_owner(uuid) owner to postgres;

revoke all on function public.is_organization_member(uuid) from public;
revoke all on function public.is_organization_admin(uuid) from public;
revoke all on function public.is_organization_owner(uuid) from public;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.is_organization_admin(uuid) to authenticated;
grant execute on function public.is_organization_owner(uuid) to authenticated;

create or replace function public.validate_budget_client_organization()
returns trigger
language plpgsql
as $$
begin
  if new.client_id is not null and not exists (
    select 1
    from public.clients
    where id = new.client_id
      and organization_id = new.organization_id
  ) then
    raise exception 'El cliente no pertenece a la organizacion del presupuesto.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_chapter_organization()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.budgets
    where id = new.budget_id
      and organization_id = new.organization_id
  ) then
    raise exception 'El capitulo no coincide con la organizacion del presupuesto.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_item_organization()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.budget_chapters
    where id = new.chapter_id
      and organization_id = new.organization_id
  ) then
    raise exception 'La partida no coincide con la organizacion del capitulo.';
  end if;

  return new;
end;
$$;

drop trigger if exists budgets_validate_client_organization on public.budgets;
create trigger budgets_validate_client_organization
before insert or update on public.budgets
for each row execute function public.validate_budget_client_organization();

drop trigger if exists budget_chapters_validate_organization on public.budget_chapters;
create trigger budget_chapters_validate_organization
before insert or update on public.budget_chapters
for each row execute function public.validate_chapter_organization();

drop trigger if exists budget_items_validate_organization on public.budget_items;
create trigger budget_items_validate_organization
before insert or update on public.budget_items
for each row execute function public.validate_item_organization();

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
    returning id, name into v_organization_id, v_organization_name;

    insert into public.organization_members (organization_id, user_id, role)
    values (v_organization_id, v_user_id, 'owner')
    on conflict (organization_id, user_id) do update set role = 'owner';
  end if;

  insert into public.company_settings (
    organization_id,
    name,
    business_name,
    legal_name,
    default_tax,
    default_vat,
    default_discount,
    default_validity_days
  )
  values (
    v_organization_id,
    'PRITECA',
    'PRITECA',
    'PRITECA Construcciones',
    21,
    21,
    0,
    30
  )
  on conflict (organization_id) do nothing;

  return jsonb_build_object('id', v_organization_id, 'name', v_organization_name);
end;
$$;

alter function public.bootstrap_current_organization() owner to postgres;
revoke all on function public.bootstrap_current_organization() from public;
grant execute on function public.bootstrap_current_organization() to authenticated;

create or replace function public.save_budget_with_details(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  budget_payload jsonb := payload->'budget';
  chapters_payload jsonb := coalesce(payload->'chapters', '[]'::jsonb);
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_existing_organization_id uuid;
  v_budget_id uuid;
  v_client_id uuid;
  chapter_payload jsonb;
  item_payload jsonb;
  chapter_id uuid;
begin
  if v_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if budget_payload is null then
    raise exception 'Payload de presupuesto invalido.';
  end if;

  v_organization_id := nullif(budget_payload->>'organization_id', '')::uuid;

  if v_organization_id is null or not public.is_organization_member(v_organization_id) then
    raise exception 'No autorizado.';
  end if;

  v_client_id := nullif(budget_payload->>'client_id', '')::uuid;

  if v_client_id is not null and not exists (
    select 1 from public.clients
    where id = v_client_id and organization_id = v_organization_id
  ) then
    raise exception 'El cliente no pertenece a la organizacion del presupuesto.';
  end if;

  v_budget_id := nullif(budget_payload->>'id', '')::uuid;

  if v_budget_id is not null then
    select organization_id into v_existing_organization_id
    from public.budgets
    where id = v_budget_id;

    if v_existing_organization_id is null then
      raise exception 'Presupuesto no encontrado.';
    end if;

    if v_existing_organization_id <> v_organization_id then
      raise exception 'No autorizado.';
    end if;
  end if;

  if v_budget_id is null then
    insert into public.budgets (
      organization_id, client_id, budget_number, title, status, document_type,
      client_name, client_tax_id, client_email, client_phone, client_address,
      project_address, issue_date, validity_days, notes, conditions,
      technical_report, tax_rate, discount_rate, subtotal, discount_amount,
      tax_amount, total, budget_date, project_name, client_snapshot,
      discount_percentage, vat_percentage, created_by
    )
    values (
      v_organization_id,
      v_client_id,
      budget_payload->>'budget_number',
      coalesce(nullif(budget_payload->>'title', ''), 'Presupuesto de obra'),
      coalesce(nullif(budget_payload->>'status', ''), 'draft'),
      coalesce(nullif(budget_payload->>'document_type', ''), 'quick'),
      coalesce(budget_payload->>'client_name', ''),
      coalesce(budget_payload->>'client_tax_id', ''),
      coalesce(budget_payload->>'client_email', ''),
      coalesce(budget_payload->>'client_phone', ''),
      coalesce(budget_payload->>'client_address', ''),
      coalesce(budget_payload->>'project_address', ''),
      nullif(budget_payload->>'issue_date', '')::date,
      coalesce(nullif(budget_payload->>'validity_days', '')::integer, 30),
      coalesce(budget_payload->>'notes', ''),
      coalesce(budget_payload->'conditions', '{}'::jsonb),
      coalesce(budget_payload->'technical_report', '{}'::jsonb),
      coalesce(nullif(budget_payload->>'tax_rate', '')::numeric, 21),
      coalesce(nullif(budget_payload->>'discount_rate', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'subtotal', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'discount_amount', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'tax_amount', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'total', '')::numeric, 0),
      nullif(budget_payload->>'issue_date', '')::date,
      coalesce(nullif(budget_payload->>'title', ''), 'Presupuesto de obra'),
      jsonb_strip_nulls(jsonb_build_object(
        'name', budget_payload->>'client_name',
        'tax_id', budget_payload->>'client_tax_id',
        'email', budget_payload->>'client_email',
        'phone', budget_payload->>'client_phone',
        'address', budget_payload->>'client_address'
      )),
      coalesce(nullif(budget_payload->>'discount_rate', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'tax_rate', '')::numeric, 21),
      v_user_id
    )
    returning id into v_budget_id;
  else
    update public.budgets
    set
      client_id = v_client_id,
      budget_number = budget_payload->>'budget_number',
      title = coalesce(nullif(budget_payload->>'title', ''), 'Presupuesto de obra'),
      status = coalesce(nullif(budget_payload->>'status', ''), 'draft'),
      document_type = coalesce(nullif(budget_payload->>'document_type', ''), 'quick'),
      client_name = coalesce(budget_payload->>'client_name', ''),
      client_tax_id = coalesce(budget_payload->>'client_tax_id', ''),
      client_email = coalesce(budget_payload->>'client_email', ''),
      client_phone = coalesce(budget_payload->>'client_phone', ''),
      client_address = coalesce(budget_payload->>'client_address', ''),
      project_address = coalesce(budget_payload->>'project_address', ''),
      issue_date = nullif(budget_payload->>'issue_date', '')::date,
      validity_days = coalesce(nullif(budget_payload->>'validity_days', '')::integer, 30),
      notes = coalesce(budget_payload->>'notes', ''),
      conditions = coalesce(budget_payload->'conditions', '{}'::jsonb),
      technical_report = coalesce(budget_payload->'technical_report', '{}'::jsonb),
      tax_rate = coalesce(nullif(budget_payload->>'tax_rate', '')::numeric, 21),
      discount_rate = coalesce(nullif(budget_payload->>'discount_rate', '')::numeric, 0),
      subtotal = coalesce(nullif(budget_payload->>'subtotal', '')::numeric, 0),
      discount_amount = coalesce(nullif(budget_payload->>'discount_amount', '')::numeric, 0),
      tax_amount = coalesce(nullif(budget_payload->>'tax_amount', '')::numeric, 0),
      total = coalesce(nullif(budget_payload->>'total', '')::numeric, 0),
      budget_date = nullif(budget_payload->>'issue_date', '')::date,
      project_name = coalesce(nullif(budget_payload->>'title', ''), 'Presupuesto de obra'),
      client_snapshot = jsonb_strip_nulls(jsonb_build_object(
        'name', budget_payload->>'client_name',
        'tax_id', budget_payload->>'client_tax_id',
        'email', budget_payload->>'client_email',
        'phone', budget_payload->>'client_phone',
        'address', budget_payload->>'client_address'
      )),
      discount_percentage = coalesce(nullif(budget_payload->>'discount_rate', '')::numeric, 0),
      vat_percentage = coalesce(nullif(budget_payload->>'tax_rate', '')::numeric, 21)
    where id = v_budget_id
      and organization_id = v_organization_id;

    if not found then
      raise exception 'Presupuesto no encontrado.';
    end if;
  end if;

  delete from public.budget_chapters
  where budget_id = v_budget_id
    and organization_id = v_organization_id;

  for chapter_payload in select * from jsonb_array_elements(chapters_payload)
  loop
    insert into public.budget_chapters (
      budget_id, organization_id, title, name, description, position, subtotal
    )
    values (
      v_budget_id,
      v_organization_id,
      coalesce(nullif(chapter_payload->>'title', ''), nullif(chapter_payload->>'name', ''), 'Capitulo'),
      coalesce(nullif(chapter_payload->>'name', ''), nullif(chapter_payload->>'title', ''), 'Capitulo'),
      coalesce(chapter_payload->>'description', ''),
      coalesce(nullif(chapter_payload->>'position', '')::integer, 0),
      coalesce(nullif(chapter_payload->>'subtotal', '')::numeric, 0)
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
        coalesce(item_payload->>'description', ''),
        coalesce(item_payload->>'unit', ''),
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

alter function public.save_budget_with_details(jsonb) owner to postgres;
revoke all on function public.save_budget_with_details(jsonb) from public;
grant execute on function public.save_budget_with_details(jsonb) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.company_settings enable row level security;
alter table public.clients enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_chapters enable row level security;
alter table public.budget_items enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'organizations',
        'organization_members',
        'company_settings',
        'clients',
        'budgets',
        'budget_chapters',
        'budget_items'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

create policy "organizations_select_member_or_creator"
on public.organizations
for select
using (created_by = auth.uid() or public.is_organization_member(id));

create policy "organizations_insert_authenticated_owner"
on public.organizations
for insert
with check (auth.uid() is not null and created_by = auth.uid());

create policy "organizations_update_admin"
on public.organizations
for update
using (public.is_organization_admin(id))
with check (public.is_organization_admin(id));

create policy "organization_members_select_member"
on public.organization_members
for select
using (public.is_organization_member(organization_id));

create policy "organization_members_insert_admin"
on public.organization_members
for insert
with check (public.is_organization_admin(organization_id));

create policy "organization_members_insert_creator_owner"
on public.organization_members
for insert
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and role = 'owner'
  and exists (
    select 1
    from public.organizations
    where organizations.id = organization_id
      and organizations.created_by = auth.uid()
  )
);

create policy "organization_members_update_admin"
on public.organization_members
for update
using (public.is_organization_admin(organization_id))
with check (public.is_organization_admin(organization_id));

create policy "organization_members_delete_admin"
on public.organization_members
for delete
using (public.is_organization_admin(organization_id));

create policy "company_settings_select_member"
on public.company_settings
for select
using (public.is_organization_member(organization_id));

create policy "company_settings_insert_admin"
on public.company_settings
for insert
with check (public.is_organization_admin(organization_id));

create policy "company_settings_update_admin"
on public.company_settings
for update
using (public.is_organization_admin(organization_id))
with check (public.is_organization_admin(organization_id));

create policy "clients_select_member"
on public.clients
for select
using (public.is_organization_member(organization_id));

create policy "clients_insert_member"
on public.clients
for insert
with check (public.is_organization_member(organization_id) and created_by = auth.uid());

create policy "clients_update_member"
on public.clients
for update
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "clients_delete_member"
on public.clients
for delete
using (public.is_organization_member(organization_id));

create policy "budgets_select_member"
on public.budgets
for select
using (public.is_organization_member(organization_id));

create policy "budgets_insert_member"
on public.budgets
for insert
with check (public.is_organization_member(organization_id) and created_by = auth.uid());

create policy "budgets_update_member"
on public.budgets
for update
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "budgets_delete_member"
on public.budgets
for delete
using (public.is_organization_member(organization_id));

create policy "budget_chapters_select_member"
on public.budget_chapters
for select
using (public.is_organization_member(organization_id));

create policy "budget_chapters_insert_member"
on public.budget_chapters
for insert
with check (
  public.is_organization_member(organization_id)
  and exists (
    select 1
    from public.budgets
    where budgets.id = budget_id
      and budgets.organization_id = budget_chapters.organization_id
  )
);

create policy "budget_chapters_update_member"
on public.budget_chapters
for update
using (public.is_organization_member(organization_id))
with check (
  public.is_organization_member(organization_id)
  and exists (
    select 1
    from public.budgets
    where budgets.id = budget_id
      and budgets.organization_id = budget_chapters.organization_id
  )
);

create policy "budget_chapters_delete_member"
on public.budget_chapters
for delete
using (public.is_organization_member(organization_id));

create policy "budget_items_select_member"
on public.budget_items
for select
using (public.is_organization_member(organization_id));

create policy "budget_items_insert_member"
on public.budget_items
for insert
with check (
  public.is_organization_member(organization_id)
  and exists (
    select 1
    from public.budget_chapters
    where budget_chapters.id = chapter_id
      and budget_chapters.organization_id = budget_items.organization_id
  )
);

create policy "budget_items_update_member"
on public.budget_items
for update
using (public.is_organization_member(organization_id))
with check (
  public.is_organization_member(organization_id)
  and exists (
    select 1
    from public.budget_chapters
    where budget_chapters.id = chapter_id
      and budget_chapters.organization_id = budget_items.organization_id
  )
);

create policy "budget_items_delete_member"
on public.budget_items
for delete
using (public.is_organization_member(organization_id));

notify pgrst, 'reload schema';

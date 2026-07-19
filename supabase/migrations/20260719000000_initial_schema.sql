create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.company_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  name text,
  legal_name text,
  tax_id text,
  phone text,
  email text,
  website text,
  address text,
  iban text,
  logo_path text,
  default_vat numeric,
  default_validity_days integer,
  default_payment_terms text,
  default_execution_time text,
  default_observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  tax_id text,
  phone text,
  email text,
  address text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  budget_number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected')),
  budget_date date,
  validity_days integer,
  project_name text,
  project_address text,
  client_snapshot jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '{}'::jsonb,
  discount_percentage numeric not null default 0,
  vat_percentage numeric not null default 21,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, budget_number)
);

create table public.budget_chapters (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.budget_chapters(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  description text,
  quantity numeric not null default 0,
  unit text,
  unit_price numeric not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organization_members_user_id_idx on public.organization_members(user_id);
create index clients_organization_id_idx on public.clients(organization_id);
create index clients_name_idx on public.clients(name);
create index budgets_organization_id_idx on public.budgets(organization_id);
create index budgets_client_id_idx on public.budgets(client_id);
create index budgets_status_idx on public.budgets(status);
create index budgets_budget_date_idx on public.budgets(budget_date);
create index budget_chapters_budget_id_idx on public.budget_chapters(budget_id);
create index budget_items_chapter_id_idx on public.budget_items(chapter_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger company_settings_set_updated_at before update on public.company_settings for each row execute function public.set_updated_at();
create trigger clients_set_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger budgets_set_updated_at before update on public.budgets for each row execute function public.set_updated_at();
create trigger budget_chapters_set_updated_at before update on public.budget_chapters for each row execute function public.set_updated_at();
create trigger budget_items_set_updated_at before update on public.budget_items for each row execute function public.set_updated_at();

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

create or replace function public.prevent_ownerless_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'owner' and (
    tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.role <> 'owner')
  ) then
    if not exists (
      select 1
      from public.organization_members
      where organization_id = old.organization_id
        and user_id <> old.user_id
        and role = 'owner'
    ) then
      raise exception 'La organizacion debe conservar al menos un owner.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger organization_members_prevent_ownerless
before update or delete on public.organization_members
for each row execute function public.prevent_ownerless_organization();

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

create trigger budgets_validate_client_organization
before insert or update on public.budgets
for each row execute function public.validate_budget_client_organization();

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

create trigger budget_chapters_validate_organization
before insert or update on public.budget_chapters
for each row execute function public.validate_chapter_organization();

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

create trigger budget_items_validate_organization
before insert or update on public.budget_items
for each row execute function public.validate_item_organization();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
  organization_id uuid;
begin
  profile_name := coalesce(new.raw_user_meta_data->>'full_name', new.email, 'Mi empresa');

  insert into public.profiles (id, full_name)
  values (new.id, profile_name);

  insert into public.organizations (name, created_by)
  values (coalesce(nullif(profile_name, ''), 'Mi empresa'), new.id)
  returning id into organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (organization_id, new.id, 'owner');

  insert into public.company_settings (
    organization_id,
    name,
    legal_name,
    default_vat,
    default_validity_days
  )
  values (
    organization_id,
    'PRITECA',
    'PRITECA Construcciones',
    21,
    30
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.company_settings enable row level security;
alter table public.clients enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_chapters enable row level security;
alter table public.budget_items enable row level security;

create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "organizations_select_member" on public.organizations for select using (public.is_organization_member(id));
create policy "organizations_update_admin" on public.organizations for update using (public.is_organization_admin(id)) with check (public.is_organization_admin(id));

create policy "organization_members_select_member" on public.organization_members for select using (public.is_organization_member(organization_id));
create policy "organization_members_insert_admin" on public.organization_members for insert with check (public.is_organization_admin(organization_id));
create policy "organization_members_update_admin" on public.organization_members for update using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));
create policy "organization_members_delete_admin" on public.organization_members for delete using (public.is_organization_admin(organization_id));

create policy "company_settings_select_member" on public.company_settings for select using (public.is_organization_member(organization_id));
create policy "company_settings_insert_admin" on public.company_settings for insert with check (public.is_organization_admin(organization_id));
create policy "company_settings_update_admin" on public.company_settings for update using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));

create policy "clients_select_member" on public.clients for select using (public.is_organization_member(organization_id));
create policy "clients_insert_member" on public.clients for insert with check (public.is_organization_member(organization_id) and created_by = auth.uid());
create policy "clients_update_member" on public.clients for update using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
create policy "clients_delete_admin" on public.clients for delete using (public.is_organization_admin(organization_id));

create policy "budgets_select_member" on public.budgets for select using (public.is_organization_member(organization_id));
create policy "budgets_insert_member" on public.budgets for insert with check (public.is_organization_member(organization_id) and created_by = auth.uid());
create policy "budgets_update_member" on public.budgets for update using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
create policy "budgets_delete_admin" on public.budgets for delete using (public.is_organization_admin(organization_id));

create policy "budget_chapters_select_member" on public.budget_chapters for select using (public.is_organization_member(organization_id));
create policy "budget_chapters_insert_member" on public.budget_chapters for insert with check (
  public.is_organization_member(organization_id)
  and exists (
    select 1 from public.budgets
    where budgets.id = budget_id
      and budgets.organization_id = budget_chapters.organization_id
  )
);
create policy "budget_chapters_update_member" on public.budget_chapters for update using (public.is_organization_member(organization_id)) with check (
  public.is_organization_member(organization_id)
  and exists (
    select 1 from public.budgets
    where budgets.id = budget_id
      and budgets.organization_id = budget_chapters.organization_id
  )
);
create policy "budget_chapters_delete_admin" on public.budget_chapters for delete using (public.is_organization_admin(organization_id));

create policy "budget_items_select_member" on public.budget_items for select using (public.is_organization_member(organization_id));
create policy "budget_items_insert_member" on public.budget_items for insert with check (
  public.is_organization_member(organization_id)
  and exists (
    select 1 from public.budget_chapters
    where budget_chapters.id = chapter_id
      and budget_chapters.organization_id = budget_items.organization_id
  )
);
create policy "budget_items_update_member" on public.budget_items for update using (public.is_organization_member(organization_id)) with check (
  public.is_organization_member(organization_id)
  and exists (
    select 1 from public.budget_chapters
    where budget_chapters.id = chapter_id
      and budget_chapters.organization_id = budget_items.organization_id
  )
);
create policy "budget_items_delete_admin" on public.budget_items for delete using (public.is_organization_admin(organization_id));

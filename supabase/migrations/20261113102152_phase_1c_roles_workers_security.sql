-- Fase 1C.1: roles efectivos y trabajadores. Esta migracion no toca proyectos remotos.

alter table public.organization_members
  add column if not exists is_active boolean not null default true;

alter table public.organization_members
  drop constraint if exists organization_members_role_check;
alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('owner', 'admin', 'employee', 'member'));

create or replace function public.has_active_role(target_organization_id uuid, allowed_roles text[])
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and is_active
      and role = any(allowed_roles)
  );
$$;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean language sql security definer set search_path = public, auth as $$
  select public.has_active_role(target_organization_id, array['owner', 'admin']);
$$;
create or replace function public.is_organization_admin(target_organization_id uuid)
returns boolean language sql security definer set search_path = public, auth as $$
  select public.has_active_role(target_organization_id, array['owner', 'admin']);
$$;
create or replace function public.is_organization_owner(target_organization_id uuid)
returns boolean language sql security definer set search_path = public, auth as $$
  select public.has_active_role(target_organization_id, array['owner']);
$$;

alter function public.has_active_role(uuid, text[]) owner to postgres;
alter function public.is_organization_member(uuid) owner to postgres;
alter function public.is_organization_admin(uuid) owner to postgres;
alter function public.is_organization_owner(uuid) owner to postgres;
revoke all on function public.has_active_role(uuid, text[]) from public;
revoke all on function public.is_organization_member(uuid) from public;
revoke all on function public.is_organization_admin(uuid) from public;
revoke all on function public.is_organization_owner(uuid) from public;
grant execute on function public.has_active_role(uuid, text[]) to authenticated;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.is_organization_admin(uuid) to authenticated;
grant execute on function public.is_organization_owner(uuid) to authenticated;

create or replace function public.prevent_ownerless_organization()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'owner' and old.is_active and (
    tg_op = 'DELETE' or (tg_op = 'UPDATE' and (new.role <> 'owner' or not new.is_active))
  ) and not exists (
    select 1 from public.organization_members
    where organization_id = old.organization_id and user_id <> old.user_id
      and role = 'owner' and is_active
  ) then
    raise exception 'La organizacion debe conservar al menos un owner activo.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- El alta en Auth no concede ni crea empresas; una invitacion/owner debe crear la membresia.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  employee_code text not null,
  document_type text not null check (document_type in ('DNI', 'NIE')),
  document_normalized text not null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  start_date date,
  position text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  archived_at timestamptz,
  archived_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_code),
  unique (organization_id, document_normalized)
);

create table if not exists public.worker_audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('created', 'updated', 'archived', 'recovered')),
  reason text,
  occurred_at timestamptz not null default now()
);

create index if not exists workers_organization_id_idx on public.workers(organization_id);
create index if not exists worker_audit_log_worker_id_idx on public.worker_audit_log(worker_id);
create trigger workers_set_updated_at before update on public.workers for each row execute function public.set_updated_at();

create or replace function public.audit_worker_change()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_action text;
begin
  v_action := case
    when tg_op = 'INSERT' then 'created'
    when old.status <> 'archived' and new.status = 'archived' then 'archived'
    when old.status = 'archived' and new.status <> 'archived' then 'recovered'
    else 'updated'
  end;
  insert into public.worker_audit_log (organization_id, worker_id, actor_id, action, reason)
  values (new.organization_id, new.id, auth.uid(), v_action,
    case when v_action in ('archived', 'recovered') then new.archived_reason else null end);
  return new;
end;
$$;
create trigger workers_audit_after_write after insert or update on public.workers
for each row execute function public.audit_worker_change();

create or replace function public.prevent_worker_identity_reassignment()
returns trigger language plpgsql as $$
begin
  if new.organization_id <> old.organization_id or new.user_id is distinct from old.user_id then
    raise exception 'No se permite reasignar la organizacion o identidad de un trabajador.';
  end if;
  return new;
end;
$$;
create trigger workers_prevent_identity_reassignment before update on public.workers
for each row execute function public.prevent_worker_identity_reassignment();

alter table public.workers enable row level security;
alter table public.worker_audit_log enable row level security;

do $$
declare policy_record record;
begin
  for policy_record in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('organizations','organization_members','company_settings','clients','budgets','budget_chapters','budget_items')
  loop execute format('drop policy if exists %I on %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename); end loop;
end $$;

create policy organizations_read_active on public.organizations for select using (public.has_active_role(id, array['owner','admin','employee']));
create policy organizations_create_self on public.organizations for insert with check (auth.uid() is not null and created_by = auth.uid());
create policy organizations_update_owner on public.organizations for update using (public.is_organization_owner(id)) with check (public.is_organization_owner(id));
create policy members_read_active on public.organization_members for select using (public.has_active_role(organization_id, array['owner','admin','employee']));
create policy members_write_owner on public.organization_members for all using (public.is_organization_owner(organization_id)) with check (public.is_organization_owner(organization_id));

create policy company_settings_commercial on public.company_settings for all using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));
create policy clients_commercial_read_write on public.clients for select using (public.is_organization_admin(organization_id));
create policy clients_commercial_insert on public.clients for insert with check (public.is_organization_admin(organization_id) and created_by = auth.uid());
create policy clients_commercial_update on public.clients for update using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));
create policy clients_commercial_delete on public.clients for delete using (public.is_organization_admin(organization_id));
create policy budgets_commercial_read_write on public.budgets for select using (public.is_organization_admin(organization_id));
create policy budgets_commercial_insert on public.budgets for insert with check (public.is_organization_admin(organization_id) and created_by = auth.uid());
create policy budgets_commercial_update on public.budgets for update using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));
create policy budgets_commercial_delete on public.budgets for delete using (public.is_organization_admin(organization_id));
create policy chapters_commercial on public.budget_chapters for all using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));
create policy items_commercial on public.budget_items for all using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));
create policy workers_admin_only on public.workers for all using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));
create policy worker_audit_admin_read on public.worker_audit_log for select using (public.is_organization_admin(organization_id));

revoke all on public.workers, public.worker_audit_log from anon;
grant select, insert, update on public.workers to authenticated;
grant select on public.worker_audit_log to authenticated;

-- Las funciones comerciales solo aceptan owner/admin activos.
create or replace function public.generate_next_budget_number(target_organization_id uuid)
returns text language plpgsql security definer set search_path = public, auth as $$
declare v_year integer := extract(year from current_date)::integer; v_next integer;
begin
  if auth.uid() is null or not public.is_organization_admin(target_organization_id) then raise exception 'No autorizado.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('budget_number:' || target_organization_id::text || ':' || v_year::text, 0));
  select coalesce(max(right(budget_number, 4)::integer), 0) + 1
    into v_next
    from public.budgets
    where organization_id = target_organization_id
      and budget_number like ('PR-' || v_year::text || '-%');
  return 'PR-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
end;
$$;

notify pgrst, 'reload schema';

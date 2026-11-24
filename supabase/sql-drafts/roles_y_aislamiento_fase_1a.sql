-- INCOMPLETO / NO EJECUTAR: controles descritos en comentarios aun no implementados.
-- NO es una migracion lista para aplicar. RLS, auditoria, membresias y RPC requieren
-- implementacion completa y pruebas en una instancia aislada antes de datos reales.

-- BORRADOR LOCAL: no aplicado. Crear una migracion nueva con `supabase migration new`
-- cuando la CLI y una base local aislada esten disponibles; revisar y probar antes de remoto.

alter table public.organization_members add column if not exists is_active boolean not null default true;
alter table public.organization_members drop constraint if exists organization_members_role_check;
alter table public.organization_members add constraint organization_members_role_check
  check (role in ('owner', 'admin', 'employee', 'member'));

-- Los registros legacy `member` no se reclasifican: quedan sin acceso hasta una decision autorizada.
create or replace function public.has_active_role(target_organization_id uuid, allowed_roles text[])
returns boolean language sql security definer set search_path = public, auth as $$
  select auth.uid() is not null and exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id and user_id = auth.uid()
      and is_active and role = any(allowed_roles)
  );
$$;
revoke all on function public.has_active_role(uuid, text[]) from public;
grant execute on function public.has_active_role(uuid, text[]) to authenticated;

-- Reemplazar helpers amplios: employee no es miembro comercial.
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

-- Eliminar todas las politicas heredadas de estas tablas antes de crear las siguientes.
-- En la migracion final usar un bloque sobre pg_policies, como el existente, para:
-- organizations, organization_members, profiles, company_settings, clients, budgets,
-- budget_chapters y budget_items. Revocar tambien los grants innecesarios de anon.
-- Politicas objetivo: owner administra organization_members; owner/admin operan datos
-- comerciales; employee no recibe SELECT/INSERT/UPDATE/DELETE sobre esas seis tablas.

-- save_budget_with_details y generate_next_budget_number deben exigir is_organization_admin;
-- bootstrap_current_organization debe devolver solo una membresia activa unica y nunca crear
-- empresa o membresia. El trigger auth.users debe crear solo profiles, no organizaciones.
-- Mantener SECURITY DEFINER solo para helpers/RPC ya necesarios, con search_path fijo,
-- auth.uid(), membresia activa y revocacion de PUBLIC. Conservar el trigger que impide
-- eliminar o degradar el ultimo owner activo y ajustarlo para contar is_active = true.
-- Storage company-assets: sustituir politicas de members por owner/admin y ruta de
-- organizacion validada; employee no puede leer ni escribir objetos comerciales.

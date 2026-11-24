-- INCOMPLETO / NO EJECUTAR: controles descritos en comentarios aun no implementados.
-- NO es una migracion lista para aplicar. RLS, auditoria, membresias y RPC requieren
-- implementacion completa y pruebas en una instancia aislada antes de datos reales.

-- BORRADOR NO APLICADO. Depende de roles_y_aislamiento_fase_1a.sql y de pruebas SQL locales.
create table public.workers (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 user_id uuid null references auth.users(id) on delete set null, employee_code text not null, document_type text not null check(document_type in ('DNI','NIE')), document_normalized text not null,
 first_name text not null, last_name text not null, email text, phone text, start_date date, position text, status text not null check(status in ('draft','active','archived')), archived_at timestamptz, archived_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id, employee_code), unique(organization_id, document_normalized));
-- Añadir historial mínimo sin documentos completos innecesarios; no guardar contraseñas.
-- RLS pendiente: owner/admin activos SELECT/INSERT/UPDATE; employee sin listado; prohibir DELETE,
-- cambios de organization_id/user_id desde formulario general y verificar membresía en BD.
-- Tests SQL pendientes: aislamiento por organización, employee denegado, duplicados archivados,
-- último owner y ningún borrado de worker al eliminar auth.users.

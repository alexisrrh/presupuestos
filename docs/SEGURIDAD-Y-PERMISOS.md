# Seguridad y permisos

Base creada a partir del encargo de fase 1A. La autoridad procede de una membresía protegida en base de datos, nunca de formularios, `localStorage` ni `user_metadata` editable.

| Rol | Acceso efectivo |
| --- | --- |
| `owner` | Gestión de empresa y roles de su organización. |
| `admin` | Presupuestos y futura gestión operativa; no roles ni owners. |
| `employee` | Perfil mínimo y futura área de jornada; ningún dato comercial. |
| `member`, rol desconocido, inactivo o sin membresía | Denegado por defecto. |

Si hay varias membresías, la aplicación no elige una por orden: requiere selección explícita en una fase posterior. Los empleados no deben poder leer `company_settings`, clientes, presupuestos, capítulos, partidas ni archivos comerciales, ni invocar RPC comerciales. El último `owner` activo no debe poder eliminarse ni degradarse.

El borrador `supabase/sql-drafts/roles_y_aislamiento_fase_1a.sql` debe convertirse en una nueva migración generada con la CLI de Supabase, revisarse y probarse en una base local aislada antes de cualquier aplicación remota.

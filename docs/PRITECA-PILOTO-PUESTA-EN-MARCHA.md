# PRITECA Gestión — preparación local del piloto

Estado: procedimiento preparado y comprobado en el E2E local privado. No implica publicación ni validación de un destino remoto.

## Inspección remota de solo lectura (24-11-2026)

| Componente | Estado observado | Estado requerido | Cambio necesario | Pendiente |
| --- | --- | --- | --- | --- |
| Supabase | Proyecto `priteca`, ref `yugpxenxjpjicxyznlxz`, organización `Proyectos` (`vqglgdsbnyzwggcnzpvd`), `ACTIVE_HEALTHY`, región `eu-west-1`, PostgreSQL 17 | Esquema completo 1C–2E y funciones publicadas | Aplicar migraciones y publicar la función cuando exista autorización separada | Verificar ventana, backup y responsable |
| Supabase migraciones | Solo 10 migraciones de presupuestos hasta `20260720130000_fix_budget_number_generation` | Línea local completa, incluida `20261124100000_phase_2e_time_reports.sql` | Revisar/aplicar cronológicamente en el destino | No aplicado ni reparado |
| Tablas/RLS | Existen presupuestos, clientes, organizaciones, miembros y perfiles; no existen `workers`, `work_sessions` ni auditorías laborales | Tablas y políticas de fases 1C–2E | Aplicar línea laboral local | No comprobado tras cambios porque no se ejecutaron |
| Funciones | Existe `save_budget_with_details`; no aparecen RPC de trabajadores, fichaje, jornadas o informes | RPC de trabajadores, archivo, fichaje, administración, acceso e informes | Publicar migraciones antes de usar la UI laboral | No disponibles remotamente |
| Edge Functions | Inventario remoto: ninguna función | `worker-access` desplegada con configuración propia | Publicar `worker-access` | No desplegada |
| Storage | `storage.buckets` tiene 0 buckets | Solo buckets necesarios por la aplicación, con RLS | Determinar si `company-assets` sigue siendo necesario y configurarlo | No se modificó |
| Vercel | Proyecto `presupuestos`, `prj_k6XSPgcHgmd5Nw89OKfczoeypUjN`, equipo `alexisrrh's projects`, framework Vite, Node 24.x | Build con la versión local revisada y variables correctas | Publicar una versión posterior mediante procedimiento autorizado | No desplegado |
| Vercel producción | Último deployment READY sobre `main`, commit `a31b182cbbdfc7c8767dbb3f82f89ef1b0c2aa84`; dominios observados `presupuestos-alpha.vercel.app` y alias del proyecto | Deployment que incluya fases 2A–2E | Crear/publicar una versión posterior | No se modificó |
| Variables Vercel | Están declarados `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` para preview/production; valores no leídos | Valores del proyecto Supabase correcto y fallback desactivado | Verificar valores sin exponerlos antes de publicar | La herramienta no permite confirmar el contenido sin descifrarlo |

La URL local de `.env.local` coincide por host con `yugpxenxjpjicxyznlxz.supabase.co`; solo se mostró el host para la comprobación. No se leyeron claves.

El Vercel activo corresponde al repositorio `alexisrrh/presupuestos` y rama `main`. El checkout local está en `codex/priteca-fase-1c-seguridad-db`, con cambios posteriores sin publicar; el deployment remoto no contiene esos cambios.

## Alcance

El piloto cubre presupuestos existentes, trabajadores, fichaje personal, administración de jornadas, altas/acceso de trabajadores e informes de tiempo con CSV. Las fases 2A–2E están cerradas en el entorno E2E local. No incluye nóminas, vacaciones, ausencias, contratos ni compatibilidad con Sage.

## Configuración por componente

| Variable | Consumidor | Finalidad | Exposición |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Frontend Vite | URL pública de la API Supabase del entorno | Pública en el bundle |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend Vite | Clave publishable/anon para Auth, REST y RPC protegidas por RLS | Pública en el bundle; nunca `service_role` |
| `VITE_ENABLE_LOCAL_FALLBACK` | Frontend Vite | Habilitar explícitamente el fallback local de demostración | Pública; `false` fuera de demo |
| `GOTRUE_INTERNAL_URL` | Edge `worker-access` | Ruta privada servidor→Auth/GoTrue | Solo servidor |
| `REST_INTERNAL_URL` | Edge `worker-access` | Ruta privada servidor→PostgREST | Solo servidor |
| `JWT_SECRET` | Edge `worker-access` | Firma técnica de llamadas internas de la función | Secreto exclusivo del servidor |
| `SUPABASE_ANON_KEY` | Edge `worker-access` | Clave pública local para llamadas de login a GoTrue | Solo configuración del servidor; no es credencial administrativa |

La credencial administrativa de Auth no es una variable del frontend. La función genera un JWT técnico de corta duración con `JWT_SECRET` únicamente para las operaciones de Auth Admin que lo necesitan. En E2E esos valores son ficticios y están definidos solo en `.local/priteca-e2e/compose.yaml`; una instalación posterior debe sustituirlos por secretos propios del destino, sin reutilizar los del E2E.

### Conjunto de archivos que formaría la publicación

- Frontend: `src/`, `public/`, `package.json`, `package-lock.json`, `vite.config.js` y el recurso `src/assets/branding/PRITECA_logo_OEPM.png`.
- Base de datos: los 28 archivos `supabase/migrations/202611*.sql` del manifiesto; las diez migraciones históricas ya están en el destino y no se vuelven a publicar.
- Función: `supabase/functions/worker-access/index.ts` y su configuración de servidor; no se incluyen `.local/priteca-e2e/`, `seed-fixtures.sql`, tokens E2E ni el volumen de ensayo.
- Configuración pública: solo nombres `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_ENABLE_LOCAL_FALLBACK=false`. `JWT_SECRET`, `GOTRUE_INTERNAL_URL`, `REST_INTERNAL_URL` y cualquier credencial administrativa permanecen exclusivamente en el entorno servidor de la función.

## Direcciones y entornos

- Dentro de la red Docker E2E: `http://kong:8000` (navegador del runner), `http://auth:9999`, `http://rest:3000` y `http://worker-access:9000` son nombres internos; no son URLs para un navegador del host.
- La composición E2E usa una red `internal` y no publica puertos para Windows. El acceso desde un navegador del host requerirá una publicación explícita y limitada a `127.0.0.1`, pendiente de autorizar y verificar.
- En un destino real, `VITE_SUPABASE_URL` será la Project URL o gateway de ese destino y la función usará sus rutas privadas/configuración del servicio. No se ha consultado ni aplicado ningún destino remoto.

## Inventario y orden de instalación

1. Crear/verificar el proyecto Supabase destino y sus cuentas iniciales; no asumir que está vacío.
2. Configurar Auth, URL de sitio, redirecciones, correo y claves del destino.
3. Confirmar que el destino conserva la línea histórica de presupuestos y aplicar únicamente el manifiesto de aplicación de la sección siguiente. El bootstrap Docker, Auth, Kong, usuarios y roles de sistema del E2E no se trasladan al proyecto gestionado.
4. Aplicar cronológicamente las migraciones de aplicación pendientes del manifiesto, incluyendo fases 1C, 1D, 1E, 2A, 2B, 2C, 2D y `20261124100000_phase_2e_time_reports.sql`.
5. Verificar las funciones públicas y privadas, propietarios, `search_path`, ACL, RLS y roles técnicos antes de abrir la aplicación.
6. Desplegar `supabase/functions/worker-access/index.ts` con configuración de servidor propia. El login `operation=login` no requiere sesión; `enable_access`, `change_password` y `reset_worker_password` requieren JWT, rol activo y organización autorizada.
7. Construir el frontend sin `--mode local-demo` usando únicamente `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_ENABLE_LOCAL_FALLBACK=false`.
8. Publicar el frontend en el destino autorizado y ejecutar las comprobaciones posteriores.

## Manifiesto exacto de actualización

La inspección remota del 24-11-2026 encontró aplicadas exactamente las diez primeras migraciones locales, hasta `20260720130000_fix_budget_number_generation.sql`. Sus nombres y versiones coinciden con los diez archivos locales: `20260719000000_initial_schema`, `20260719190000_release_1_business_data`, `20260719210000_add_save_budget_with_details_rpc`, `20260719220000_allow_users_to_create_organizations`, `20260719230000_apply_organization_insert_policy`, `20260720000000_allow_creator_to_read_organization`, `20260720020000_fix_bootstrap_organization_rpc`, `20260720030000_sync_budgets_schema`, `20260720120000_reconcile_supabase_schema` y `20260720130000_fix_budget_number_generation`. La comparación remota disponible es de identidad/historial (la API de inspección no entrega cuerpos SQL); los objetos actuales se contrastaron mediante catálogo y muestran únicamente el módulo de presupuestos. No se reescriben ni se repara el historial. Las filas siguientes son las únicas migraciones de aplicación que formarían parte de la actualización propuesta:

| Versión y ruta | Orden/dependencias | Objetos afectados | Datos/permisos | Efecto en presupuestos | Si falla |
| --- | --- | --- | --- | --- | --- |
| `20261113102152_phase_1c_roles_workers_security.sql` | 1; línea histórica 10 | `organization_members`, `workers`, `worker_audit_log`, helpers y triggers | Crea roles/ACL/RLS laborales | Ningún cambio de filas de presupuestos | Detener antes de abrir la UI; conservar historial y registrar SQLSTATE |
| `20261113105649_phase_1c_bootstrap_storage_hardening.sql` | 2; depende de Storage oficial y migración 1C | Storage policies y funciones de bootstrap | Endurece permisos y garantiza el bucket `company-assets` usado por `companyService` para logos | Sin cambio de presupuestos | Verificar Storage oficial; no crear tablas parciales |
| `20261113112928_phase_1c_acl_membership_hardening.sql` | 3; depende de roles 1C | ACL/RLS de membresías y auditoría laboral | Revoca DML directo y ajusta políticas | Sin cambio de presupuestos | Rollback transaccional de esta migración |
| `20261113124756_phase_1d_worker_revision_concurrency.sql` | 4; depende de `workers` | `workers.revision`, trigger y RPC de revisión | Revisión optimista | Sin cambio de presupuestos | No habilitar edición laboral |
| `20261113125306_phase_1d_worker_general_revision_update.sql` | 5; depende de revisión | RPC general de actualización | Ejecución solo `authenticated` | Sin cambio | Detener y conservar versión anterior |
| `20261113130317_phase_1d_worker_controlled_writes.sql` | 6; depende de 1D | `priteca_private`, rol técnico y wrappers | Escritura controlada, sin UPDATE directo | Sin cambio | Revisar propietario/ACL; no conceder permisos globales |
| `20261113134342_phase_1d_worker_writer_auth_usage.sql` | 7; depende de rol técnico | Uso mínimo de `auth` | Solo permisos del rol técnico | Sin cambio | No continuar si el rol no es NOLOGIN/NOBYPASSRLS |
| `20261113135357_phase_1d_worker_actor_bridge.sql` | 8; depende de actor de sesión | `request_actor_id`, implementación privada | Actor derivado de `auth.uid()` | Sin cambio | No publicar RPC |
| `20261113141759_phase_1d_worker_editable_fields.sql` | 9; depende de wrapper general | Implementación de nueve campos editables | Lista cerrada y auditoría | Sin cambio | Revertir solo la transacción de instalación |
| `20261113145239_phase_1d_worker_writer_admin_helper.sql` | 10; depende de ACL 1C | Permiso puntual de helper admin | Sin DML adicional | Sin cambio | Mantener edición laboral cerrada |
| `20261114110305_phase_1d_worker_json_type_validation.sql` | 11; depende de campos editables | Validación `jsonb_typeof` | Rechazo de tipos incorrectos | Sin cambio | No aceptar conversiones implícitas |
| `20261114111352_phase_1d_worker_document_validation.sql` | 12; depende de validación JSON | Validación documental | Rechazo de documentos inválidos/duplicados | Sin cambio | Detener alta/edición laboral |
| `20261114111534_phase_1d_worker_document_validation_fix.sql` | 13; corrige 12 | Misma RPC privada | Ajuste incremental | Sin cambio | Mantener 12 y diagnosticar |
| `20261114111922_phase_1d_worker_authorization_before_document_validation.sql` | 14; depende de 1C/1D | Orden de autorización/validación | Evita revelar datos a no autorizados | Sin cambio | No exponer errores diferenciados |
| `20261119083528_phase_1e_worker_archive_restore.sql` | 15; depende de revisión/auditoría | `workers`, archivo/recuperación y RPC | No borrado físico; auditoría y motivo | Sin cambio | No permitir archivo desde UI |
| `20261120073318_phase_2a_worker_identity_time_tracking.sql` | 16; depende de 1C–1E | identidad laboral, `work_sessions`, auditorías y RPC de fichaje | RLS, roles técnicos y una jornada abierta | Sin cambio | No habilitar fichaje |
| `20261120074246_phase_2a_attendance_auth_access_fix.sql` | 17; depende de 2A | helper Auth del escritor | Permiso mínimo de lectura Auth | Sin cambio | Detener si falta capacidad local equivalente |
| `20261120074516_phase_2a_attendance_membership_policy_access_fix.sql` | 18; depende de 2A | helper de owner | ACL puntual | Sin cambio | Mantener fichaje cerrado |
| `20261120074553_phase_2a_attendance_membership_helper_access_fix.sql` | 19; depende de 2A | helper de roles | ACL puntual | Sin cambio | Mantener fichaje cerrado |
| `20261120074625_phase_2a_attendance_open_session_read_fix.sql` | 20; depende de 2A | lectura de jornada abierta | Política RLS | Sin cambio | No abrir lectura personal |
| `20261120101311_phase_2b_personal_time_tracking_read.sql` | 21; depende de 2A | RPC de estado/historial personal | Solo lectura propia | Sin cambio | No mostrar jornadas |
| `20261120110122_phase_2b_time_tracking_read_ambiguity_fix.sql` | 22; corrige 21 | RPC personal | Corrección de resolución de identidad | Sin cambio | Mantener 21 sin publicar |
| `20261123103000_phase_2c_administrative_work_sessions.sql` | 23; depende de 2A/2B | RPC administrativas y auditoría | RLS, revisión y motivo | Sin cambio | No habilitar correcciones |
| `20261123104000_phase_2c_voided_status_constraint_fix.sql` | 24; depende de 23 | Constraints de jornadas | Integridad de estado | Sin cambio | Detener si hay filas incompatibles |
| `20261123104113_phase_2d_worker_access_provisioning.sql` | 25; depende de 1E/2A | `worker_access_provisions`, RPC de provisión | Alta/vínculo auditado | Sin cambio | No crear cuentas Auth |
| `20261123105000_phase_2c_private_rpc_permission_fix.sql` | 26; depende de 23 | ACL de helper privado | Revoca ejecución indebida | Sin cambio | Revisar ACL antes de continuar |
| `20261123121000_phase_2d_worker_access_invoker_fix.sql` | 27; depende de 25/26 | wrappers de provisión | `SECURITY DEFINER` restringida y `search_path` fijo | Sin cambio | No publicar worker-access |
| `20261124100000_phase_2e_time_reports.sql` | 28; depende de 2C | RPC `admin_time_report` | Solo lectura `authenticated`, RLS | Sin cambio | No abrir Informes |

Las diez migraciones históricas remotas son aplicación ya presente, no fixtures. `.local/priteca-e2e/compose.yaml`, las migraciones oficiales de Storage, bootstrap de Auth/Kong, credenciales ficticias, `seed-fixtures.sql` y los scripts de runner son exclusivamente preparación E2E y no forman parte del manifiesto gestionado. Los únicos fixtures del ensayo fueron UUIDs sintéticos de una organización, cliente, presupuesto, capítulo y partida, en el volumen desechable `priteca-pilot-rehearsal-data`.

### Ensayo local de actualización (24-11-2026)

- Se creó `priteca-pilot-rehearsal-db` con PostgreSQL Supabase `17.11.0.018`, `NetworkMode=none`, sin `PortBindings`, y volumen nuevo `priteca-pilot-rehearsal-data`; los volúmenes `offline`, `rebuild4` y `priteca-e2e-compose-db-data` no se tocaron.
- La primera ejecución de `20260719190000_release_1_business_data.sql` falló de forma reproducible con `ERROR: relation "storage.buckets" does not exist` (código 3). No se modificó la migración.
- Se aplicó la cadena oficial completa de Storage disponible localmente desde `public.ecr.aws/supabase/storage-api:v1.90.1` (migraciones tenant 0001–0080), ejecutada con el propietario del esquema local. Después se reanudó la migración histórica fallida y las nueve restantes: las diez terminaron con código 0.
- Las 28 migraciones de aplicación pendientes terminaron con código 0 (`PENDING_MANIFEST_OK`). Se verificaron `public.workers`, `public.work_sessions` y la ejecución concedida de `public.admin_time_report` a `authenticated`.
- El presupuesto sintético `PILOTO-0001` conservó su cliente, un capítulo y una partida (`1/1/1`), y el RPC `save_budget_with_details` siguió presente con ejecución para `authenticated`. No se creó una sesión Auth ni se presentó esta base como prueba RLS/E2E; esa comprobación requiere un entorno HTTP/Auth local separado o un destino autorizado.

### Copias y recuperación

La herramienta de inspección utilizada no expone inventario de copias ni fechas de backups del proyecto gestionado sin entrar en una operación de gestión adicional. Por tanto, la existencia de una copia utilizable queda **no comprobada**. Antes de cualquier escritura se debe revisar en el panel de Supabase, en modo lectura, la fecha, retención y restaurabilidad de una copia; publicar una versión anterior de Vercel no revierte migraciones SQL. Si una comprobación posterior falla, detener la publicación, conservar datos y restaurar solo mediante el procedimiento de recuperación aprobado por el propietario del proyecto.

### Configuración Auth observada y contraste

El conector disponible no expone un endpoint de lectura para la configuración gestionada de GoTrue (proveedores, `site_url`, redirecciones, recuperación, políticas de contraseña o rate limits), y la consulta SQL no devuelve una tabla `auth.config`. Por tanto, esos valores remotos quedan **no comprobados**; no se solicitaron ni mostraron claves, contraseñas o tokens.

La configuración local versionada (`supabase/config.toml`) documenta como referencia de E2E: email habilitado, SMS y login anónimo deshabilitados, confirmación de email deshabilitada para pruebas, rotación de refresh tokens activa, expiración de JWT de 3600 s y `site_url` local. No se debe copiar automáticamente al destino. La función `worker-access` requiere en servidor `GOTRUE_INTERNAL_URL`, `REST_INTERNAL_URL`, `JWT_SECRET` y `SUPABASE_ANON_KEY`; `operation=login` no requiere sesión, mientras que `enable_access`, `change_password` y `reset_worker_password` exigen JWT, actor válido, rol administrativo y organización autorizada. La clave técnica nunca va al frontend.

### Cuentas iniciales observadas

La consulta remota agregada devolvió 5 usuarios Auth, 3 perfiles, 26 organizaciones, 5 membresías `owner`, 0 `admin` y 0 `member`. No se extrajeron correos, UUID ni datos personales. La existencia de propietarios no permite identificar a Daniel, y no hay un administrativo Alexis confirmado por rol.

Antes de asignar funciones deben identificarse inequívocamente, mediante el procedimiento autorizado, el correo y UUID Auth de Daniel y Alexis y la organización concreta. No se asignarán roles por nombre ni por coincidencia de DNI/NIE. Los trabajadores employee deberán seleccionarse por ficha y organización, con UUID de ficha y revisión vigente.

La entrega de credenciales temporales será manual e individual, usando el flujo de habilitación ya implementado: administrador autenticado → provisión → cuenta Auth → vinculación auditada → entrega por canal seguro acordado. No se crean cuentas ni se envían credenciales durante esta inspección.

## Acciones pendientes de autorización

1. Autorizar una segunda inspección remota de lectura para confirmar Auth (URL de sitio, redirecciones y proveedores) y copias/retención desde el panel, sin descifrar secretos.
2. Autorizar la aplicación del manifiesto de 28 migraciones en el proyecto `yugpxenxjpjicxyznlxz`, con ventana, responsable y copia verificada; no ejecutar hasta esa autorización.
3. Autorizar el despliegue de `worker-access` con secretos propios del destino y una prueba controlada de su ruta, manteniendo la credencial administrativa solo en servidor.
4. Autorizar la publicación del frontend Vite asociado a `prj_k6XSPgcHgmd5Nw89OKfczoeypUjN`, después de confirmar las variables públicas sin exponer sus valores.
5. Definir el procedimiento de cuentas iniciales y canal seguro para credenciales temporales; no crear cuentas ni enviar invitaciones durante esta preparación.

## Primer uso controlado

1. Confirmar la organización existente y el propietario responsable; no recrear cuentas por defecto.
2. Verificar o habilitar al propietario y al administrativo mediante las membresías reales.
3. Crear una ficha de trabajador y habilitar su acceso desde Trabajadores. La cuenta Auth se crea en servidor y se vincula mediante la RPC con revisión, motivo y auditoría.
4. Entregar la contraseña temporal por un canal seguro acordado. El trabajador entra con DNI/NIE y contraseña, sin que el documento revele si existe una cuenta.
5. Registrar el primer fichaje y comprobar la jornada persistida.
6. Consultar Jornadas; cualquier corrección, cierre olvidado o anulación exige motivo y conserva historial.
7. Abrir Informes, elegir trabajador o todos y periodo inclusivo, revisar abiertas/anuladas y descargar el CSV.

## Comprobaciones posteriores

- Login administrativo por correo y login de trabajador por DNI/NIE.
- Aislamiento RLS entre organizaciones, employee, anon y administrador inactivo.
- Alta, vínculo, revisión y auditoría; no hay UPDATE directo de trabajadores ni jornadas.
- Persistencia tras recarga, conflicto de revisión y ausencia de reintentos automáticos.
- Informe: límites Europe/Madrid, DST, jornadas abiertas, anuladas, archivados y CSV completo.
- Responsive en móvil y escritorio; el logo `src/assets/branding/PRITECA_logo_OEPM.png` se carga en acceso y cabecera sin deformarse.

## Detención segura

Si una comprobación falla, detener el runner/servicio del piloto desde su composición, conservar los volúmenes y no ejecutar `reset`, `prune`, borrados ni rollback destructivo. Registrar el comando, el código y la primera comprobación fallida antes de corregir. No abrir el destino a usuarios hasta resolverla.

## Estado comprobado y pendientes

Comprobado localmente: tests unitarios, lint, build, migraciones y SQL de seguridad en PostgreSQL E2E, y suites Playwright privadas de fases 1E–2E. Pendiente: credenciales, URL, configuración Auth/Storage, migraciones y permisos del destino de instalación; todo ello permanece **no comprobado** hasta autorización explícita y consulta del destino correcto.

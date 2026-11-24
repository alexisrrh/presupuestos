# PRITECA Gestión — fichaje, experiencia y fases

## Objetivo de experiencia

La aplicación debe resolver dos necesidades independientes en una misma cuenta: trabajo personal y gestión administrativa. Si una persona tiene condición de trabajador habilitada, ve siempre en Inicio su acción de jornada y su historial personal. Si además tiene permiso administrativo, conserva la gestión de la organización. Daniel y Alexis se tratan como ejemplos de cuentas con ambas condiciones; no se codifican nombres ni se infiere que un administrador sea trabajador.

El fichaje diario será una acción principal visible, responsive y de un máximo de dos pulsaciones: una para abrir la acción y una para confirmar cuando sea necesaria la confirmación de entrada/salida. No habrá formulario diario. El estado actual ("Fichar entrada" o "Fichar salida") y la última acción deben ser inequívocos.

## Sistema de diseño obligatorio: Mobile First con comportamiento de aplicación

Toda pantalla nueva de PRITECA Gestión se diseñará primero para móvil como una aplicación de pantalla completa, no como una página de escritorio reducida. React y la arquitectura actual se conservan; este criterio no autoriza todavía a implementar fichaje ni a conectar nuevos módulos a producción.

### Navegación y estructura móvil

- La experiencia móvil utilizará una barra inferior fija con **Inicio**, **Fichar**, **Calendario** y **Perfil**. Las opciones administrativas estarán en una sección independiente, visible solo para los permisos autorizados y accesible también desde móvil.
- La cabecera será compacta. Los controles táctiles tendrán área cómoda, las tarjetas serán limpias y la tipografía mantendrá contraste y tamaño legible.
- El layout respetará `safe-area-inset-*` en iPhone y Android: cabecera, contenido y navegación inferior no quedarán debajo de notch, cámara, indicador de inicio o barra de navegación del sistema.
- No se usarán tablas anchas ni desplazamiento horizontal para datos operativos en móvil. Listas, fichas y acciones se presentarán como tarjetas, resúmenes progresivos o detalle navegable.
- La navegación debe funcionar con interacción táctil, teclado, foco visible y lectores de pantalla. Se conservarán avisos antes de perder cambios y semántica de controles.

### Estado, interacción y formularios

- Las transiciones, cargas, errores y confirmaciones ofrecerán una respuesta visual clara sin bloquear silenciosamente la interfaz. Se priorizarán animaciones breves que respeten `prefers-reduced-motion`.
- Los formularios se organizarán para una sola columna, teclado apropiado por tipo de dato, etiquetas persistentes, validación comprensible y botones de acción grandes. No se pedirá a diario información ya configurada.
- La vista se adaptará progresivamente a tablet y escritorio, aprovechando más espacio sin perder el modelo de navegación ni convertir el móvil en una versión secundaria.

### Inicio y jornada personal

- Inicio mostrará el estado actual de la jornada para toda persona con condición de trabajador habilitada.
- El botón principal de fichaje será visible y permitirá entrada o salida en un máximo de dos pulsaciones, con la confirmación mínima necesaria.
- Historial personal y solicitudes estarán a un acceso directo de la pantalla principal. No se representarán operaciones simuladas como registros persistidos.

### Administración desde móvil

- Daniel y Alexis son ejemplos de cuentas que pueden combinar administración y condición de trabajador; la interfaz no codificará permisos por nombre.
- Una cuenta administrativa con ficha de trabajador habilitada conserva el mismo fichaje personal que cualquier empleado. Los permisos administrativos y la condición de trabajador siguen siendo independientes.
- La administración móvil permitirá gestionar los módulos autorizados desde una sección diferenciada, sin mezclar acciones de organización con el botón de jornada personal.

### PWA y verificación requerida

- Se evaluará una PWA instalable (manifest y service worker) cuando exista un flujo persistente que se beneficie de instalación o tolerancia a conectividad. No se añadirán dependencias ni cachés/offline de forma anticipada; primero se definirá qué datos pueden almacenarse y cómo se invalidan sin saltar RLS ni auditoría.
- Antes de declarar funcional una pantalla móvil se verificará visualmente en tamaños representativos de Android e iPhone, incluido al menos un dispositivo con notch/indicador de inicio, además de tablet y escritorio. Se comprobarán áreas seguras, navegación inferior, teclado, foco, ausencia de desplazamiento horizontal, estados de carga/error y contraste. Esta comprobación está pendiente porque los módulos de fichaje, calendario y perfil todavía no se han implementado.

## Requisitos funcionales

- La condición de trabajador se deriva de una vinculación activa entre cuenta, organización y ficha de trabajador; es independiente del rol `owner`/`admin`/`employee` de membresía.
- Inicio muestra el control de fichaje y el historial personal solo a cuentas con esa condición habilitada. Los administradores con vínculo de trabajador también lo ven.
- Administración se organiza por Trabajadores, Fichajes, Contratos, Nóminas, Obras e Informes. Que una sección figure en navegación no implica que esté implementada ni persistida.
- Las correcciones de fichaje crean un registro nuevo y trazable: referencia al original, actor, motivo, momento y resultado. Nunca sobrescriben silenciosamente el registro original.
- RLS conserva aislamiento por organización. Documentación salarial exige políticas específicas, privadas y por operación; no se reutilizan permisos generales de trabajadores.

## Estado actual reutilizable

| Elemento | Estado |
| --- | --- |
| Auth y contexto de membresía | Implementado para roles y organización; requiere ampliar condición de trabajador. |
| `workers` y auditoría SQL | Controles, revisión, archivo/recuperación y auditoría verificados offline y en E2E privado con Auth/API/PostgreSQL locales. No equivale a una validación contra producción. |
| Gestión de trabajadores | Lista, ficha, alta, edición, archivo y recuperación con revisión integradas para owner/admin. Archivo/recuperación usan RPC específicas y auditadas; no borran físicamente la ficha. |
| Demo de trabajadores | Solo memoria y datos ficticios; sigue separada de la ruta administrativa persistente. |
| Inicio / layout / sidebar | Reutilizable; la administración tiene barra inferior móvil para Inicio, Nuevo, Trabajadores y Ajustes, con áreas seguras y sin duplicación en escritorio. Todavía no contiene fichaje funcional ni rutas ficticias de Calendario/Perfil. |
| Fichajes, contratos, nóminas, obras e informes | No implementados. |

## Fases propuestas

1. **1E — integración de trabajadores:** completada en E2E local aislado. La capa de datos y UI administrativa están conectadas al contrato RLS/RPC, incluida alta, edición, archivo y recuperación con auditoría y revisión.
2. **2A — modelo de condición laboral y fichaje:** migraciones, RLS, auditoría de correcciones y pruebas SQL offline. Define vínculo cuenta-trabajador y operaciones transaccionales de entrada/salida; no UI persistida hasta superar pruebas.
3. **2B — experiencia móvil de jornada:** tarjeta fija de Inicio, máximo dos pulsaciones, historial propio y estados de carga/error reales. Reutiliza `AppLayout`, `Header`, `MembershipContext` y el patrón de servicios; no usa datos simulados como si fueran persistidos.
   - Estado actual: aprobada en E2E local privado. La lectura personal, entrada/salida, respuesta perdida, doble pulsación, concurrencia, foco/conexión, cambio de sesión y jornada previa se verificaron contra Auth/API/PostgreSQL locales reales. Hay capturas en 360, 375, 390 y 430 px. No equivale a una validación en producción.
4. **2C — administración de fichajes:** aprobada en E2E local privado. Owner/admin consultan jornadas de su organización, filtran por fecha/estado, consultan historial y realizan corrección, cierre olvidado o anulación sin borrado físico. Cada operación requiere revisión y motivo, conserva antes/después/actor/hora de servidor en auditoría y no permite acceso administrativo a employee, anon u otra organización. La interfaz presenta horas en Europe/Madrid y datos UTC persistidos; el cruce de medianoche sigue permitido.
5. **2D — altas y acceso de trabajadores:** aprobada en E2E local privado. La habilitación administrativa usa provisión transaccional, cuenta Auth creada sólo en Edge, vinculación auditada con revisión y login DNI/NIE; el acceso por correo administrativo permanece. La suite final de 26 pruebas incluye alta desde UI, vínculo, login DNI/NIE, primer fichaje, cambio de contraseña, rechazo de la credencial anterior, recuperación administrativa y archivo con sesión previa; el servidor rechaza nuevas transiciones de fichaje. La recuperación administrativa está conectada y restringida a employee de la organización. Evidencias: `.local/priteca-e2e/run-artifacts/20261123-171245-dedicated.log` y `.local/priteca-e2e/run-artifacts/20261123-171312-full.log`, ambos código `0`.
6. **2E — informes de tiempo y exportación CSV:** aprobada en E2E local privado. La consulta administrativa filtra trabajador y periodo inclusivo en `Europe/Madrid`, calcula solapamientos sobre instantes reales, separa abiertas pendientes, excluye anuladas, conserva archivados y exporta el mismo conjunto completo a CSV. La RPC es de solo lectura, `SECURITY INVOKER`, con RLS y ejecución limitada a `authenticated`; SQL `phase2e_time_reports.sql` código `0` cubre también DST y otra organización. E2E dedicado `1/1` y suite completa `27/27` (`.local/priteca-e2e/run-artifacts/20261124-094705-report.log`, `.local/priteca-e2e/run-artifacts/20261124-094753-full.log`). No se calculan horas extra, ausencias, descansos, salarios ni compatibilidad con Sage.

### Preparación del piloto

La puesta en marcha local está descrita en `docs/PRITECA-PILOTO-PUESTA-EN-MARCHA.md`. Mantiene las fases 2A–2E cerradas, distingue configuración pública del frontend y secretos exclusivos de `worker-access`, y conserva como requisito que el logo oficial `PRITECA_logo_OEPM.png` se muestre sin deformación en móvil y escritorio. Las URLs internas de Docker no se reutilizan como URLs de navegador del destino; la instalación real queda pendiente de verificación.

La inspección remota de solo lectura del 24-11-2026 identificó el proyecto Supabase `priteca` y Vercel `presupuestos`, pero confirmó que el destino remoto aún solo contiene el módulo de presupuestos. Las fases laborales 1C–2E siguen cerradas localmente y pendientes de instalación remota; no se considera el destino operativo.

La actualización propuesta queda ahora descrita con un manifiesto por migración y un ensayo aislado en `docs/PRITECA-PILOTO-PUESTA-EN-MARCHA.md`. El ensayo conservó un presupuesto sintético y sus relaciones tras aplicar Storage oficial y las migraciones locales, pero no sustituye una comprobación RLS/Auth con identidades del destino. La puesta en marcha remota sigue pendiente de autorización y de verificar copias de seguridad.
6. **3 — contratos y nóminas:** modelo, políticas y documentación salarial privada antes de UI. No se incluyen en el alcance de fichaje inicial.
6. **4 — obras e informes:** módulos independientes con permisos y auditoría propios.

7. **2F — solicitudes de fichaje olvidado:** aprobada en E2E local privado en la rama `codex/priteca-2f-fichajes-olvidados`. El trabajador puede proponer entrada, salida, corrección o jornada completa y consultar sus solicitudes; owner/admin disponen de cola de revisión. Las solicitudes no alteran jornadas hasta una resolución autorizada, no permiten autoaprobación y conservan auditoría. La UI es Mobile First y mantiene el fichaje normal separado. La migración, 10 aserciones estructurales, comportamiento RLS/ACL, medianoche/DST, doble resolución concurrente y recorrido Playwright (33/33; 6 casos 2F dedicados) pasan en la composición privada. Se verificaron viewports 360/375/390/430; no equivale a validación remota.
8. **2G — experiencia de fichaje y calendario administrativo:** implementación inicial en `codex/priteca-2g-jornadas-calendario`. El área personal muestra duración en vivo, historial con entrada/salida/duración, advertencias confirmables para turnos excepcionalmente cortos y contraseña en Perfil→Seguridad. Jornadas administrativas incorporan resumen, búsqueda, calendario mensual por trabajador y detalle de todos los tramos, sin clasificar días sin registro como ausencias. Validación local actual: unitarias 218/218, E2E 38/38 y viewports 360/375/390/430 sin overflow. Queda pendiente ejecutar fixtures dedicadas para varios turnos, jornada del día anterior, medianoche/DST y corrección de una sola hora antes de aprobar 2G.
9. **Cierre 2G:** la suite dedicada alcanza 6/6 y la suite completa 39/39 en dos ejecuciones consecutivas con fixtures Auth restablecidas automáticamente. SQL específico acredita varios turnos, jornada previa, medianoche/DST, anulaciones, correcciones parciales conservando segundos y fichaje de un administrador con condición de trabajador. La barra inferior no tapa Perfil en móvil; fase aprobada exclusivamente en E2E local privado.

## Fase 2A — contrato de persistencia y seguridad

La fase 2A queda delimitada al modelo de datos, RLS/RPC y pruebas SQL/E2E locales. No crea todavía la pantalla de fichaje, calendario, solicitudes, contratos, nóminas ni una corrección administrativa completa; esos elementos pertenecen a 2B, 2C y fases posteriores.

El contrato funcional autorizado para 2A es:

- Una persona tendrá condición de trabajador cuando exista una ficha `workers` activa, vinculada a su identidad autenticada y a una membresía activa de la misma organización. Esta condición será independiente de ser `owner` o `admin`; los roles sólo determinan acceso administrativo. Solo owner/admin activos pueden vincular, cambiar o desvincular una identidad existente de Auth; el vínculo exige motivo, revisión vigente, pertenencia activa de la identidad a la organización y unicidad global de identidad por ficha.
- Las jornadas se modelarán como sesiones persistentes con entrada y salida de servidor (`timestamptz`), nunca como filas ficticias para ausencias. Una sesión abierta por trabajador se protegerá con una restricción única parcial y la RPC bloqueará la ficha antes de decidir entre entrada y salida.
- La RPC de fichaje resolverá usuario, trabajador y organización exclusivamente mediante `auth.uid()` y datos protegidos. No aceptará `worker_id`, organización, rol ni marca temporal del navegador como autoridad. El cliente sólo recibirá el resultado de la transición confirmada.
- Las tablas de jornada serán de sólo lectura directa para cuentas de aplicación. Las transiciones y auditorías se harán desde funciones restringidas, con actor de sesión, marca de servidor, motivo cuando corresponda y sin `DELETE` físico.
- Las correcciones no sobrescribirán la evidencia original. 2A conserva sesiones y eventos inmutables frente al cliente; solicitudes persistentes, revisión administrativa, aprobación/rechazo e interfaz se implementarán exclusivamente en 2C.
- Las pruebas deberán cubrir owner/admin con ficha vinculada, employee con ficha propia, identidad sin ficha, inactiva, anon y otra organización; además de doble fichaje concurrente, integridad de una sesión abierta y ausencia de auditoría en rechazos.

### Decisiones resueltas para 2A

1. **Vinculación cuenta–trabajador:** el procedimiento se limita a owner/admin activos, verifica una identidad Auth ya existente y una membresía activa de la misma organización; no busca ni vincula automáticamente por DNI/NIE y nunca almacena contraseñas.
2. **Correcciones:** 2A prepara conservación de la sesión original y eventos auditables; solicitudes, resolución y UI son 2C.
3. **Jornada abierta y zona horaria:** existe una única sesión abierta por trabajador, protegida por índice único parcial y bloqueo transaccional. Las marcas se guardan como `timestamptz` de servidor (UTC); `Europe/Madrid` es la presentación predeterminada y no se calculan descansos, horas extra ni nóminas en esta fase.

## Criterios previos a implementar fichaje

- Pruebas de integridad y concurrencia de trabajadores completadas realmente en PostgreSQL offline.
- Operaciones de fichaje y corrección con pruebas RLS, concurrencia y auditoría separadas.
- Confirmación de que la cuenta puede ser administradora y trabajadora sin elevación de privilegios.
- Ningún prototipo visual marcado como operación persistida.

## Vacaciones, permisos, ausencias e incidencias

### Experiencia del trabajador

Desde el área personal, el trabajador podrá solicitar vacaciones, días personales u otros permisos mediante un calendario móvil; comunicar una ausencia; consultar estado y saldo; y solicitar una corrección de fichaje. La confirmación deberá indicar claramente si la petición se recibió, aprobó o rechazó. Una ausencia registrada no crea entrada, salida ni jornada ficticia.

### Experiencia administrativa

Administración mostrará solicitudes pendientes, calendario general y por obra, saldos y movimientos, incidencias de fichaje y una exportación de resumen para preparación de nóminas. Las incidencias se detectan comparando planificación, descansos, festivos y ausencias ya registradas; nunca se etiquetan automáticamente como ausencia injustificada ni producen descuentos automáticos.

Daniel y Alexis pueden solicitar sus propias ausencias y usar su ficha de trabajador si la tienen habilitada, pero no autoaprobarse. El circuito requerirá otro aprobador autorizado, una regla de escalado definida por organización o dejará la solicitud pendiente; esa decisión debe existir en base de datos y RLS, no solo en UI.

### Modelo y seguridad previstos

- Solicitudes de ausencia separadas de registros de jornada, con tipo, intervalo, estado, solicitante, aprobador, motivo mínimo y auditoría de transición.
- Saldos como movimientos trazables (devengo, ajuste, consumo), no como un contador editable. El cálculo depende de contrato, convenio, jornada, antigüedad y calendario laboral configurado; no se calculará hasta modelar esas fuentes.
- Centros de trabajo, calendario laboral y festivos se configuran por organización/centro. Obras pueden consumir esa planificación sin sustituirla.
- Correcciones de fichaje referencian el registro original y crean un resultado corregido trazable; no sobrescriben la evidencia original.
- Datos de salud y justificantes usan tablas/buckets privados separados, minimización, RLS por operación y permisos específicos. Nunca se exponen mediante permisos generales de trabajadores ni documentación salarial.
- Todas las consultas y operaciones se aíslan por organización; empleado ve solo lo propio, administradores autorizados gestionan su organización y no hay acceso entre organizaciones.

### Fases posteriores

1. **Estado de prerrequisito 1D:** integridad, roles, auditoría, concurrencia y reconstrucción limpia están verificadas en PostgreSQL offline. El requisito de fichaje desde inicio en un máximo de dos pulsaciones se conserva y todavía no está implementado.
2. **2D — planificación y solicitudes:** contratos/calendarios mínimos, solicitudes y saldo por movimientos, RLS y pruebas offline.
3. **2E — UX personal:** calendario responsive, saldo, solicitud y seguimiento; solo contra operaciones persistidas ya verificadas.
4. **2F — administración y correcciones:** cola de aprobación sin autoaprobación, calendarios, incidencias trazables y exportación de resumen no salarial definitivo.
5. **3A — documentación sensible y nóminas:** contratos, justificantes y permisos de documentación salarial antes de adjuntos o cálculos.

Estas fases permanecen bloqueadas por el cierre de integridad, numeración y concurrencia de trabajadores; no sustituyen ni adelantan esas pruebas.

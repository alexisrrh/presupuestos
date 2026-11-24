# PRITECA Gestión - Parche correctivo local de fase 1B

**Fecha:** 12 de noviembre de 2026.
**Origen:** `PRITECA-fase-1b-revision(1).zip`, SHA-256 `2421687296767110226aaea950efeb4f3affa41b9e9b3a5b0184321b66cd6e26`.
**Estado:** correcciones preparadas sobre una copia del ZIP; no aplicadas al ordenador del usuario ni al repositorio remoto. La fase NO se declara validada para producción.

## Cambios entregados

### Dominio y servicio local
- Separa crear, consultar, editar, archivar y recuperar. Una actualización de ID inexistente falla; nunca se transforma en un alta.
- Todas las operaciones resuelven el contexto mediante un proveedor inyectado y exigen propietario/administrativo activo. No reciben la organización desde el formulario.
- Lectura, edición, archivo y recuperación localizan conjuntamente el identificador y la organización. Se deniega una ficha ajena sin revelar si existe.
- Los datos editables se proyectan mediante una lista explícita. ID, organización, cuenta de Auth, rol e historial quedan fuera del DTO.
- Validación común de nombre, código, DNI/NIE, contactos opcionales, fechas reales y estado. Las entradas no textuales producen errores controlados.
- Documento y código son únicos dentro de cada organización, incluidas las fichas archivadas. Las escrituras en memoria no contienen pausas asíncronas entre comprobación y mutación.
- Identificador de petición en las altas para evitar duplicados por reintento; control de revisión en cambios para rechazar una copia obsoleta.
- Historial con actor de prueba, fecha, motivo y diferencias. No repite documentos ni contactos completos en el historial. Devuelve copias defensivas.
- Recuperar mantiene el estado anterior (borrador o activa). No se edita una archivada sin recuperarla.

**Límite:** estos son controles del adaptador local. Su contexto ficticio y su historial en memoria no sustituyen autenticación, RLS ni auditoría en servidor.

### Interfaz escrita y pendiente de prueba React en navegador
- Componentes separados de espacio de trabajo, listado, formulario, diálogo e historial.
- Edición mediante DTO, no reenvío de la ficha completa.
- Confirmación de archivo/recuperación con motivo obligatorio, cancelación sin escribir y error conservando lo introducido.
- Advertencia de cambios sin guardar al cerrar, abrir otra ficha, crear otra o iniciar una acción; aviso nativo `beforeunload` mientras hay cambios. La disponibilidad del aviso de recarga depende del navegador.
- Tabla de escritorio y tarjetas móviles con las mismas acciones. Campos etiquetados, errores asociados, foco visible y diálogos nativos.
- Historial visible y mensajes que distinguen ficha, cuenta y situación laboral.
- Espacio de trabajo reiniciado por clave de usuario/organización, limpieza al desmontar y descarte de cargas antiguas. Esto NO corrige los pendientes previos de `App.jsx`, `useBudgets` y `useCompanySettings`.

### Demostración local
- `demo.html` con idioma, charset y viewport móvil.
- Entrada local deliberada, sin inicializar Auth o Supabase y sin almacenamiento persistente.
- Guard de Vite que rechaza `build --mode local-demo` y preview con ese modo. La compilación normal solo selecciona `index.html`.
- Guard de imports/artefactos para detectar módulos de demo en un build, bloqueo de rutas demo en el servidor normal y bloqueo de la entrada real en el servidor demo.
- Loopback obligatorio y política CSP restrictiva para conexiones de la demo. Estas medidas aún necesitan comprobación con Vite/React reales.
- Sin cambios de dependencias, `package.json` o `package-lock.json`.

## Evidencia ejecutada en esta revisión

| Comprobación | Resultado |
|---|---|
| `node --test tests/node/phase1b-checks.mjs` | 38 pruebas correctas, 0 fallos. Casos compartidos también con los wrappers de Vitest. |
| Análisis sintáctico de 6 JSX con TypeScript preinstalado | Sin errores sintácticos. NO equivale a comprobación de tipos, lint o ejecución de React. |
| `node --check` en archivos JavaScript/MJS modificados | Sin errores de sintaxis. |
| Chromium sobre el HTML sin script React | En emulación de 393 px, `innerWidth=393`; idioma `es`. No es una prueba de la aplicación React. |
| Inspección estática del grafo local de imports | No alcanza Auth/Supabase ni imports remotos. NO sustituye interceptar la red en navegador. |

Las pruebas del guard ejecutan sus callbacks directamente. NO son un build real de Vite ni un test de servidor real. El registro detallado está en `evidencias/`.

## No ejecutado / bloqueos

No fue posible descargar dependencias: el entorno no resuelve `registry.npmjs.org`. No se repitió la suite completa de Vitest, ESLint ni el build. No se ejecutó la interfaz React en navegador, ni se generaron capturas que aparenten esa ejecución.

Los borradores SQL 1A/1B siguen INCOMPLETOS. Solo se han añadido advertencias: no se han implementado sus políticas pendientes ni aplicado instrucciones a ninguna base. Antes de datos reales se requiere resolver membresías, bootstrap, RPC, roles, último propietario activo, RLS, auditoría, Storage y limpieza de datos comerciales al cambiar sesión.

No se ha consultado ni modificado Supabase, GitHub, planes, correos o trabajadores reales. No hay commit, push ni despliegue.

## Integración local segura

Este paquete es un parche, no un proyecto completo. Contiene `archivos/`, `cambios.patch`, hashes de base y destino, un verificador de solo lectura y un encargo de integración.

1. Extraer fuera del repositorio y conservar sus cambios actuales.
2. Ejecutar el verificador contra la carpeta real. Comparar las discrepancias; no sobrescribir archivos divergentes.
3. Aplicar o reconciliar únicamente los cambios indicados. Los borradores siguen bajo `supabase/sql-drafts/`.
4. Ejecutar pruebas y abrir `npm run demo:workers` con datos ficticios.
5. No declarar cierre antes de probar desde la interfaz la edición, cancelación, motivos, historial, recuperación y vista móvil.

## Referencias verificadas

- Ministerio del Interior, algoritmo DNI/NIE: https://www.interior.gob.es/opencms/es/servicios-al-ciudadano/tramites-y-gestiones/dni/calculo-del-digito-de-control-del-nif-nie/
- Vite, diferencia entre modo y compilación: https://vite.dev/guide/env-and-mode
- Vite, configuración según command/mode: https://vite.dev/config/
- OpenAI, revisar cambios y resultados antes de adoptar correcciones: https://help.openai.com/en/articles/20001552-review-pull-requests-with-codex

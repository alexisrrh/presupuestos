# Estado de desarrollo

## Fase 0 — estabilizacion de presupuestos

- Estado: completada localmente el 2026-11-12, pendiente de integrar mediante el flujo habitual de Git.
- Se corrigio la actualizacion parcial del estado desde el panel. Antes se enviaba a `save_budget_with_details` un presupuesto normalizado a partir de `{ status }`, con riesgo de borrar campos no incluidos.
- `updateBudget` ahora carga el presupuesto existente y fusiona el cambio antes de usar el guardado remoto. Se preservan cliente, datos generales, capitulos y partidas, condiciones, informe tecnico, descuentos e impuestos.
- Se anadio una prueba de regresion que simula el cambio de estado con datos ficticios y dependencias de Supabase simuladas. Comprueba que el payload conserva cliente, condiciones, partidas e importes.

## Documentacion de arranque

En esta copia del repositorio no estaban disponibles `AGENTS.md`, `AGENTS-PRITECA-propuesto.md`, `docs/PRITECA_Gestion_Especificacion_Funcional_v1_1.md`, ni los documentos `docs/arranque/01-HOJA-DE-RUTA.md`, `02-TAREA-0.md` y `03-SUPABASE-TRASLADO.md`. Por ello no se ha podido verificar ni ejecutar requisitos adicionales descritos exclusivamente en esos documentos.

## Cierre adicional de la fase 0

- El cambio de estado del dashboard ya no utiliza el guardado completo. El flujo es `App.jsx` -> `useBudgets.updateBudgetStatus` -> `budgetService.updateBudgetStatus`.
- La operacion especifica valida los estados del proyecto y ejecuta solamente `UPDATE budgets SET status = ...`, filtrando por ID y por la organizacion de la membresia actual. No usa `save_budget_with_details`, no crea organizaciones, ni reenvia datos del presupuesto.
- Una respuesta con cero, mas de una, o una fila diferente de la solicitada se trata como error. Por tanto, un presupuesto inexistente o inaccesible no puede convertirse en un alta.
- Las pruebas usan mocks; validan el contrato del payload y las rutas de error, pero no sustituyen una validacion real de RLS, concurrencia ni permisos contra Supabase.
- Entorno de pruebas: en Windows con Node 24.15.0 y npm 11.12.1, Vitest 4.1.10 esta instalado y `bin-links=true`, pero `node_modules/.bin/vitest` es un enlace de 0 bytes y faltan `vitest.cmd` y `vitest.ps1`. Por ello `npm run test` y `npm run test:run` no pueden iniciar. La alternativa ejecutada es `node .\\node_modules\\vitest\\vitest.mjs run`; no se ha reinstalado ni modificado dependencias.
- Tarea posterior: revisar el aviso de Vite sobre un chunk de mas de 500 kB; no se ha aumentado su limite para ocultarlo.



# Supabase Setup

## 1. Crear el proyecto

1. Entra en Supabase y crea un nuevo proyecto.
2. Abre `Project Settings > API`.
3. Copia la `Project URL`.
4. Copia la publishable key.

No uses ni expongas la `service_role` key en esta aplicacion.

## 2. Configurar variables locales

Crea `.env.local` a partir de `.env.example`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_ENABLE_LOCAL_FALLBACK=false
```

Temporalmente tambien se admite `VITE_SUPABASE_ANON_KEY` como fallback compatible.
El fallback local debe permanecer desactivado en produccion.

## 3. Instalar Supabase CLI

Instala la CLI siguiendo la documentacion oficial de Supabase.

```bash
supabase --version
```

## 4. Inicializar y vincular

La carpeta `supabase/` ya existe en este proyecto. Ejecuta `supabase init` solo si estas empezando desde una copia sin esa carpeta.

Vincula el proyecto:

```bash
supabase link --project-ref TU_PROJECT_REF
```

## 5. Aplicar migraciones

Revisa primero la migracion:

```bash
supabase/migrations/20260719_initial_schema.sql
supabase/migrations/20260719_release_1_business_data.sql
```

Cuando el proyecto este vinculado:

```bash
supabase db push
```

No ejecutes `db push` hasta haber verificado que estas conectado al proyecto correcto.

## 6. Probar autenticacion

1. Arranca la aplicacion con `.env.local` configurado.
2. Abre la pantalla de registro.
3. Crea un usuario.
4. Comprueba en Supabase que se crean:
   - `profiles`
   - `organizations`
   - `organization_members`
   - `company_settings`
5. Inicia sesion con el usuario.

## 7. Revisar seguridad

En el Dashboard de Supabase revisa:

- RLS activado en todas las tablas publicas.
- Politicas por organizacion.
- Trigger `on_auth_user_created`.
- Funciones `is_organization_member` e `is_organization_admin`.
- RPC `save_budget_with_details`.
- Bucket privado `company-assets`.
- Politicas de Storage para rutas `organizations/<organizationId>/...`.

La aplicacion no usa `service_role`; solo debe configurarse con URL y publishable key.

## 8. Configurar Auth

En `Authentication > URL Configuration`:

- Define `Site URL` con la URL final de produccion.
- Añade URLs de desarrollo y preview en `Redirect URLs`.
- Comprueba que el correo de confirmacion y recuperacion usa dominios validos.

## 9. Migrar datos locales

Despues de iniciar sesion, la aplicacion detecta datos antiguos en:

- `priteca_budgets`
- `priteca_company_settings`

Si existen y la migracion no se ha marcado como completada para ese usuario, aparece un modal para importarlos a Supabase. La clave de control local es:

```text
priteca_supabase_migration_v1_<userId>
```

La importacion no borra automaticamente localStorage. Tras completarse, el usuario puede conservar o eliminar la copia local.

## 10. Backups

Con sesion activa, exportar e importar JSON trabaja contra Supabase. El modo reemplazar solo sustituye datos de la organizacion actual. El backup no incluye tokens, contrasenas ni variables de entorno.

## 11. Despliegue en Vercel

Configura en Vercel:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_ENABLE_LOCAL_FALLBACK=false
```

No configures `service_role` en el frontend. Aplica migraciones antes de abrir la app a usuarios reales y prueba RLS con dos usuarios de organizaciones distintas.

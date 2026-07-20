import { COMPANY_NAME, LOGO_HORIZONTAL } from '../config/branding'
import { missingSupabaseEnv } from '../lib/supabaseClient'

function SupabaseMissingConfig() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[#f5f7f6] px-4 py-10">
      <section className="w-full max-w-xl rounded-md border border-[#e5e7eb] bg-white p-6 shadow-sm">
        <img
          src={LOGO_HORIZONTAL}
          alt={`${COMPANY_NAME} logo`}
          className="h-16 w-52 object-contain"
        />
        <h1 className="mt-6 text-2xl font-semibold text-[#111827]">
          Falta configurar Supabase
        </h1>
        <p className="mt-3 text-sm text-[#6b7280]">
          La aplicacion esta preparada para autenticacion remota, pero faltan
          variables de entorno. Los datos locales no se borran ni se modifican.
        </p>
        <div className="mt-5 rounded-md bg-[#fff5f5] p-4 text-sm text-[#991b1b]">
          Variables pendientes: {missingSupabaseEnv.join(', ')}
        </div>
        <p className="mt-4 text-sm text-[#6b7280]">
          Crea un archivo `.env.local` usando `.env.example` y reinicia el servidor
          de desarrollo.
        </p>
        <p className="mt-3 text-sm text-[#6b7280]">
          El almacenamiento local no se usa como fuente principal. El fallback local
          solo debe activarse temporalmente con `VITE_ENABLE_LOCAL_FALLBACK=true`.
        </p>
      </section>
    </main>
  )
}

export default SupabaseMissingConfig

function LocalMigrationModal({
  isCompleted = false,
  isLoading = false,
  onClearLocalCopy,
  onImport,
  onOmit,
  summary,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="local-migration-title"
    >
      <div className="w-full max-w-lg rounded-md border border-[#e5e7eb] bg-white p-5 shadow-xl">
        <h2 id="local-migration-title" className="text-lg font-semibold text-[#111827]">
          Datos guardados en este dispositivo
        </h2>
        <p className="mt-2 text-sm text-[#6b7280]">
          Hemos encontrado datos locales antiguos. Puedes importarlos a tu cuenta de
          Supabase o mantenerlos solo como copia local.
        </p>

        <div className="mt-5 rounded-md border border-[#e5e7eb] bg-[#f8faf9] p-4 text-sm text-[#374151]">
          <p>
            Presupuestos detectados:{' '}
            <span className="font-semibold text-[#111827]">
              {summary?.budgets?.length || 0}
            </span>
          </p>
          <p className="mt-1">
            Configuracion local:{' '}
            <span className="font-semibold text-[#111827]">
              {summary?.companySettings ? 'Incluida' : 'No incluida'}
            </span>
          </p>
        </div>

        {isCompleted ? (
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-[#d1d5db] px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-offset-2"
              onClick={onOmit}
            >
              Conservar copia local
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-[var(--brand-navy)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-navy-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-offset-2"
              onClick={onClearLocalCopy}
            >
              Eliminar copia local
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-[#d1d5db] px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-offset-2"
              disabled={isLoading}
              onClick={onOmit}
            >
              Omitir
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-[var(--brand-navy)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-navy-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              onClick={onImport}
            >
              {isLoading ? 'Migrando datos locales...' : 'Importar a mi cuenta'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default LocalMigrationModal


import { Download, Upload } from 'lucide-react'

function BackupSection({
  error,
  isImporting,
  onExport,
  onImportFile,
}) {
  return (
    <section className="rounded-md border border-[#d8dfdb] bg-white p-5 shadow-sm sm:p-6">
      <div className="border-b border-[#e5e7eb] pb-4">
        <h2 className="text-lg font-semibold text-[#111827]">Copias de seguridad</h2>
        <p className="mt-1 text-sm text-[#6b7280]">
          Exporta o recupera los datos locales de presupuestos y configuracion.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-[#d1d5db] px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#C62828] focus:ring-offset-2"
          onClick={onExport}
        >
          <Download size={16} aria-hidden="true" />
          Exportar backup
        </button>

        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-[#C62828] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#B71C1C] focus-within:ring-2 focus-within:ring-[#C62828] focus-within:ring-offset-2">
          <Upload size={16} aria-hidden="true" />
          {isImporting ? 'Leyendo archivo...' : 'Importar backup'}
          <input
            className="sr-only"
            accept="application/json,.json"
            type="file"
            disabled={isImporting}
            onChange={onImportFile}
          />
        </label>
      </div>

      {error && (
        <p className="mt-3 text-sm font-medium text-[#991b1b]" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

export default BackupSection


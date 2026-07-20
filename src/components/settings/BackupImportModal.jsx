import { useEffect, useRef, useState } from 'react'

function BackupImportModal({ backup, onCancel, onConfirm }) {
  const [mode, setMode] = useState('merge')
  const cancelButtonRef = useRef(null)

  useEffect(() => {
    const previousActiveElement = document.activeElement
    cancelButtonRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousActiveElement?.focus?.()
    }
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-import-title"
    >
      <div className="max-h-[calc(100svh-2rem)] w-full max-w-lg overflow-y-auto rounded-md border border-[#e5e7eb] bg-white p-5 shadow-xl">
        <h2 id="backup-import-title" className="text-lg font-semibold text-[#111827]">
          Importar copia de seguridad
        </h2>
        <p className="mt-2 text-sm text-[#6b7280]">
          Revisa el contenido antes de aplicar los cambios en este navegador.
        </p>

        <dl className="mt-5 grid gap-3 rounded-md border border-[#e5e7eb] bg-[#f8faf9] p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-[#374151]">Presupuestos</dt>
            <dd className="text-[#111827]">{backup.budgets.length}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-[#374151]">Configuracion</dt>
            <dd className="text-[#111827]">
              {backup.companySettings ? 'Incluida' : 'No incluida'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-[#374151]">Fecha de exportacion</dt>
            <dd className="text-right text-[#111827]">{backup.exportedAt || '-'}</dd>
          </div>
        </dl>

        <fieldset className="mt-5 space-y-3">
          <legend className="text-sm font-semibold text-[#111827]">
            Modo de importacion
          </legend>
          <label className="flex gap-3 rounded-md border border-[#d1d5db] p-3 text-sm">
            <input
              className="mt-1 h-4 w-4 accent-[var(--brand-navy)]"
              type="radio"
              name="backup-import-mode"
              value="merge"
              checked={mode === 'merge'}
              onChange={(event) => setMode(event.target.value)}
            />
            <span>
              <span className="block font-semibold text-[#111827]">
                Combinar sin duplicar
              </span>
              <span className="text-[#6b7280]">
                Mantiene los datos actuales y añade presupuestos con id nuevo.
              </span>
            </span>
          </label>
          <label className="flex gap-3 rounded-md border border-[#d1d5db] p-3 text-sm">
            <input
              className="mt-1 h-4 w-4 accent-[var(--brand-navy)]"
              type="radio"
              name="backup-import-mode"
              value="replace"
              checked={mode === 'replace'}
              onChange={(event) => setMode(event.target.value)}
            />
            <span>
              <span className="block font-semibold text-[#111827]">
                Reemplazar datos actuales
              </span>
              <span className="text-[#6b7280]">
                Sustituye los presupuestos locales por los de la copia.
              </span>
            </span>
          </label>
        </fieldset>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-[#d1d5db] px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-offset-2"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md bg-[var(--brand-navy)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-navy-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-offset-2"
            onClick={() => onConfirm(mode)}
          >
            Importar
          </button>
        </div>
      </div>
    </div>
  )
}

export default BackupImportModal


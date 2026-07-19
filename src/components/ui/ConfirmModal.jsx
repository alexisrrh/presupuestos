import { useEffect, useRef } from 'react'

function ConfirmModal({
  confirmLabel = 'Eliminar',
  description,
  onCancel,
  onConfirm,
  title,
}) {
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
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-md border border-[#e5e7eb] bg-white p-5 shadow-xl">
        <h2 id="confirm-modal-title" className="text-lg font-semibold text-[#111827]">
          {title}
        </h2>
        <p className="mt-2 text-sm text-[#6b7280]">{description}</p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-[#d1d5db] px-4 py-2 text-sm font-semibold text-[#111827] transition hover:bg-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#C62828] focus:ring-offset-2"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md bg-[#C62828] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B71C1C] focus:outline-none focus:ring-2 focus:ring-[#C62828] focus:ring-offset-2"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal

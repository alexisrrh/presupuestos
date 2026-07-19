import { Download } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

function PdfExportMenu({
  disabled = false,
  isLoading = false,
  label = 'Generar PDF',
  onProfessional,
  onQuick,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = (callback) => {
    if (disabled || isLoading) {
      return
    }

    setIsOpen(false)
    callback?.()
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#C62828] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#B71C1C] focus:outline-none focus:ring-2 focus:ring-[#C62828] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={label}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        disabled={disabled || isLoading}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Download size={16} aria-hidden="true" />
        {isLoading ? 'Generando PDF...' : label}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 z-40 mt-2 w-56 rounded-md border border-[#e5e7eb] bg-white p-1 shadow-lg"
          role="menu"
        >
          <button
            type="button"
            className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-[#111827] hover:bg-[#f3f4f6] focus:bg-[#f3f4f6] focus:outline-none"
            role="menuitem"
            onClick={() => handleSelect(onQuick)}
          >
            Generar PDF rapido
          </button>
          <button
            type="button"
            className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-[#111827] hover:bg-[#f3f4f6] focus:bg-[#f3f4f6] focus:outline-none"
            role="menuitem"
            onClick={() => handleSelect(onProfessional)}
          >
            Generar PDF profesional
          </button>
        </div>
      )}
    </div>
  )
}

export default PdfExportMenu

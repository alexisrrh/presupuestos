import { RotateCcw, Trash2, Upload } from 'lucide-react'
import officialLogo from '../../assets/priteca-logo.png'

function LogoSettingsSection({ data, error, onChange, onLogoChange }) {
  return (
    <section className="rounded-md border border-[#d8dfdb] bg-white p-5 shadow-sm sm:p-6">
      <div className="border-b border-[#e5e7eb] pb-4">
        <h2 className="text-lg font-semibold text-[#111827]">Logo</h2>
      </div>
      <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex h-24 w-56 items-center rounded-md border border-[#e5e7eb] bg-white p-4">
          <img
            src={data.logo || officialLogo}
            alt="PRITECA"
            className="h-full w-full object-contain"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-[#d1d5db] px-3 py-2 text-sm font-semibold text-[#111827] transition hover:bg-[#f3f4f6] focus-within:ring-2 focus-within:ring-[#C62828] focus-within:ring-offset-2">
            <Upload size={16} aria-hidden="true" />
            Seleccionar logo
            <input
              className="sr-only"
              accept="image/png,image/jpeg,image/webp"
              type="file"
              onChange={onLogoChange}
            />
          </label>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[#d1d5db] px-3 py-2 text-sm font-semibold text-[#111827] transition hover:bg-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#C62828] focus:ring-offset-2"
            onClick={() => onChange('logo', '')}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Restaurar logo oficial
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[#d1d5db] px-3 py-2 text-sm font-semibold text-[#991b1b] transition hover:bg-[#fff5f5] focus:outline-none focus:ring-2 focus:ring-[#C62828] focus:ring-offset-2"
            onClick={() => onChange('logo', '')}
          >
            <Trash2 size={16} aria-hidden="true" />
            Eliminar personalizado
          </button>
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-[#991b1b]">{error}</p>}
    </section>
  )
}

export default LogoSettingsSection

import { CalendarDays, LogOut, Save } from 'lucide-react'
import { COMPANY_NAME, LOGO_HORIZONTAL } from '../../config/branding'
import PdfExportMenu from '../ui/PdfExportMenu'

const getCurrentDate = () => {
  const now = new Date()
  const timezoneOffset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

function Header({
  activePage,
  budgetSnapshot,
  companyName = COMPANY_NAME,
  logoSrc,
  pdfStatus,
  onGeneratePdf,
  onGenerateProfessionalPdf,
  onSaveDraft,
  onSignOut,
  saveStatus,
  title,
}) {
  const isBudgetPage = activePage === 'new-budget'
  const currentLogo = logoSrc || LOGO_HORIZONTAL
  const generalData = budgetSnapshot?.generalData || {}
  const budgetName = generalData.projectName || generalData.number || 'Sin nombre'
  const budgetDate = generalData.date || getCurrentDate()
  const saveLabel = {
    error: 'Error al guardar',
    idle: 'Guardar borrador',
    saved: 'Guardado',
    saving: 'Guardando...',
  }[saveStatus || 'idle']

  return (
    <header className="border-b border-[#d8dfdb] bg-white">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-28 shrink-0 items-center sm:h-12 sm:w-36">
              <img
                src={currentLogo}
                alt={`${companyName} logo`}
                className="h-full w-full object-contain object-left"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#6b7280]">
                {companyName} Presupuestos
              </p>
              <h1 className="truncate text-2xl font-semibold text-[#111827] sm:text-3xl">
                {title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[#6b7280]">
                <span className="font-medium text-[#111827]">
                  {isBudgetPage ? budgetName : 'Panel principal'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={15} aria-hidden="true" />
                  {budgetDate}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm font-semibold text-[#111827] transition hover:bg-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-offset-2"
              aria-label="Guardar borrador"
              disabled={!isBudgetPage || saveStatus === 'saving'}
              onClick={onSaveDraft}
            >
              <Save size={16} aria-hidden="true" />
              {saveLabel}
            </button>
            <PdfExportMenu
              disabled={!isBudgetPage}
              isLoading={pdfStatus === 'generating'}
              onProfessional={onGenerateProfessionalPdf}
              onQuick={onGeneratePdf}
            />
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm font-semibold text-[#111827] transition hover:bg-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-offset-2"
              aria-label="Cerrar sesión"
              onClick={onSignOut}
            >
              <LogOut size={16} aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { COMPANY_NAME, LOGO_ISOTYPE } from '../../config/branding'
import Header from './Header'
import MobileBottomNav from './MobileBottomNav'
import Sidebar from './Sidebar'

function AppLayout({
  activePage,
  budgetSnapshot,
  children,
  companySettings,
  onGeneratePdf,
  onGenerateProfessionalPdf,
  onNavigate,
  onSaveDraft,
  onSignOut,
  saveStatus,
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const handleNavigate = (page) => {
    onNavigate(page)
    setIsSidebarOpen(false)
  }

  return (
    <div className="min-h-svh bg-[#f5f7f6] text-[#1f2933]">
      <div className="flex min-h-svh">
        <Sidebar
          activePage={activePage}
          companyName={companySettings?.name}
          isOpen={isSidebarOpen}
          logoSrc={companySettings?.logo}
          onNavigate={handleNavigate}
        />

        {isSidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-[#111827]/35 lg:hidden"
            aria-label="Cerrar menu lateral"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col lg:pl-72">
          <div className="sticky top-0 z-20 border-b border-[#d8dfdb] bg-white/95 backdrop-blur lg:hidden">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:hidden">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#d8dfdb] text-[#111827] transition hover:bg-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-offset-2"
                aria-label={isSidebarOpen ? 'Cerrar menu' : 'Abrir menu'}
                onClick={() => setIsSidebarOpen((current) => !current)}
              >
                {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <img
                src={LOGO_ISOTYPE}
                alt={`${COMPANY_NAME} isotipo`}
                className="h-10 w-10 rounded-md bg-white object-contain p-1"
              />
              <span className="text-sm font-semibold tracking-[0.14em] text-[#111827]">
                {COMPANY_NAME}
              </span>
            </div>
          </div>

          <Header
            activePage={activePage}
            budgetSnapshot={budgetSnapshot}
            companyName={companySettings?.name}
            logoSrc={companySettings?.logo}
            onGeneratePdf={onGeneratePdf}
            onGenerateProfessionalPdf={onGenerateProfessionalPdf}
            onSaveDraft={onSaveDraft}
            onSignOut={onSignOut}
            saveStatus={saveStatus}
            title="Presupuestos de obra"
          />

          <main className="flex-1 px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
          <MobileBottomNav activePage={activePage} onNavigate={handleNavigate} />
        </div>
      </div>
    </div>
  )
}

export default AppLayout

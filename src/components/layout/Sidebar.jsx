import { BarChart3, CalendarClock, Clock3, FilePlus2, Files, Home, Settings, Users } from 'lucide-react'
import {
  COMPANY_NAME,
  COMPANY_TAGLINE,
  LOGO_HORIZONTAL,
  LOGO_ISOTYPE,
} from '../../config/branding'

const navigation = [
  { id: 'dashboard', label: 'Inicio', icon: Home },
  { id: 'time-tracking', label: 'Mi fichaje', icon: Clock3 },
  { id: 'new-budget', label: 'Nuevo presupuesto', icon: FilePlus2 },
  { id: 'budgets', label: 'Presupuestos', icon: Files },
  { id: 'workers', label: 'Trabajadores', icon: Users },
  { id: 'work-sessions', label: 'Jornadas', icon: CalendarClock },
  { id: 'work-reports', label: 'Informes', icon: BarChart3 },
  { id: 'settings', label: 'Configuracion', icon: Settings },
]

function Sidebar({ activePage, companyName = COMPANY_NAME, isOpen, logoSrc, onNavigate }) {
  const currentLogo = logoSrc || LOGO_HORIZONTAL

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-[var(--brand-navy-dark)] bg-[var(--brand-navy)] text-white shadow-xl transition-transform duration-200 ease-out lg:translate-x-0 lg:shadow-none ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-36 shrink-0 items-center rounded-md bg-white px-3 py-2">
              <img
                src={currentLogo}
                alt={`${companyName} logo`}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold tracking-[0.14em]">
                {companyName}
              </p>
              <p className="mt-1 truncate text-xs leading-4 text-white/70">
                {COMPANY_TAGLINE}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-4 py-5" aria-label="Navegacion principal">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = activePage === item.id

            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-[#111827] ${
                  isActive
                    ? 'bg-[var(--brand-orange)] text-white shadow-sm'
                    : 'text-white/78 hover:bg-white/10 hover:text-white'
                }`}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="border-t border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <img
              src={LOGO_ISOTYPE}
              alt={`${COMPANY_NAME} isotipo`}
              className="h-9 w-9 rounded-md bg-white object-contain p-1"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-[0.14em]">
                {companyName}
              </p>
              <p className="mt-1 text-xs text-white/70">Gestion de presupuestos</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar

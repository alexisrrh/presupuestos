import { FilePlus2, Files, Home, Settings } from 'lucide-react'
import pritecaLogo from '../../assets/priteca-logo.png'

const navigation = [
  { id: 'dashboard', label: 'Inicio', icon: Home },
  { id: 'new-budget', label: 'Nuevo presupuesto', icon: FilePlus2 },
  { id: 'budgets', label: 'Presupuestos', icon: Files },
  { id: 'settings', label: 'Configuracion', icon: Settings },
]

function Sidebar({ activePage, companyName = 'PRITECA', isOpen, logoSrc, onNavigate }) {
  const currentLogo = logoSrc || pritecaLogo

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-[#d8dfdb] bg-[#111827] text-white shadow-xl transition-transform duration-200 ease-out lg:translate-x-0 lg:shadow-none ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-40 items-center rounded-md bg-white px-3 py-2">
              <img
                src={currentLogo}
                alt="PRITECA"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-[0.18em]">{companyName}</p>
              <p className="mt-1 text-sm text-white/70">Presupuestos de obra</p>
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
                    ? 'bg-[#C62828] text-white shadow-sm'
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
          <p className="text-sm font-semibold tracking-[0.18em]">{companyName}</p>
          <p className="mt-1 text-sm text-white/70">Gestion de Presupuestos</p>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar

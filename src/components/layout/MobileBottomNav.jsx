import { BarChart3, CalendarClock, Clock3, Home, Settings, Users } from 'lucide-react'

const navigation = [
  { id: 'dashboard', label: 'Inicio', icon: Home },
  { id: 'time-tracking', label: 'Fichar', icon: Clock3 },
  { id: 'work-sessions', label: 'Jornadas', icon: CalendarClock },
  { id: 'work-reports', label: 'Informes', icon: BarChart3 },
  { id: 'workers', label: 'Trabajadores', icon: Users },
  { id: 'settings', label: 'Ajustes', icon: Settings },
]

export default function MobileBottomNav({ activePage, onNavigate }) {
  return (
    <nav
      aria-label="Navegacion móvil"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[#d8dfdb] bg-white/95 px-2 pt-2 shadow-[0_-8px_24px_rgba(17,24,39,0.08)] backdrop-blur lg:hidden"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = activePage === item.id || (item.id === 'dashboard' && activePage === 'budgets')
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-offset-2 ${
                isActive
                  ? 'bg-[var(--brand-navy)] text-white'
                  : 'text-[#52616b] hover:bg-[#edf2ef] hover:text-[#111827]'
              }`}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={21} aria-hidden="true" />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

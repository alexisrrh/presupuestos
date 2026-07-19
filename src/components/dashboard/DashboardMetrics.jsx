import { Edit3, FileText, WalletCards } from 'lucide-react'
import { formatCurrency } from '../../utils/budgetCalculations'

function MetricCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md border border-[#d8dfdb] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#6b7280]">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-[#111827]">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#fcf1f1] text-[#C62828]">
          <Icon size={22} aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}

function DashboardMetrics({ metrics }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={FileText} label="Total de presupuestos" value={metrics.total} />
      <MetricCard icon={Edit3} label="Borradores" value={metrics.drafts} />
      <MetricCard icon={WalletCards} label="Aceptados" value={metrics.accepted} />
      <MetricCard
        icon={WalletCards}
        label="Importe total presupuestado"
        value={formatCurrency(metrics.totalAmount)}
      />
    </div>
  )
}

export default DashboardMetrics

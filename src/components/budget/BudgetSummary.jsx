import Input from '../ui/Input'
import { calculateBudgetTotals, formatCurrency } from '../../utils/budgetCalculations'

function SummaryLine({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? 'font-semibold text-[var(--brand-navy)]' : 'text-[#60706a]'}>
        {label}
      </span>
      <span className={strong ? 'font-semibold text-[var(--brand-navy)]' : 'font-medium text-[#111827]'}>
        {value}
      </span>
    </div>
  )
}

function BudgetSummary({ chapters, discountPercent, ivaPercent, onChange }) {
  const totals = calculateBudgetTotals(chapters, discountPercent, ivaPercent)

  return (
    <aside className="rounded-md border border-[#d8dfdb] bg-white p-5 shadow-sm transition-shadow duration-200 lg:sticky lg:top-6 lg:self-start">
      <div className="border-b border-[#e3e8e5] pb-4">
        <h2 className="text-lg font-semibold text-[#111827]">Resumen economico</h2>
      </div>

      <div className="mt-5 space-y-4 text-sm">
        <SummaryLine label="Subtotal" value={formatCurrency(totals.subtotal)} />

        <label className="grid gap-2">
          <span className="font-medium text-[#33443d]">Descuento (%)</span>
          <Input
            min="0"
            step="0.01"
            type="number"
            value={discountPercent}
            onChange={(event) => onChange('discountPercent', event.target.value)}
          />
        </label>

        <SummaryLine
          label="Descuento"
          value={formatCurrency(totals.discountAmount)}
        />
        <SummaryLine label="Base imponible" value={formatCurrency(totals.taxableBase)} />

        <label className="grid gap-2">
          <span className="font-medium text-[#33443d]">IVA (%)</span>
          <Input
            min="0"
            step="0.01"
            type="number"
            value={ivaPercent}
            onChange={(event) => onChange('ivaPercent', event.target.value)}
          />
        </label>

        <SummaryLine label="IVA" value={formatCurrency(totals.ivaAmount)} />

        <div className="border-t border-[#e3e8e5] pt-4">
          <p className="text-sm font-semibold uppercase text-[#60706a]">TOTAL</p>
          <p className="mt-1 text-3xl font-bold text-[var(--brand-navy)]">
            {formatCurrency(totals.total)}
          </p>
        </div>
      </div>
    </aside>
  )
}

export default BudgetSummary

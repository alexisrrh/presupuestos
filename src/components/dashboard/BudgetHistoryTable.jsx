import { Copy, Edit3, Trash2 } from 'lucide-react'
import PdfExportMenu from '../ui/PdfExportMenu'
import StatusBadge from '../budget/StatusBadge'
import { statusLabels } from '../../data/budgetStatus'
import { formatCurrency } from '../../utils/budgetCalculations'

function BudgetHistoryTable({
  budgets,
  getBudgetTotal,
  onDeleteClick,
  onDuplicateBudget,
  onGeneratePdf,
  onGenerateProfessionalPdf,
  onOpenBudget,
  onUpdateBudgetStatus,
  pdfGeneratingId,
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse">
        <thead>
          <tr className="bg-[#f8faf9] text-left text-xs font-semibold uppercase text-[#6b7280]">
            <th className="px-4 py-3">Numero</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Obra</th>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {budgets.map((budget) => (
            <tr
              key={budget.id}
              className="border-t border-[#e5e7eb] transition hover:bg-[#f8faf9]"
            >
              <td className="px-4 py-4 text-sm font-semibold text-[#111827]">
                {budget.budgetNumber}
              </td>
              <td className="px-4 py-4 text-sm text-[#374151]">
                {budget.clientData?.name || '-'}
              </td>
              <td className="px-4 py-4 text-sm text-[#374151]">
                {budget.generalData?.projectName || '-'}
              </td>
              <td className="px-4 py-4 text-sm text-[#6b7280]">
                {budget.generalData?.date || '-'}
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <StatusBadge status={budget.status} />
                  <select
                    className="rounded-md border border-[#d1d5db] bg-white px-2 py-1 text-xs text-[#111827] outline-none transition focus:border-[var(--brand-navy)] focus:ring-2 focus:ring-[var(--brand-navy)]/15"
                    aria-label={`Cambiar estado de ${budget.budgetNumber}`}
                    value={budget.status}
                    onChange={(event) =>
                      onUpdateBudgetStatus(budget.id, event.target.value)
                    }
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </td>
              <td className="px-4 py-4">
                <span className="inline-flex rounded-full border border-[#d1d5db] bg-[#f8faf9] px-2.5 py-1 text-xs font-semibold text-[#374151]">
                  {budget.documentType === 'professional' ? 'Profesional' : 'Rapido'}
                </span>
              </td>
              <td className="px-4 py-4 text-right text-sm font-semibold text-[#111827]">
                {formatCurrency(getBudgetTotal(budget))}
              </td>
              <td className="px-4 py-4">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d1d5db] text-[#111827] transition hover:bg-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-offset-2"
                    aria-label={`Abrir ${budget.budgetNumber}`}
                    onClick={() => onOpenBudget(budget)}
                  >
                    <Edit3 size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d1d5db] text-[#111827] transition hover:bg-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-offset-2"
                    aria-label={`Duplicar ${budget.budgetNumber}`}
                    onClick={() => onDuplicateBudget(budget.id)}
                  >
                    <Copy size={16} aria-hidden="true" />
                  </button>
                  <PdfExportMenu
                    isLoading={pdfGeneratingId === budget.id}
                    label="PDF"
                    onProfessional={() => onGenerateProfessionalPdf(budget)}
                    onQuick={() => onGeneratePdf(budget)}
                  />
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d1d5db] text-[#991b1b] transition hover:bg-[#fff5f5] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-offset-2"
                    aria-label={`Eliminar ${budget.budgetNumber}`}
                    onClick={() => onDeleteClick(budget)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default BudgetHistoryTable

import { Copy, Trash2 } from 'lucide-react'
import { calculateItemTotal, formatCurrency } from '../../utils/budgetCalculations'

const units = ['ud.', 'm²', 'm³', 'ml', 'kg', 'h', 'día', 'lote']

function BudgetItemRow({ item, onChange, onDuplicate, onRemove }) {
  return (
    <tr className="border-t border-[#e3e8e5] transition-colors duration-150 hover:bg-[#f8faf9]">
      <td className="min-w-72 px-3 py-3 align-top">
        <input
          className="w-full rounded-md border border-[#ccd6d1] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--brand-navy)] focus:ring-2 focus:ring-[var(--brand-navy)]/15"
          value={item.description}
          placeholder="Descripcion de la partida"
          onChange={(event) => onChange('description', event.target.value)}
        />
      </td>
      <td className="min-w-28 px-3 py-3 align-top">
        <input
          className="w-full rounded-md border border-[#ccd6d1] bg-white px-3 py-2 text-right text-sm outline-none transition focus:border-[var(--brand-navy)] focus:ring-2 focus:ring-[var(--brand-navy)]/15"
          min="0"
          step="0.01"
          type="number"
          value={item.quantity}
          onChange={(event) => onChange('quantity', event.target.value)}
        />
      </td>
      <td className="min-w-28 px-3 py-3 align-top">
        <select
          className="w-full rounded-md border border-[#ccd6d1] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--brand-navy)] focus:ring-2 focus:ring-[var(--brand-navy)]/15"
          value={item.unit}
          onChange={(event) => onChange('unit', event.target.value)}
        >
          {units.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </td>
      <td className="min-w-36 px-3 py-3 align-top">
        <input
          className="w-full rounded-md border border-[#ccd6d1] bg-white px-3 py-2 text-right text-sm outline-none transition focus:border-[var(--brand-navy)] focus:ring-2 focus:ring-[var(--brand-navy)]/15"
          min="0"
          step="0.01"
          type="number"
          value={item.unitPrice}
          onChange={(event) => onChange('unitPrice', event.target.value)}
        />
      </td>
      <td className="min-w-32 px-3 py-3 text-right align-middle text-sm font-semibold text-[#1f2933]">
        {formatCurrency(calculateItemTotal(item))}
      </td>
      <td className="min-w-28 px-3 py-3 align-middle">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#ccd6d1] text-[#111827] transition hover:bg-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-offset-2"
            aria-label="Duplicar partida"
            onClick={onDuplicate}
          >
            <Copy size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#ccd6d1] text-[#6b2f2f] transition hover:bg-[#f4eeee] focus:outline-none focus:ring-2 focus:ring-[#6b2f2f] focus:ring-offset-2"
            aria-label="Eliminar partida"
            onClick={onRemove}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  )
}

export default BudgetItemRow

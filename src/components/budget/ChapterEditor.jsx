import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import Button from '../ui/Button'
import BudgetItemRow from './BudgetItemRow'
import { calculateSubtotal, formatCurrency } from '../../utils/budgetCalculations'

function ChapterEditor({
  chapter,
  onAddItem,
  onChangeName,
  onDuplicateItem,
  onRemove,
  onRemoveItem,
  onUpdateItem,
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const chapterTotal = calculateSubtotal([chapter])

  return (
    <section className="overflow-hidden rounded-md border border-[#d8dfdb] bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="border-b border-[#e3e8e5] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <button
              type="button"
              className="mt-7 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#d1d5db] text-[#111827] transition hover:bg-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#C62828] focus:ring-offset-2"
              aria-label={isExpanded ? 'Contraer capitulo' : 'Expandir capitulo'}
              aria-expanded={isExpanded}
              onClick={() => setIsExpanded((current) => !current)}
            >
              <ChevronDown
                size={18}
                aria-hidden="true"
                className={`transition-transform duration-200 ${
                  isExpanded ? 'rotate-0' : '-rotate-90'
                }`}
              />
            </button>

            <label className="block min-w-0 flex-1">
              <span className="mb-2 block text-sm font-medium text-[#33443d]">
                Nombre del capitulo
              </span>
              <input
                className="w-full rounded-md border border-[#ccd6d1] bg-white px-3 py-2.5 text-sm font-semibold text-[#111827] outline-none transition focus:border-[#C62828] focus:ring-2 focus:ring-[#C62828]/15"
                value={chapter.name}
                onChange={(event) => onChangeName(event.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-md border border-[#d8dfdb] bg-[#f8faf9] px-3 py-2 text-sm text-[#33443d]">
              <span className="font-semibold text-[#C62828]">
                {chapter.items.length}
              </span>{' '}
              partidas
            </div>
            <div className="rounded-md border border-[#d8dfdb] bg-[#f8faf9] px-3 py-2 text-sm font-semibold text-[#111827]">
              {formatCurrency(chapterTotal)}
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-[#ccd6d1] px-3 py-2 text-sm font-semibold text-[#6b2f2f] transition hover:bg-[#f4eeee] focus:outline-none focus:ring-2 focus:ring-[#6b2f2f] focus:ring-offset-2"
              onClick={onRemove}
            >
              <Trash2 size={16} aria-hidden="true" />
              Eliminar capitulo
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="transition-all duration-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse">
              <thead>
                <tr className="bg-[#f8faf9] text-left text-xs font-semibold uppercase text-[#60706a]">
                  <th className="px-3 py-3">Descripcion</th>
                  <th className="px-3 py-3 text-right">Cantidad</th>
                  <th className="px-3 py-3">Unidad</th>
                  <th className="px-3 py-3 text-right">Precio unitario</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {chapter.items.map((item) => (
                  <BudgetItemRow
                    key={item.id}
                    item={item}
                    onChange={(field, value) => onUpdateItem(item.id, field, value)}
                    onDuplicate={() => onDuplicateItem(item.id)}
                    onRemove={() => onRemoveItem(item.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#e3e8e5] p-4 sm:p-5">
            <Button
              icon={Plus}
              className="bg-[#C62828] hover:bg-[#B71C1C]"
              onClick={onAddItem}
            >
              Añadir partida
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

export default ChapterEditor

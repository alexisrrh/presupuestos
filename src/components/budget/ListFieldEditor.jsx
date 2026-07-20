import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'

function ListFieldEditor({ label, onChange, value }) {
  const items = Array.isArray(value) ? value : []

  const updateItem = (index, nextValue) => {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? nextValue : item)))
  }

  const addItem = () => {
    const cleanItems = items.map((item) => item.trim()).filter(Boolean)
    onChange([...cleanItems, ''])
  }

  const removeItem = (index) => {
    onChange(items.filter((_item, itemIndex) => itemIndex !== index))
  }

  const moveItem = (index, direction) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= items.length) return
    const nextItems = [...items]
    const [removed] = nextItems.splice(index, 1)
    nextItems.splice(nextIndex, 0, removed)
    onChange(nextItems)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[#33443d]">{label}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-[#d1d5db] px-2 py-1 text-xs font-semibold text-[#111827] hover:bg-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-offset-2"
          onClick={addItem}
        >
          <Plus size={14} aria-hidden="true" />
          Añadir
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border border-[#ccd6d1] bg-white px-3 py-2 text-sm text-[#111827] outline-none transition focus:border-[var(--brand-navy)] focus:ring-2 focus:ring-[var(--brand-navy)]/15"
              value={item}
              onChange={(event) => updateItem(index, event.target.value)}
            />
            <button type="button" aria-label="Subir elemento" className="h-9 w-9 rounded-md border border-[#d1d5db] text-[#111827]" onClick={() => moveItem(index, -1)}>
              <ArrowUp size={15} className="mx-auto" />
            </button>
            <button type="button" aria-label="Bajar elemento" className="h-9 w-9 rounded-md border border-[#d1d5db] text-[#111827]" onClick={() => moveItem(index, 1)}>
              <ArrowDown size={15} className="mx-auto" />
            </button>
            <button type="button" aria-label="Eliminar elemento" className="h-9 w-9 rounded-md border border-[#d1d5db] text-[#991b1b]" onClick={() => removeItem(index)}>
              <Trash2 size={15} className="mx-auto" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ListFieldEditor

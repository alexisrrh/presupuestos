function TextareaField({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#33443d]">{label}</span>
      <textarea
        className="min-h-28 w-full resize-y rounded-md border border-[#ccd6d1] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none transition placeholder:text-[#8a9691] focus:border-[var(--brand-navy)] focus:ring-2 focus:ring-[var(--brand-navy)]/15"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function BudgetConditions({ data, onChange }) {
  return (
    <section className="rounded-md border border-[#d8dfdb] bg-white p-5 shadow-sm sm:p-6">
      <div className="border-b border-[#e3e8e5] pb-4">
        <h2 className="text-lg font-semibold text-[#111827]">Condiciones</h2>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <TextareaField
          label="Forma de pago"
          value={data.paymentTerms}
          placeholder="Condiciones de pago"
          onChange={(value) => onChange('paymentTerms', value)}
        />
        <TextareaField
          label="Plazo de ejecucion"
          value={data.executionTime}
          placeholder="Plazo estimado"
          onChange={(value) => onChange('executionTime', value)}
        />
        <TextareaField
          label="Observaciones"
          value={data.notes}
          placeholder="Notas internas o condiciones adicionales"
          onChange={(value) => onChange('notes', value)}
        />
      </div>
    </section>
  )
}

export default BudgetConditions

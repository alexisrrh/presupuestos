export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#33443d]">{label}</span>
      {children}
    </label>
  )
}

export function TextareaField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <textarea
        className="min-h-28 w-full resize-y rounded-md border border-[#ccd6d1] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none transition placeholder:text-[#8a9691] focus:border-[var(--brand-navy)] focus:ring-2 focus:ring-[var(--brand-navy)]/15"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

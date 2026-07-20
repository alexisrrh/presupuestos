function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-md border border-[#ccd6d1] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none transition placeholder:text-[#8a9691] focus:border-[var(--brand-navy)] focus:ring-2 focus:ring-[var(--brand-navy)]/15 ${className}`}
      {...props}
    />
  )
}

export default Input

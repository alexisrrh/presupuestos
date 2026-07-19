function Button({ children, className = '', icon: Icon, type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-md bg-[#C62828] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#B71C1C] focus:outline-none focus:ring-2 focus:ring-[#C62828] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {Icon && <Icon size={18} aria-hidden="true" />}
      {children}
    </button>
  )
}

export default Button

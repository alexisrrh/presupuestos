function Toast({ message, type = 'info' }) {
  if (!message) {
    return null
  }

  const typeClasses = {
    error: 'border-[#f3c2c2] bg-[#fff5f5] text-[#8a1c1c]',
    info: 'border-[#d1d5db] bg-white text-[#111827]',
    success: 'border-[#c7e2d3] bg-[#f3fbf6] text-[#166534]',
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 rounded-md border px-4 py-3 text-sm font-medium shadow-lg ${typeClasses[type]}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  )
}

export default Toast

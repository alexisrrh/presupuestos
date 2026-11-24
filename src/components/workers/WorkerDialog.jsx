import { useEffect, useId, useRef } from 'react'

export default function WorkerDialog({ title, children, onCancel, busy = false }) {
  const dialog = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement
    if (!element.open) element.showModal()
    return () => {
      element.close()
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])
  return (
    <dialog ref={dialog} className="worker-dialog" aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}>
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  )
}

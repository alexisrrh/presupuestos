import { useEffect, useRef } from 'react'
import { WORKER_LABELS } from '../../services/workers/workerDomain.js'

const fields = [
  ['employeeCode', 'text', true], ['firstName', 'text', true], ['lastName', 'text', true],
  ['document', 'text', true], ['email', 'email', false], ['phone', 'tel', false],
  ['startDate', 'date', false], ['position', 'text', false],
]
export default function WorkerForm({ draft, onChange, onSubmit, onCancel, fieldErrors, error, busy, editing, readOnly, accessEnabled = false, mode = 'demo' }) {
  const persistent = mode === 'persistent'
  const form = useRef(null)
  useEffect(() => {
    const first = form.current.querySelector('input:not(:disabled)') || form.current.querySelector('h2')
    first?.focus()
  }, [])
  useEffect(() => {
    if (Object.keys(fieldErrors).length) form.current.querySelector('[aria-invalid="true"]')?.focus()
  }, [fieldErrors])
  return (
    <form ref={form} className="worker-panel" onSubmit={onSubmit} noValidate aria-labelledby="worker-form-title">
      <div className="worker-section-heading">
        <div><h2 id="worker-form-title" tabIndex={-1}>{editing ? 'Detalle de la ficha' : 'Nuevo trabajador'}</h2>
          <p>Los campos con * son obligatorios. {persistent ? 'Los cambios se guardan con control de revisión.' : 'Solo datos ficticios en esta demostración.'}</p></div>
        <span className="worker-tag">{readOnly ? 'Archivada: solo lectura' : editing ? persistent ? 'Edición con revisión' : 'Edición en memoria' : 'Alta de ficha'}</span>
      </div>
      {error && <p role="alert" className="worker-error">{error}</p>}
      <fieldset disabled={busy || readOnly} className="worker-fields">
        <legend className="worker-sr-only">Datos editables del trabajador</legend>
        <label htmlFor="worker-documentType">Tipo de documento *
          <select id="worker-documentType" value={draft.documentType} onChange={(e) => onChange('documentType', e.target.value)}
            aria-invalid={Boolean(fieldErrors.documentType)} aria-describedby={fieldErrors.documentType ? 'error-documentType' : undefined}>
            <option value="DNI">DNI</option><option value="NIE">NIE</option>
          </select>
          {fieldErrors.documentType && <span className="worker-error" id="error-documentType">{fieldErrors.documentType}</span>}
        </label>
        {fields.map(([key, type, required]) => (
          <label htmlFor={`worker-${key}`} key={key}>{WORKER_LABELS[key]}{required ? ' *' : ' (opcional)'}
            <input id={`worker-${key}`} name={key} type={type} required={required} value={draft[key]} autoComplete="off"
              onChange={(e) => onChange(key, e.target.value)}
              aria-invalid={Boolean(fieldErrors[key])}
              aria-describedby={fieldErrors[key] ? `error-${key}` : key === 'document' ? 'document-help' : undefined} />
            {fieldErrors[key] && <span className="worker-error" id={`error-${key}`}>{fieldErrors[key]}</span>}
            {key === 'document' && <small id="document-help">Se comprueba formato y letra, no la identidad.</small>}
          </label>
        ))}
        {!persistent || !editing ? <label htmlFor="worker-status">Estado de la ficha *
          <select id="worker-status" value={draft.status} onChange={(e) => onChange('status', e.target.value)}
            aria-invalid={Boolean(fieldErrors.status)} aria-describedby={fieldErrors.status ? 'error-status' : undefined}>
            <option value="draft">Borrador</option><option value="active">Activa</option>
            {readOnly && <option value="archived">Archivada</option>}
          </select>
          {fieldErrors.status && <span className="worker-error" id="error-status">{fieldErrors.status}</span>}
        </label> : <p className="worker-muted">Estado actual: <b>{draft.status === 'active' ? 'Activa' : 'Borrador'}</b>. El archivo y la recuperación requieren una operación específica.</p>}
      </fieldset>
      <p className="worker-notice">Acceso de fichaje: {accessEnabled ? 'habilitado' : 'pendiente de habilitar'}. Habilitarlo crea una cuenta separada y no modifica los permisos administrativos.</p>
      <div className="worker-actions">
        {!readOnly && <button type="submit" className="worker-primary" disabled={busy}>{busy ? 'Guardando…' : persistent ? 'Guardar cambios' : 'Guardar en memoria'}</button>}
        <button type="button" onClick={onCancel} disabled={busy}>{readOnly ? 'Cerrar detalle' : 'Cancelar'}</button>
      </div>
    </form>
  )
}

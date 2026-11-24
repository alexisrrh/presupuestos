import { WORKER_LABELS, WORKER_STATUSES } from '../../services/workers/workerDomain.js'
const actions = { created: 'Ficha creada', edited: 'Datos modificados', archived: 'Ficha archivada', restored: 'Ficha recuperada' }
function displayDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(date)
}
export default function WorkerHistory({ history = [], mode = 'demo' }) {
  return (
    <section className="worker-panel" aria-labelledby="worker-history-title">
      <h2 id="worker-history-title">Historial de la ficha</h2>
      <p className="worker-muted">{mode === 'persistent' ? 'Historial de auditoría disponible para administradores autorizados.' : 'Historial de demostración, solo en memoria. No es auditoría de producción.'}</p>
      {history.length === 0 ? <p>No hay cambios registrados.</p> : (
        <ol className="worker-history">{[...history].reverse().map((entry, index) => (
          <li key={`${entry.at}-${index}`}>
            <strong>{actions[entry.action] || 'Cambio registrado'}</strong>
            <p>{displayDate(entry.at)} · {entry.actorLabel || 'Autor no disponible en el dato inicial'}</p>
            {entry.reason && <p><b>Motivo:</b> {entry.reason}</p>}
            {entry.changes?.length > 0 && <ul>{entry.changes.map((change) => {
              const value = (v) => change.field === 'status' ? WORKER_STATUSES[v] || '(vacío)' : v || '(vacío)'
              return <li key={change.field}>{WORKER_LABELS[change.field] || change.field}: {value(change.before)} → {value(change.after)}</li>
            })}</ul>}
          </li>
        ))}</ol>
      )}
    </section>
  )
}

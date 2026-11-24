import { maskWorkerDocument, WORKER_STATUSES } from '../../services/workers/workerDomain.js'
function Actions({ worker, onOpen, onArchive, onEnable, onReset, busy, supportsArchive }) {
  return <div className="worker-actions">
    <button disabled={busy} onClick={() => onOpen(worker)} aria-label={`Detalle de ${worker.firstName} ${worker.lastName}`}>Detalle</button>
    {supportsArchive && <button disabled={busy} onClick={() => onArchive(worker)} aria-label={`${worker.status === 'archived' ? 'Recuperar' : 'Archivar'} a ${worker.firstName} ${worker.lastName}`}>
      {worker.status === 'archived' ? 'Recuperar' : 'Archivar'}
    </button>}
    {onEnable && worker.status === 'active' && !worker.userId && <button disabled={busy} onClick={() => onEnable(worker)}>Habilitar acceso</button>}
    {onReset && worker.status === 'active' && worker.userId && <button disabled={busy} onClick={() => onReset(worker)}>Restablecer acceso</button>}
  </div>
}
export default function WorkersList({ workers, onOpen, onArchive, onEnable, onReset, busy, loading, supportsArchive = false }) {
  if (loading) return <p role="status" className="worker-empty">Cargando fichas…</p>
  if (!workers.length) return <p className="worker-empty">No hay resultados. Revisa los filtros o añade una ficha.</p>
  return <>
    <div className="worker-desktop-table">
      <table className="worker-table"><caption className="worker-sr-only">Fichas de trabajadores de la organización actual</caption>
        <thead><tr><th scope="col">Código</th><th scope="col">Trabajador</th><th scope="col">Documento</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
        <tbody>{workers.map((worker) => <tr key={worker.id}>
          <td>{worker.employeeCode}</td><th scope="row">{worker.firstName} {worker.lastName}<small>{worker.position || 'Puesto pendiente'}</small></th>
          <td>{maskWorkerDocument(worker.document)}</td><td><span className="worker-tag">{WORKER_STATUSES[worker.status]}</span></td>
          <td><Actions worker={worker} onOpen={onOpen} onArchive={onArchive} onEnable={onEnable} onReset={onReset} busy={busy} supportsArchive={supportsArchive} /></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="worker-mobile-cards">{workers.map((worker) => <article className="worker-card" key={worker.id}>
      <h3>{worker.firstName} {worker.lastName}</h3>
      <p>{worker.employeeCode} · {maskWorkerDocument(worker.document)}</p>
      <p>{worker.position || 'Puesto pendiente'} · <b>{WORKER_STATUSES[worker.status]}</b></p>
      <Actions worker={worker} onOpen={onOpen} onArchive={onArchive} onEnable={onEnable} onReset={onReset} busy={busy} supportsArchive={supportsArchive} />
    </article>)}</div>
  </>
}

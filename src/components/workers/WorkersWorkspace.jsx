import { useEffect, useMemo, useRef, useState } from 'react'
import { blankWorkerForm, toWorkerForm, validateArchiveReason } from '../../services/workers/workerDomain.js'
import WorkerDialog from './WorkerDialog'
import WorkerForm from './WorkerForm'
import WorkerHistory from './WorkerHistory'
import WorkersList from './WorkersList'
import './workers.css'

function ActionDialog({ action, busy, error, mode, onCancel, onConfirm }) {
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const restoring = action.worker.status === 'archived'
  return <WorkerDialog title={restoring ? 'Recuperar ficha' : 'Archivar ficha'} busy={busy} onCancel={onCancel}>
    <p>{action.worker.firstName} {action.worker.lastName} · {action.worker.employeeCode}</p>
    <p>{restoring ? 'Se conservará el historial y se recuperará el estado anterior.' : 'La ficha dejará de aparecer entre las activas. No se borrará su historial.'}</p>
    <p className="worker-muted">{mode === 'demo'
      ? 'Esta acción de demo no crea, revoca ni modifica cuentas reales.'
      : 'La operación queda registrada en el historial de la ficha.'}</p>
    <form noValidate onSubmit={(event) => {
      event.preventDefault()
      try { validateArchiveReason(reason); setReasonError(''); onConfirm(reason) }
      catch (failure) { setReasonError(failure.message) }
    }}>
      <label htmlFor="archive-reason">Motivo obligatorio
        <textarea id="archive-reason" autoFocus required minLength={3} maxLength={500} disabled={busy}
          value={reason} onChange={(e) => setReason(e.target.value)}
          aria-invalid={Boolean(reasonError)} aria-describedby="archive-reason-help" />
      </label>
      <p id="archive-reason-help" className={reasonError ? 'worker-error' : 'worker-muted'}>{reasonError || 'Entre 3 y 500 caracteres. No incluyas diagnósticos ni información sensible.'}</p>
      {error && <p className="worker-error" role="alert">{error}</p>}
      <div className="worker-actions">
        <button type="button" disabled={busy} onClick={onCancel}>Cancelar</button>
        <button type="submit" className="worker-primary" disabled={busy}>{busy ? 'Procesando…' : restoring ? 'Confirmar recuperación' : 'Confirmar archivo'}</button>
      </div>
    </form>
  </WorkerDialog>
}

function AccessDialog({ worker, busy, error, onCancel, onConfirm }) {
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('Habilitación de acceso de fichaje')
  return <WorkerDialog title="Habilitar acceso de fichaje" busy={busy} onCancel={onCancel}>
    <p>{worker.firstName} {worker.lastName} · {worker.employeeCode}</p>
    <p className="worker-muted">Se creará una cuenta de acceso vinculada a esta ficha. La contraseña no se guarda ni se muestra en el historial.</p>
    <form noValidate onSubmit={(event) => { event.preventDefault(); if (password.length < 8) return; onConfirm(password, reason) }}>
      <label htmlFor="worker-access-password">Contraseña temporal
        <input id="worker-access-password" type="password" minLength={8} required disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      <label htmlFor="worker-access-reason">Motivo
        <input id="worker-access-reason" required minLength={3} maxLength={500} disabled={busy} value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      {error && <p className="worker-error" role="alert">{error}</p>}
      <div className="worker-actions"><button type="button" disabled={busy} onClick={onCancel}>Cancelar</button><button type="submit" className="worker-primary" disabled={busy || password.length < 8}>{busy ? 'Procesando…' : 'Habilitar acceso'}</button></div>
    </form>
  </WorkerDialog>
}
function ResetDialog({ worker, busy, error, onCancel, onConfirm }) {
  const [password, setPassword] = useState('')
  return <WorkerDialog title="Restablecer acceso" busy={busy} onCancel={onCancel}><p>{worker.firstName} {worker.lastName}</p><p className="worker-muted">Sólo se permite para trabajadores employee de tu organización. No se muestran contraseñas anteriores.</p><form onSubmit={(event) => { event.preventDefault(); if (password.length >= 8) onConfirm(password) }}><label htmlFor="worker-reset-password">Nueva contraseña<input id="worker-reset-password" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="worker-error" role="alert">{error}</p>}<div className="worker-actions"><button type="button" onClick={onCancel} disabled={busy}>Cancelar</button><button type="submit" className="worker-primary" disabled={busy || password.length < 8}>Restablecer acceso</button></div></form></WorkerDialog>
}

// A fresh keyed instance is required when the authorized user/organization changes.
export default function WorkersWorkspace({ repository, contextKey, canManage = false, mode = 'demo' }) {
  if (!canManage || !contextKey) return <section role="alert">No tienes acceso a la gestión de trabajadores.</section>
  return <WorkspaceState key={contextKey} repository={repository} mode={mode} />
}

function WorkspaceState({ repository, mode }) {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [editor, setEditor] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState(null)
  const [action, setAction] = useState(null)
  const [accessWorker, setAccessWorker] = useState(null)
  const [resetWorker, setResetWorker] = useState(null)
  const [actionError, setActionError] = useState('')
  const alive = useRef(false)
  const writeLock = useRef(false)
  const requestVersion = useRef(0)
  const dirty = Boolean(editor && JSON.stringify(editor.draft) !== editor.initial)

  useEffect(() => {
    alive.current = true
    const version = ++requestVersion.current
    repository.list().then((rows) => {
      if (alive.current && requestVersion.current === version) { setWorkers(rows); setLoading(false) }
    }).catch((error) => {
      if (alive.current && requestVersion.current === version) { setLoadError(error.message); setLoading(false) }
    })
    return () => { alive.current = false; requestVersion.current += 1 }
  }, [repository])
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const visible = useMemo(() => {
    const raw = query.trim().toLocaleLowerCase('es')
    const documentQuery = raw.replace(/[\s.-]/g, '')
    return workers.filter((worker) => (filter === 'all' || worker.status === filter) && (
      `${worker.firstName} ${worker.lastName} ${worker.employeeCode}`.toLocaleLowerCase('es').includes(raw) ||
      worker.document.toLowerCase().includes(documentQuery)
    ))
  }, [workers, query, filter])

  async function openEditor(worker = null) {
    if (worker) {
      setBusy(true)
      try { worker = await repository.get(worker.id) }
      catch (error) { if (alive.current) setFormError(error.message || 'No se pudo cargar la ficha.'); return }
      finally { if (alive.current) setBusy(false) }
    }
    const draft = worker ? toWorkerForm(worker) : blankWorkerForm()
    setEditor({ worker, draft, initial: JSON.stringify(draft), requestId: crypto.randomUUID() })
    setFieldErrors({}); setFormError('')
  }
  function navigate(target) {
    if (writeLock.current) return
    if (dirty) { setPendingNavigation(target); return }
    performNavigation(target)
  }
  function performNavigation(target) {
    setPendingNavigation(null)
    if (target.kind === 'new') openEditor()
    else if (target.kind === 'open') openEditor(target.worker)
    else if (target.kind === 'action') { setEditor(null); setActionError(''); setAction(target) }
    else if (target.kind === 'access') { setEditor(null); setActionError(''); setAccessWorker(target.worker) }
    else if (target.kind === 'reset') { setEditor(null); setActionError(''); setResetWorker(target.worker) }
    else setEditor(null)
  }
  async function save(event) {
    event.preventDefault()
    if (!editor || writeLock.current) return
    writeLock.current = true; setBusy(true); setFormError(''); setFieldErrors({})
    try {
      const next = editor.worker
        ? await repository.update(editor.worker.id, editor.draft, { expectedRevision: editor.worker.revision })
        : await repository.create(editor.draft, { requestId: editor.requestId })
      if (!alive.current) return
      setWorkers((current) => current.some((worker) => worker.id === next.id)
        ? current.map((worker) => worker.id === next.id ? next : worker) : [...current, next])
      openEditor(next)
      setNotice(mode === 'persistent' ? 'Ficha guardada correctamente.' : 'Ficha guardada en memoria. Se reiniciará al recargar la demostración.')
    } catch (error) {
      if (alive.current) { setFormError(error.message || 'No se pudo guardar.'); setFieldErrors(error.fieldErrors || {}) }
    } finally {
      writeLock.current = false
      if (alive.current) setBusy(false)
    }
  }
  async function confirmAction(reason) {
    if (!action || writeLock.current) return
    writeLock.current = true; setBusy(true); setActionError('')
    try {
      const worker = action.worker
      const next = worker.status === 'archived'
        ? await repository.restore(worker.id, reason, { expectedRevision: worker.revision })
        : await repository.archive(worker.id, reason, { expectedRevision: worker.revision })
      if (!alive.current) return
      setWorkers((current) => current.map((row) => row.id === next.id ? next : row))
      setAction(null)
      setNotice(worker.status === 'archived' ? 'Ficha recuperada con su estado anterior.' : 'Ficha archivada con motivo e historial. No se ha borrado.')
    } catch (error) {
      if (alive.current) setActionError(error.message || 'No se pudo completar la operación.')
    } finally {
      writeLock.current = false
      if (alive.current) setBusy(false)
    }
  }
  async function enableAccess(password, reason) {
    if (!accessWorker || writeLock.current) return
    writeLock.current = true; setBusy(true); setActionError('')
    try {
      await repository.enableAccess(accessWorker.id, password, reason, { expectedRevision: accessWorker.revision })
      const next = await repository.get(accessWorker.id)
      if (!alive.current) return
      setWorkers((current) => current.map((row) => row.id === next.id ? next : row))
      setAccessWorker(null); setNotice('Acceso habilitado. Entrega la contraseña temporal por un canal seguro.')
    } catch (error) { if (alive.current) setActionError(error.message || 'No se pudo habilitar el acceso.') }
    finally { writeLock.current = false; if (alive.current) setBusy(false) }
  }
  async function resetAccess(password) {
    if (!resetWorker || writeLock.current) return
    writeLock.current = true; setBusy(true); setActionError('')
    try { await repository.resetWorkerPassword(resetWorker.id, password); setResetWorker(null); setNotice('Acceso restablecido. Entrega la nueva contraseña por un canal seguro.') }
    catch (error) { if (alive.current) setActionError(error.message || 'No se pudo restablecer el acceso.') }
    finally { writeLock.current = false; if (alive.current) setBusy(false) }
  }
  async function retryLoad() {
    if (writeLock.current) return
    setLoading(true); setLoadError('')
    const version = ++requestVersion.current
    try { const rows = await repository.list(); if (alive.current && requestVersion.current === version) setWorkers(rows) }
    catch (error) { if (alive.current && requestVersion.current === version) setLoadError(error.message) }
    finally { if (alive.current && requestVersion.current === version) setLoading(false) }
  }
  return <main className="workers-page">
    {mode === 'demo' ? <div className="worker-demo-banner"><strong>DEMOSTRACIÓN LOCAL — DATOS FICTICIOS — NO GUARDA EN SUPABASE</strong><span>Los cambios se reinician al recargar. No introduzcas datos reales.</span></div> : <div className="worker-persistent-banner"><strong>GESTIÓN DE TRABAJADORES</strong><span>Los cambios usan tu sesión y quedan sujetos a permisos, validación y control de revisión.</span></div>}
    <header className="worker-page-heading"><div><p className="worker-eyebrow">PRITECA GESTIÓN / PERSONAL</p><h1>Trabajadores</h1><p>Fichas organizadas, cambios trazables y acceso separado del alta laboral.</p></div>
      <button className="worker-primary" disabled={busy || loading || Boolean(loadError)} onClick={() => navigate({ kind: 'new' })}>Nuevo trabajador</button></header>
    <div role="status" aria-live="polite" className="worker-status-message">{notice}</div>
    <div className="worker-toolbar">
      <label htmlFor="worker-search">Buscar trabajador<input id="worker-search" placeholder="Nombre, código o documento" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      <label htmlFor="worker-filter">Estado<select id="worker-filter" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Todos</option><option value="draft">Borrador</option><option value="active">Activa</option><option value="archived">Archivada</option></select></label>
      <p>{visible.length} de {workers.length} fichas</p>
    </div>
    {mode === 'persistent' && !repository.supportsArchive && <p className="worker-muted">El archivo y la recuperación todavía no están disponibles: no existe una operación persistente autorizada para ello.</p>}
    {loadError ? <section className="worker-panel" role="alert"><p>{loadError}</p><button onClick={retryLoad}>Reintentar carga</button></section> : <WorkersList workers={visible} loading={loading} busy={busy} supportsArchive={repository.supportsArchive}
      onOpen={(worker) => navigate({ kind: 'open', worker })} onArchive={(worker) => navigate({ kind: 'action', worker })} onEnable={mode === 'persistent' ? (worker) => navigate({ kind: 'access', worker }) : undefined} onReset={mode === 'persistent' ? (worker) => navigate({ kind: 'reset', worker }) : undefined} />}
    {editor && <section className="worker-editor" aria-label="Detalle del trabajador">
      <WorkerForm key={editor.worker?.id || editor.requestId} draft={editor.draft} editing={Boolean(editor.worker)} readOnly={editor.worker?.status === 'archived'} mode={mode}
        onChange={(field, value) => { setEditor((current) => ({ ...current, draft: { ...current.draft, [field]: value } })); setFieldErrors((current) => ({ ...current, [field]: undefined })) }}
        onSubmit={save} onCancel={() => navigate({ kind: 'close' })} fieldErrors={fieldErrors} error={formError} busy={busy} accessEnabled={Boolean(editor.worker?.userId)} />
      {editor.worker && <WorkerHistory history={editor.worker.history} mode={mode} />}
    </section>}
    {pendingNavigation && <WorkerDialog title="Hay cambios sin guardar" onCancel={() => setPendingNavigation(null)}>
      <p>Los cambios de esta ficha todavía no se han guardado. ¿Quieres seguir editando o descartarlos?</p>
      <div className="worker-actions"><button autoFocus onClick={() => setPendingNavigation(null)}>Seguir editando</button><button className="worker-primary" onClick={() => performNavigation(pendingNavigation)}>Descartar cambios</button></div>
    </WorkerDialog>}
    {action && repository.supportsArchive && <ActionDialog key={action.worker.id} action={action} busy={busy} error={actionError} mode={mode} onCancel={() => { if (!writeLock.current) setAction(null) }} onConfirm={confirmAction} />}
    {accessWorker && <AccessDialog worker={accessWorker} busy={busy} error={actionError} onCancel={() => { if (!writeLock.current) setAccessWorker(null) }} onConfirm={enableAccess} />}
    {resetWorker && <ResetDialog worker={resetWorker} busy={busy} error={actionError} onCancel={() => { if (!writeLock.current) setResetWorker(null) }} onConfirm={resetAccess} />}
  </main>
}

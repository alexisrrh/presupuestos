import { AlertTriangle, CheckCircle2, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import useAdminTimeTracking from '../hooks/useAdminTimeTracking'
import { createAdminTimeTrackingService } from '../services/timeTracking/adminTimeTrackingService'

const madridDateTime = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid',
})
const madridInput = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

function formatDateTime(value) { return value ? madridDateTime.format(new Date(value)) : '—' }

function toMadridInput(value) {
  if (!value) return ''
  const values = Object.fromEntries(madridInput.formatToParts(new Date(value))
    .filter(({ type }) => type !== 'literal').map(({ type, value: part }) => [type, part]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}

// datetime-local has no zone. Convert its wall time explicitly as Europe/Madrid
// rather than relying on the browser/container timezone.
function madridInputToIso(value) {
  if (!value) return null
  const [date, time] = value.split('T')
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  let instant = Date.UTC(year, month - 1, day, hour, minute)
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid', timeZoneName: 'shortOffset', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(instant))
    const offset = parts.find(({ type }) => type === 'timeZoneName')?.value || 'GMT+0'
    const match = offset.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/) || ['GMT+0', '+', '0', '0']
    const minutes = (Number(match[2]) * 60 + Number(match[3] || 0)) * (match[1] === '-' ? -1 : 1)
    instant = Date.UTC(year, month - 1, day, hour, minute) - minutes * 60_000
  }
  return new Date(instant).toISOString()
}

function SessionCard({ onSelect, selected, session }) {
  const statusLabel = session.status === 'open' ? 'Abierta' : session.status === 'voided' ? 'Anulada' : 'Cerrada'
  return (
    <button type="button" onClick={() => onSelect(session)} className={`w-full rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[#174f46] ${selected ? 'border-[#174f46] bg-[#eef7f4]' : 'border-[#d8dfdb] bg-white hover:bg-[#f7faf8]'}`}>
      <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{session.first_name} {session.last_name}</p><p className="mt-1 text-sm text-[#60706a]">{session.employee_code}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${session.status === 'open' ? 'bg-amber-100 text-amber-800' : session.status === 'voided' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>{statusLabel}</span></div>
      <p className="mt-3 text-sm text-[#334155]">Entrada: {formatDateTime(session.clock_in_at)}</p>
      <p className="mt-1 text-sm text-[#60706a]">Salida: {formatDateTime(session.clock_out_at)} · Rev. {session.revision}</p>
    </button>
  )
}

function WorkSessions({ membership }) {
  const enabled = ['owner', 'admin'].includes(membership?.role) && membership?.is_active !== false
  const { applyFilters, filters, message, refresh, sessions, setFilters, status, update } = useAdminTimeTracking({ enabled })
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const [historyStatus, setHistoryStatus] = useState('idle')
  const [operation, setOperation] = useState('correct')
  const [reason, setReason] = useState('')
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [notice, setNotice] = useState('')

  const selectedCurrent = useMemo(
    () => sessions.find((session) => session.session_id === selected?.session_id) || selected,
    [selected, sessions],
  )

  const selectedSessionId = selectedCurrent?.session_id

  useEffect(() => {
    if (!selectedSessionId) return undefined
    let active = true
    queueMicrotask(() => { if (active) setHistoryStatus('loading') })
    createAdminTimeTrackingService().history(selectedSessionId)
      .then((rows) => { if (active) { setHistory(rows); setHistoryStatus('ready') } })
      .catch(() => { if (active) setHistoryStatus('error') })
    return () => { active = false }
  }, [selectedSessionId])

  const selectSession = (session) => {
    setSelected(session)
    setHistory([])
    setHistoryStatus('idle')
    setOperation(session.status === 'open' ? 'close_forgotten' : 'correct')
    setClockIn(toMadridInput(session.clock_in_at))
    setClockOut(toMadridInput(session.clock_out_at))
    setReason('')
    setNotice('')
  }

  const save = async (event) => {
    event.preventDefault()
    if (!selectedCurrent) return
    const changes = operation === 'correct'
      ? {
          ...(clockIn ? { clock_in_at: madridInputToIso(clockIn) } : {}),
          ...(clockOut ? { clock_out_at: madridInputToIso(clockOut) } : {}),
        }
      : operation === 'close_forgotten' ? { clock_out_at: madridInputToIso(clockOut) } : {}
    const outcome = await update({
      workSessionId: selectedCurrent.session_id,
      expectedRevision: selectedCurrent.revision,
      operation,
      changes,
      reason,
    })
    if (outcome.kind === 'saved') {
      setNotice(operation === 'void' ? 'Jornada anulada y trazada.' : 'Jornada actualizada y trazada.')
      setSelected(null)
      setHistory([])
      setHistoryStatus('idle')
      setReason('')
    }
  }

  if (!enabled) return <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">No tienes permiso para gestionar jornadas.</section>

  return (
    <section className="space-y-5" aria-labelledby="work-sessions-title">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#60706a]">Administración</p><h1 id="work-sessions-title" className="mt-1 text-2xl font-semibold text-[#1f2933]">Jornadas</h1><p className="mt-2 text-sm text-[#60706a]">Consulta, corrige o anula registros sin borrar su historial.</p></div><button type="button" onClick={() => refresh()} disabled={status === 'loading' || status === 'sending'} className="min-h-11 rounded-xl border border-[#d8dfdb] bg-white px-4 text-sm font-semibold text-[#174f46] disabled:opacity-50">Actualizar</button></header>
      <form onSubmit={(event) => { event.preventDefault(); applyFilters(filters) }} className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-4">
        <label className="text-sm font-medium">Desde<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-[#d8dfdb] px-3" /></label>
        <label className="text-sm font-medium">Hasta<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-[#d8dfdb] px-3" /></label>
        <label className="text-sm font-medium">Estado<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-[#d8dfdb] px-3"><option value="">Todos</option><option value="open">Abiertas</option><option value="closed">Cerradas</option><option value="voided">Anuladas</option></select></label>
        <button type="submit" className="min-h-11 self-end rounded-xl bg-[#174f46] px-4 text-sm font-bold text-white">Aplicar filtros</button>
      </form>
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mr-2 inline" size={18} />{notice}</p>}
      {(status === 'error' || status === 'uncertain' || status === 'forbidden') && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800"><AlertTriangle className="mr-2 inline" size={18} />{message}</p>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]"><div className="space-y-3" aria-label="Listado de jornadas">{status === 'loading' && <p className="rounded-2xl bg-white p-5 text-sm text-[#60706a]">Cargando jornadas…</p>}{status !== 'loading' && sessions.length === 0 && <p className="rounded-2xl bg-white p-5 text-sm text-[#60706a]">No hay jornadas que coincidan con los filtros.</p>}{sessions.map((session) => <SessionCard key={session.session_id} session={session} selected={selectedCurrent?.session_id === session.session_id} onSelect={selectSession} />)}</div>
        <aside className="rounded-2xl bg-white p-5 shadow-sm" aria-live="polite">{!selectedCurrent ? <p className="text-sm text-[#60706a]">Selecciona una jornada para ver su detalle e historial.</p> : <><h2 className="text-lg font-semibold">Detalle de jornada</h2><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-[#60706a]">Trabajador</dt><dd className="font-medium">{selectedCurrent.first_name} {selectedCurrent.last_name}</dd></div><div><dt className="text-[#60706a]">Estado</dt><dd className="font-medium">{selectedCurrent.status}</dd></div><div><dt className="text-[#60706a]">Entrada</dt><dd>{formatDateTime(selectedCurrent.clock_in_at)}</dd></div><div><dt className="text-[#60706a]">Salida</dt><dd>{formatDateTime(selectedCurrent.clock_out_at)}</dd></div></dl>
          {selectedCurrent.status !== 'voided' && <form className="mt-5 space-y-4 border-t border-[#edf0ee] pt-5" onSubmit={save}><label className="text-sm font-medium">Operación<select value={operation} onChange={(event) => setOperation(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#d8dfdb] px-3"><option value="correct">Corregir hora</option>{selectedCurrent.status === 'open' && <option value="close_forgotten">Cerrar jornada olvidada</option>}<option value="void">Anular registro erróneo</option></select></label>
            {operation === 'correct' && <><label className="block text-sm font-medium">Entrada propuesta<input required type="datetime-local" value={clockIn} onChange={(event) => setClockIn(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#d8dfdb] px-3" /></label><label className="block text-sm font-medium">Salida propuesta (si corresponde)<input type="datetime-local" value={clockOut} onChange={(event) => setClockOut(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#d8dfdb] px-3" /></label></>}
            {operation === 'close_forgotten' && <label className="block text-sm font-medium">Salida indicada<input required type="datetime-local" value={clockOut} onChange={(event) => setClockOut(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#d8dfdb] px-3" /></label>}
            <label className="block text-sm font-medium">Motivo<textarea required minLength="3" maxLength="500" value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-[#d8dfdb] p-3" placeholder="Explica el motivo de esta operación" /></label>
            <div className="rounded-xl bg-[#f5f7f6] p-3 text-xs text-[#52616b]"><strong>Antes:</strong> {formatDateTime(selectedCurrent.clock_in_at)} — {formatDateTime(selectedCurrent.clock_out_at)}<br /><strong>Propuesta:</strong> {operation === 'void' ? 'Registro anulado, conservando evidencia.' : `${clockIn || '—'} — ${clockOut || 'abierta'}`}</div>
            <button type="submit" disabled={status === 'sending'} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#174f46] px-4 font-bold text-white disabled:opacity-50"><Save size={18} />{status === 'sending' ? 'Guardando…' : 'Confirmar operación'}</button></form>}
          <section className="mt-5 border-t border-[#edf0ee] pt-5"><h3 className="font-semibold">Historial de modificaciones</h3>{historyStatus === 'loading' && <p className="mt-2 text-sm text-[#60706a]">Cargando historial…</p>}{historyStatus === 'error' && <p role="alert" className="mt-2 text-sm text-red-700">No se pudo cargar el historial.</p>}<ol className="mt-3 space-y-3">{history.map((entry) => <li key={entry.audit_id} className="border-l-2 border-[#d8dfdb] pl-3 text-sm"><p className="font-medium">{entry.action}</p><p className="text-[#60706a]">{formatDateTime(entry.occurred_at)}</p>{entry.reason && <p className="mt-1">{entry.reason}</p>}</li>)}</ol></section></>}</aside></div>
    </section>
  )
}

export default WorkSessions

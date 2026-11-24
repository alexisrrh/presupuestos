import { useCallback, useEffect, useMemo, useState } from 'react'
import { createTimeCorrectionService, TimeCorrectionError } from '../../services/timeTracking/timeCorrectionService'

function toIso(value) { return value ? new Date(value).toISOString() : null }
function formatDate(value) { return value ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: 'Europe/Madrid' }).format(new Date(value)) : '—' }

export default function TimeCorrectionRequestForm({ workerId, history = [] }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('entry_forgotten')
  const [sessionId, setSessionId] = useState('')
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [reason, setReason] = useState('')
  const [requests, setRequests] = useState([])
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const service = useMemo(() => createTimeCorrectionService(), [])

  const load = useCallback(async () => {
    try { setRequests(await service.mine()) } catch (error) { setMessage(error.message) }
  }, [service])
  useEffect(() => { if (workerId) queueMicrotask(load) }, [load, workerId])

  const submit = async (event) => {
    event.preventDefault(); setStatus('sending'); setMessage('')
    try {
      await service.submit({ workerId, workSessionId: sessionId || null, kind, clockInAt: toIso(clockIn), clockOutAt: toIso(clockOut), reason })
      setStatus('ready'); setMessage('Solicitud enviada para revisión.'); setReason(''); setOpen(false); await load()
    } catch (error) {
      const mapped = error instanceof TimeCorrectionError ? error : new TimeCorrectionError('UNKNOWN', 'No se pudo enviar la solicitud.')
      setStatus('error'); setMessage(mapped.message)
    }
  }

  return <section className="rounded-2xl bg-white p-5 shadow-sm" aria-labelledby="correction-request-title">
    <div className="flex items-center justify-between gap-3"><div><p id="correction-request-title" className="text-base font-semibold">Fichaje olvidado</p><p className="mt-1 text-sm text-[#60706a]">Solicita una corrección sin cambiar la jornada directamente.</p></div><button type="button" onClick={() => setOpen((value) => !value)} className="min-h-11 rounded-xl bg-[#174f46] px-4 text-sm font-bold text-white">{open ? 'Cerrar' : 'Solicitar'}</button></div>
    {open && <form className="mt-4 space-y-3 border-t border-[#edf0ee] pt-4" onSubmit={submit}><label className="block text-sm font-medium">Tipo<select value={kind} onChange={(event) => setKind(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#d8dfdb] px-3"><option value="entry_forgotten">Entrada olvidada</option><option value="exit_forgotten">Salida olvidada</option><option value="time_correction">Corregir una hora</option><option value="full_day_forgotten">Jornada completa olvidada</option></select></label><label className="block text-sm font-medium">Jornada relacionada (opcional)<select value={sessionId} onChange={(event) => setSessionId(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#d8dfdb] px-3"><option value="">Sin jornada relacionada</option>{history.map((session) => <option key={session.session_id} value={session.session_id}>{formatDate(session.clock_in_at)} · {session.session_status === 'open' ? 'abierta' : 'cerrada'}</option>)}</select></label><label className="block text-sm font-medium">Entrada propuesta<input required type="datetime-local" value={clockIn} onChange={(event) => setClockIn(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#d8dfdb] px-3" /></label><label className="block text-sm font-medium">Salida propuesta (opcional)<input type="datetime-local" value={clockOut} onChange={(event) => setClockOut(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#d8dfdb] px-3" /></label><label className="block text-sm font-medium">Motivo<textarea required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-[#d8dfdb] p-3" /></label><button type="submit" disabled={status === 'sending'} className="min-h-12 w-full rounded-xl bg-[#f58220] px-4 font-bold text-white disabled:opacity-50">{status === 'sending' ? 'Enviando…' : 'Enviar solicitud'}</button></form>}
    {message && <p role={status === 'error' ? 'alert' : 'status'} className="mt-3 text-sm text-[#60706a]">{message}</p>}
    <div className="mt-4 border-t border-[#edf0ee] pt-4"><h3 className="text-sm font-semibold">Mis solicitudes</h3>{requests.length === 0 ? <p className="mt-2 text-sm text-[#60706a]">No hay solicitudes todavía.</p> : <ul className="mt-2 space-y-2 text-sm">{requests.slice(0, 5).map((request) => <li key={request.id} className="flex items-center justify-between gap-3"><span>{formatDate(request.proposed_clock_in_at)} · {request.kind}</span><span className="font-semibold">{request.status === 'pending' ? 'Pendiente' : request.status === 'approved' ? 'Aprobada' : 'Rechazada'}</span></li>)}</ul>}</div>
  </section>
}

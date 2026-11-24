import { useCallback, useEffect, useMemo, useState } from 'react'
import { createTimeCorrectionService, TimeCorrectionError } from '../../services/timeTracking/timeCorrectionService'

function format(value) { return value ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date(value)) : '—' }

export default function CorrectionRequestsPanel({ onPendingCount }) {
  const service = useMemo(() => createTimeCorrectionService(), [])
  const [requests, setRequests] = useState([])
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [reason, setReason] = useState({})
  const load = useCallback(async () => { setStatus('loading'); try { const rows = await service.adminList({ status: 'pending' }); setRequests(rows); onPendingCount?.(rows.length); setStatus('ready') } catch (error) { setStatus('error'); setMessage(error.message); onPendingCount?.(0) } }, [onPendingCount, service])
  useEffect(() => { queueMicrotask(load) }, [load])
  const resolve = async (request, decision) => {
    const text = reason[request.id]?.trim() || ''
    if (text.length < 3) { setMessage('Escribe un motivo de resolución.'); return }
    setStatus('sending'); setMessage('')
    try { await service.resolve({ requestId: request.id, expectedRevision: request.revision, decision, reason: text }); setMessage(decision === 'approved' ? 'Solicitud aprobada.' : 'Solicitud rechazada.'); await load() }
    catch (error) { const mapped = error instanceof TimeCorrectionError ? error : new TimeCorrectionError('UNKNOWN', 'No se pudo resolver la solicitud.'); setStatus('error'); setMessage(mapped.message); await load() }
  }
  return <section className="rounded-2xl bg-white p-5 shadow-sm" aria-labelledby="correction-requests-title"><div className="flex items-center justify-between gap-3"><div><h2 id="correction-requests-title" className="text-lg font-semibold">Solicitudes de fichaje</h2><p className="mt-1 text-sm text-[#60706a]">Revisa propuestas sin sobrescribir la jornada original.</p></div><button type="button" onClick={load} disabled={status === 'loading' || status === 'sending'} className="min-h-11 rounded-xl border border-[#d8dfdb] px-4 text-sm font-semibold text-[#174f46]">Actualizar</button></div>{message && <p role={status === 'error' ? 'alert' : 'status'} className="mt-3 rounded-xl bg-[#f5f7f6] p-3 text-sm">{message}</p>}{status === 'loading' && <p className="mt-4 text-sm text-[#60706a]">Cargando solicitudes…</p>}{status !== 'loading' && requests.length === 0 && <p className="mt-4 text-sm text-[#60706a]">No hay solicitudes pendientes.</p>}<ul className="mt-4 space-y-4">{requests.map((request) => <li key={request.id} className="rounded-xl border border-[#d8dfdb] p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{request.kind}</strong><span className="text-xs text-[#60706a]">{format(request.created_at)}</span></div><p className="mt-2 text-sm">Propuesta: {format(request.proposed_clock_in_at)} — {format(request.proposed_clock_out_at)}</p><p className="mt-1 text-sm text-[#60706a]">Motivo: {request.reason}</p><textarea aria-label="Resolución" value={reason[request.id] || ''} onChange={(event) => setReason((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Motivo de la decisión" minLength={3} maxLength={500} className="mt-3 min-h-20 w-full rounded-lg border border-[#d8dfdb] p-3 text-sm" /><div className="mt-3 flex gap-2"><button type="button" onClick={() => resolve(request, 'approved')} disabled={status === 'sending'} className="min-h-11 rounded-lg bg-[#174f46] px-4 text-sm font-bold text-white disabled:opacity-50">Aprobar</button><button type="button" onClick={() => resolve(request, 'rejected')} disabled={status === 'sending'} className="min-h-11 rounded-lg border border-red-200 px-4 text-sm font-bold text-red-700 disabled:opacity-50">Rechazar</button></div></li>)}</ul></section>
}

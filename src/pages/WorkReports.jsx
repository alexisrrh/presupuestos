import { Download, FileText, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { createSupabaseWorkerRepository } from '../services/workers/supabaseWorkerRepository'
import { createTimeReportService, formatDuration, reportToCsv, TimeReportError } from '../services/timeTracking/timeReportService'

function monthRange() {
  const now = new Date()
  const year = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric' }).format(now)
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', month: '2-digit' }).format(now)
  const last = new Date(Number(year), Number(month), 0).getDate()
  return { from: `${year}-${month}-01`, to: `${year}-${month}-${String(last).padStart(2, '0')}` }
}

function downloadCsv(csv, from, to) {
  const blob = new Blob([`Periodo: ${from} a ${to} (Europe/Madrid)\r\n`, csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = `informe-tiempo-${from}-${to}.csv`; link.click(); URL.revokeObjectURL(url)
}

export default function WorkReports({ membership }) {
  const enabled = ['owner', 'admin'].includes(membership?.role) && membership?.is_active !== false
  const initial = useMemo(() => monthRange(), [])
  const [filters, setFilters] = useState({ ...initial, workerId: '' })
  const [workers, setWorkers] = useState([])
  const [report, setReport] = useState(null)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const organizationId = membership?.organization_id
  const workerRepository = useMemo(() => organizationId && supabase ? createSupabaseWorkerRepository({ client: supabase, organizationId }) : null, [organizationId])
  const [reportService] = useState(() => createTimeReportService())

  useEffect(() => {
    if (!enabled || !workerRepository) return undefined
    let active = true
    workerRepository.list().then((rows) => { if (active) setWorkers(rows) }).catch(() => { if (active) setMessage('No se pudo cargar la lista de trabajadores.') })
    return () => { active = false }
  }, [enabled, workerRepository])

  const run = useCallback(async (event) => {
    event?.preventDefault(); setStatus('loading'); setMessage('')
    try { const next = await reportService.report(filters); setReport(next); setStatus('ready') }
    catch (error) { setStatus(error instanceof TimeReportError && error.code === 'FORBIDDEN' ? 'forbidden' : 'error'); setMessage(error.message) }
  }, [filters, reportService])

  useEffect(() => { if (enabled) queueMicrotask(() => run()) }, [enabled, run])

  if (!enabled) return <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">No tienes permiso para consultar informes.</section>
  return <section className="space-y-5" aria-labelledby="work-reports-title">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#60706a]">Administración</p><h1 id="work-reports-title" className="mt-1 text-2xl font-semibold text-[#1f2933]">Informes de tiempo</h1><p className="mt-2 text-sm text-[#60706a]">Tiempo registrado en jornadas cerradas. Las abiertas quedan pendientes de cierre.</p></div><button type="button" onClick={() => run()} disabled={status === 'loading'} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d8dfdb] bg-white px-4 text-sm font-semibold text-[#174f46]"><RefreshCw size={17} />Actualizar</button></header>
    <form onSubmit={run} className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-medium">Trabajador<select value={filters.workerId} onChange={(e) => setFilters({ ...filters, workerId: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-[#d8dfdb] px-3"><option value="">Todos los trabajadores</option>{workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.firstName} {worker.lastName} · {worker.employeeCode}</option>)}</select></label><label className="text-sm font-medium">Desde<input required type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-[#d8dfdb] px-3" /></label><label className="text-sm font-medium">Hasta<input required type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-[#d8dfdb] px-3" /></label><button type="submit" disabled={status === 'loading'} className="min-h-11 self-end rounded-xl bg-[#174f46] px-4 font-bold text-white disabled:opacity-50">Consultar</button></form>
    {message && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{message}</p>}
    {status === 'loading' && <p role="status" className="rounded-2xl bg-white p-5 text-sm text-[#60706a]">Cargando informe…</p>}
    {status !== 'loading' && report && <><div className="grid gap-3 sm:grid-cols-3"><article className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-[#60706a]">Tiempo cerrado</p><p className="mt-1 text-2xl font-bold text-[#174f46]">{formatDuration(report.total_seconds)}</p></article><article className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-[#60706a]">Jornadas cerradas</p><p className="mt-1 text-2xl font-bold">{report.closed_count}</p></article><article className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-[#60706a]">Pendientes de cierre</p><p className="mt-1 text-2xl font-bold text-amber-700">{report.open_count}</p></article></div><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[#60706a]">Periodo inclusivo: {report.from} — {report.to} · Europe/Madrid</p><button type="button" onClick={() => downloadCsv(reportToCsv(report), report.from, report.to)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#174f46] px-4 text-sm font-bold text-[#174f46]"><Download size={17} />Exportar CSV</button></div><div className="space-y-3" aria-label="Detalle del informe">{!report.rows.length && <p className="rounded-2xl bg-white p-5 text-sm text-[#60706a]">No hay jornadas que coincidan con el periodo.</p>}{report.rows.map((row) => <article key={row.session_id} className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{row.first_name} {row.last_name}</h2><p className="text-sm text-[#60706a]">{row.employee_code}</p></div><span className="rounded-full bg-[#eef7f4] px-3 py-1 text-xs font-bold">{row.status === 'open' ? 'Pendiente de cierre' : row.status === 'voided' ? 'Anulada' : formatDuration(row.duration_seconds)}</span></div><p className="mt-3 text-sm">Entrada: {new Date(row.clock_in_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p><p className="text-sm text-[#60706a]">Salida: {row.clock_out_at ? new Date(row.clock_out_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : 'Abierta'}</p></article>)}</div></>}
    {status !== 'loading' && !report && <div className="rounded-2xl bg-white p-6 text-center text-sm text-[#60706a]"><FileText className="mx-auto mb-2" size={28} />Selecciona un periodo y consulta el informe.</div>}
  </section>
}

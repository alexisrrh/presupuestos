import { supabase } from '../../lib/supabaseClient'

export class TimeReportError extends Error {
  constructor(code, message) { super(message); this.code = code }
}

function mapError(error) {
  if (error?.code === '42501') return new TimeReportError('FORBIDDEN', 'No tienes permiso para consultar informes.')
  if (error?.code === '22023') return new TimeReportError('VALIDATION', error.message || 'El periodo no es válido.')
  if (error instanceof TypeError || /fetch|network|timeout/i.test(error?.message || '')) return new TimeReportError('CONNECTION', 'No se pudo cargar el informe. Revisa la conexión e inténtalo de nuevo.')
  return new TimeReportError('UNKNOWN', 'No se pudo cargar el informe.')
}

export function formatDuration(totalSeconds = 0) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours} h ${String(minutes).padStart(2, '0')} min`
}

function csvCell(value) {
  const text = String(value ?? '')
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

export function reportToCsv(report) {
  const header = ['Trabajador', 'Código', 'Entrada (Europe/Madrid)', 'Salida (Europe/Madrid)', 'Estado', 'Duración computable', 'Pendiente de cierre']
  const rows = (report?.rows || []).map((row) => [
    `${row.first_name || ''} ${row.last_name || ''}`.trim(), row.employee_code,
    row.clock_in_at, row.clock_out_at || '', row.status,
    formatDuration(row.duration_seconds), row.pending_open ? 'Sí' : 'No',
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n') + '\r\n'
}

export function createTimeReportService(client = supabase) {
  if (!client?.rpc) throw new TimeReportError('CONFIGURATION', 'El servicio de informes no está disponible.')
  return Object.freeze({
    async report({ workerId = null, from, to }) {
      try {
        const { data, error } = await client.rpc('admin_time_report', { p_worker_id: workerId || null, p_from: from, p_to: to })
        if (error) throw error
        return data || { rows: [], total_seconds: 0, closed_count: 0, open_count: 0 }
      } catch (error) { throw mapError(error) }
    },
  })
}

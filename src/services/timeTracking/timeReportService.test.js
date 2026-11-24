import { describe, expect, it } from 'vitest'
import { createTimeReportService, formatDuration, reportToCsv } from './timeReportService'

describe('timeReportService', () => {
  it('formatea acumulados superiores a 24 horas sin redondear jornadas', () => {
    expect(formatDuration(26 * 3600 + 5 * 60)).toBe('26 h 05 min')
  })

  it('genera CSV completo, con separador, zona y protección de fórmulas', () => {
    const csv = reportToCsv({ rows: [{ first_name: '=Riesgo', last_name: 'Álvarez', employee_code: 'A;1', clock_in_at: '2026-11-01T08:00:00Z', clock_out_at: null, status: 'open', duration_seconds: 0, pending_open: true }] })
    expect(csv).toContain('Entrada (Europe/Madrid)')
    expect(csv).toContain("'=Riesgo Álvarez")
    expect(csv).toContain('"A;1"')
    expect(csv).toContain('"Sí"')
  })

  it('envía únicamente los filtros al RPC y propaga permisos', async () => {
    const calls = []
    const service = createTimeReportService({ rpc: (name, args) => { calls.push({ name, args }); return Promise.resolve({ data: { rows: [] }, error: null }) } })
    await expect(service.report({ workerId: 'w1', from: '2026-11-01', to: '2026-11-30' })).resolves.toEqual({ rows: [] })
    expect(calls[0]).toEqual({ name: 'admin_time_report', args: { p_worker_id: 'w1', p_from: '2026-11-01', p_to: '2026-11-30' } })
  })
})

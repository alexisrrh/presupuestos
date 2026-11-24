import { describe, expect, it } from 'vitest'
import { createAdminTimeTrackingService, mapAdminTimeTrackingError } from './adminTimeTrackingService'

function clientWith(responses) {
  const calls = []
  return {
    calls,
    rpc: (name, args) => {
      calls.push({ name, args })
      return Promise.resolve(responses[name])
    },
  }
}

describe('adminTimeTrackingService', () => {
  it('limita filtros, carga historial y envía únicamente la revisión y propuesta de jornada', async () => {
    const client = clientWith({
      admin_list_work_sessions: { data: [{ session_id: 's1' }], error: null },
      admin_list_work_session_audit: { data: [{ audit_id: 1 }], error: null },
      admin_update_work_session_with_revision: { data: [{ id: 's1', revision: 2 }], error: null },
    })
    const service = createAdminTimeTrackingService(client)
    await expect(service.list({ status: 'open' })).resolves.toEqual([{ session_id: 's1' }])
    await expect(service.history('s1')).resolves.toEqual([{ audit_id: 1 }])
    await expect(service.update({ workSessionId: 's1', expectedRevision: 1, operation: 'void', reason: 'Registro duplicado' }))
      .resolves.toMatchObject({ id: 's1', revision: 2 })
    expect(client.calls.at(-1)).toEqual({ name: 'admin_update_work_session_with_revision', args: {
      p_work_session_id: 's1', p_expected_revision: 1, p_operation: 'void', p_changes: {}, p_reason: 'Registro duplicado',
    } })
  })

  it('distingue conflicto, validación y resultado incierto', () => {
    expect(mapAdminTimeTrackingError({ code: '40001' }).code).toBe('CONFLICT')
    expect(mapAdminTimeTrackingError({ code: '22023', message: 'Datos inválidos' }).code).toBe('VALIDATION')
    expect(mapAdminTimeTrackingError(new TypeError('fetch failed')).code).toBe('UNCERTAIN')
  })
})

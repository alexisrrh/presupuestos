import { describe, expect, it } from 'vitest'
import { createTimeTrackingService, mapTimeTrackingError } from './timeTrackingService'

function clientWith(responses) {
  return { rpc: (name) => Promise.resolve(responses[name]) }
}

describe('timeTrackingService', () => {
  it('carga únicamente la proyección personal y el historial persistente', async () => {
    const service = createTimeTrackingService(clientWith({
      get_current_worker_time_tracking_state: { data: [{ worker_id: 'worker-1', session_status: 'open' }], error: null },
      list_current_worker_work_sessions: { data: [{ session_id: 'session-1', session_status: 'open' }], error: null },
    }))
    await expect(service.load()).resolves.toEqual({
      state: { worker_id: 'worker-1', session_status: 'open' },
      history: [{ session_id: 'session-1', session_status: 'open' }],
    })
  })

  it('no convierte un timeout en éxito confirmado', () => {
    expect(mapTimeTrackingError(new TypeError('Network timeout'))).toMatchObject({ code: 'UNCERTAIN' })
  })

  it('presenta un acceso sin vínculo como denegado', () => {
    expect(mapTimeTrackingError({ code: '42501' })).toMatchObject({ code: 'FORBIDDEN' })
  })
})

import { describe, expect, it, vi } from 'vitest'
import { createTimeCorrectionService, TimeCorrectionError } from './timeCorrectionService'

function client(data, error = null) { return { rpc: vi.fn().mockResolvedValue({ data, error }) } }

describe('timeCorrectionService', () => {
  it('maps submit payload without trusting client organization or actor', async () => {
    const api = client({ id: 'request-1' })
    await createTimeCorrectionService(api).submit({ workerId: 'worker-1', workSessionId: null, kind: 'full_day_forgotten', clockInAt: '2026-11-24T08:00:00.000Z', clockOutAt: '2026-11-24T17:00:00.000Z', reason: 'Olvidé fichar' })
    expect(api.rpc).toHaveBeenCalledWith('submit_work_session_correction_request', expect.objectContaining({ p_worker_id: 'worker-1', p_work_session_id: null, p_kind: 'full_day_forgotten' }))
    expect(api.rpc.mock.calls[0][1]).not.toHaveProperty('organization_id')
  })

  it('maps conflicts and duplicate requests', async () => {
    await expect(createTimeCorrectionService(client(null, { code: '40001' })).resolve({ requestId: 'r', expectedRevision: 1, decision: 'approved', reason: 'Revisado' })).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(createTimeCorrectionService(client(null, { code: '23505' })).submit({ workerId: 'w', kind: 'entry_forgotten', clockInAt: '2026-11-24T08:00:00.000Z', reason: 'Olvidé entrada' })).rejects.toBeInstanceOf(TimeCorrectionError)
  })
})

import { supabase } from '../../lib/supabaseClient'

export class TimeCorrectionError extends Error {
  constructor(code, message) { super(message); this.code = code }
}

function mapError(error) {
  if (error instanceof TimeCorrectionError) return error
  if (error?.code === '40001') return new TimeCorrectionError('CONFLICT', 'La solicitud ha cambiado. Actualiza la lista antes de resolverla.')
  if (error?.code === '42501') return new TimeCorrectionError('FORBIDDEN', 'No tienes permiso para esta solicitud.')
  if (error?.code === '23505') return new TimeCorrectionError('DUPLICATE', 'Ya existe una solicitud equivalente pendiente.')
  if (error?.code === '22023') return new TimeCorrectionError('VALIDATION', error.message || 'Revisa los datos de la solicitud.')
  if (error instanceof TypeError || /network|fetch|timeout/i.test(error?.message || '')) return new TimeCorrectionError('UNCERTAIN', 'No se pudo confirmar la operación. Actualiza antes de repetirla.')
  return new TimeCorrectionError('UNKNOWN', 'No se pudo completar la solicitud.')
}

export function createTimeCorrectionService(client = supabase) {
  if (!client?.rpc) throw new TimeCorrectionError('CONFIGURATION', 'El servicio de solicitudes no está disponible.')
  const call = async (name, args) => {
    try {
      const { data, error } = await client.rpc(name, args)
      if (error) throw error
      return data
    } catch (error) { throw mapError(error) }
  }
  return Object.freeze({
    async submit({ workerId, workSessionId = null, kind, clockInAt, clockOutAt = null, reason }) {
      return call('submit_work_session_correction_request', {
        p_worker_id: workerId, p_work_session_id: workSessionId, p_kind: kind,
        p_proposed_clock_in_at: clockInAt, p_proposed_clock_out_at: clockOutAt, p_reason: reason,
      })
    },
    async mine(limit = 50) { return call('list_my_work_session_correction_requests', { p_limit: limit }) },
    async adminList({ status = 'pending', workerId = null, from = null, to = null } = {}) {
      return call('admin_list_work_session_correction_requests', { p_status: status, p_worker_id: workerId, p_from: from, p_to: to, p_limit: 100 })
    },
    async resolve({ requestId, expectedRevision, decision, reason }) {
      return call('resolve_work_session_correction_request', { p_request_id: requestId, p_expected_revision: expectedRevision, p_decision: decision, p_resolution_reason: reason })
    },
  })
}

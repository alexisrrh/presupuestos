import { supabase } from '../../lib/supabaseClient'

const timeoutMs = 4_000

export class AdminTimeTrackingError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

export function mapAdminTimeTrackingError(error) {
  if (error instanceof AdminTimeTrackingError) return error
  if (error?.code === '40001') return new AdminTimeTrackingError('CONFLICT', 'La jornada ha cambiado. Se ha recuperado su estado actual para que revises la propuesta.')
  if (error?.code === '42501') return new AdminTimeTrackingError('FORBIDDEN', 'No tienes permiso para gestionar esta jornada.')
  if (error?.code === '22023') return new AdminTimeTrackingError('VALIDATION', error.message || 'Revisa los datos y el motivo de la corrección.')
  if (error instanceof TypeError || /network|fetch|timeout/i.test(error?.message || '')) {
    return new AdminTimeTrackingError('UNCERTAIN', 'No se pudo confirmar el resultado. Consulta la jornada antes de volver a guardar.')
  }
  return new AdminTimeTrackingError('UNKNOWN', 'No se pudo completar la gestión de la jornada.')
}

async function withTimeout(request) {
  let timeoutId
  try {
    return await Promise.race([
      request,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new TypeError('Network timeout')), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timeoutId)
  }
}

function requireClient(client) {
  if (!client?.rpc) throw new AdminTimeTrackingError('CONFIGURATION', 'El servicio de jornadas no está disponible.')
  return client
}

export function createAdminTimeTrackingService(client = supabase) {
  const api = requireClient(client)
  const call = async (name, args) => {
    try {
      const { data, error } = await withTimeout(api.rpc(name, args))
      if (error) throw error
      return data
    } catch (error) {
      throw mapAdminTimeTrackingError(error)
    }
  }

  return Object.freeze({
    async list(filters = {}) {
      const rows = await call('admin_list_work_sessions', {
        p_worker_id: filters.workerId || null,
        p_from: filters.from || null,
        p_to: filters.to || null,
        p_status: filters.status || null,
        p_limit: 100,
      })
      return Array.isArray(rows) ? rows : []
    },
    async history(workSessionId) {
      const rows = await call('admin_list_work_session_audit', { p_work_session_id: workSessionId })
      return Array.isArray(rows) ? rows : []
    },
    async update({ workSessionId, expectedRevision, operation, changes = {}, reason }) {
      const rows = await call('admin_update_work_session_with_revision', {
        p_work_session_id: workSessionId,
        p_expected_revision: expectedRevision,
        p_operation: operation,
        p_changes: changes,
        p_reason: reason,
      })
      return Array.isArray(rows) ? rows[0] : rows
    },
  })
}

import { supabase } from '../../lib/supabaseClient'

const timeoutMs = 4_000

export class TimeTrackingError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

export function mapTimeTrackingError(error) {
  if (error instanceof TimeTrackingError) return error
  if (error?.code === '42501') return new TimeTrackingError('FORBIDDEN', 'No tienes una ficha de trabajador activa vinculada.')
  if (error?.code === '22023') return new TimeTrackingError('VALIDATION', 'No se pudo completar el fichaje solicitado.')
  if (error instanceof TypeError || /network|fetch|timeout/i.test(error?.message || '')) {
    return new TimeTrackingError('UNCERTAIN', 'No se pudo confirmar el resultado. Actualiza el estado antes de volver a fichar.')
  }
  return new TimeTrackingError('UNKNOWN', 'No se pudo completar la operación. Actualiza el estado e inténtalo de nuevo.')
}

async function withTimeout(request) {
  let id
  try {
    return await Promise.race([
      request,
      new Promise((_, reject) => { id = setTimeout(() => reject(new TypeError('Network timeout')), timeoutMs) }),
    ])
  } finally {
    clearTimeout(id)
  }
}

function requireClient(client) {
  if (!client?.rpc) throw new TimeTrackingError('CONFIGURATION', 'El servicio de fichaje no está disponible.')
  return client
}

export function createTimeTrackingService(client = supabase) {
  const api = requireClient(client)
  const call = async (name, args) => {
    try {
      const { data, error } = await withTimeout(api.rpc(name, args))
      if (error) throw error
      return data
    } catch (error) {
      throw mapTimeTrackingError(error)
    }
  }

  return Object.freeze({
    async load() {
      const [stateRows, historyRows] = await Promise.all([
        call('get_current_worker_time_tracking_state'),
        call('list_current_worker_work_sessions', { p_limit: 10 }),
      ])
      const state = Array.isArray(stateRows) ? stateRows[0] : stateRows
      if (!state?.worker_id) throw new TimeTrackingError('FORBIDDEN', 'No tienes una ficha de trabajador activa vinculada.')
      return { state, history: Array.isArray(historyRows) ? historyRows : [] }
    },
    async clockIn() { return call('clock_in_current_worker') },
    async clockOut() { return call('clock_out_current_worker') },
  })
}

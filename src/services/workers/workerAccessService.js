import { supabase } from '../../lib/supabaseClient'
import { WorkerDomainError } from './workerDomain.js'

function endpoint() {
  const base = import.meta.env.VITE_SUPABASE_URL
  if (!base) throw new WorkerDomainError('CONFIGURATION', 'El servicio de acceso no está configurado.')
  return `${base.replace(/\/$/, '')}/functions/v1/worker-access`
}

async function call(operation, payload) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const response = await fetch(endpoint(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ operation, ...payload }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const code = body.error === 'forbidden' ? 'FORBIDDEN' : body.error === 'already_linked' || body.error === 'account_exists' ? 'DUPLICATE' : body.error === 'pending_link' ? 'CONFLICT' : 'UNKNOWN'
    throw new WorkerDomainError(code, code === 'FORBIDDEN' ? 'No tienes permiso para habilitar el acceso.' : 'No se pudo habilitar el acceso del trabajador.')
  }
  return body
}

export function createWorkerAccessService() {
  if (!supabase) throw new WorkerDomainError('CONFIGURATION', 'Supabase no está configurado.')
  return Object.freeze({
    async enable({ workerId, expectedRevision, password, reason }) {
      return call('enable_access', { workerId, expectedRevision, password, reason })
    },
    async changePassword(password) {
      return call('change_password', { password })
    },
    async resetWorkerPassword(workerId, password) {
      return call('reset_worker_password', { workerId, password })
    },
    async signInWithDocument(document, password) {
      const response = await fetch(endpoint(), { method: 'POST', headers: { 'content-type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '' }, body: JSON.stringify({ operation: 'login', document, password }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.access_token || !body.refresh_token) throw new WorkerDomainError('FORBIDDEN', 'No se pudo iniciar sesión con esas credenciales.')
      await supabase.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token })
      return body
    },
  })
}


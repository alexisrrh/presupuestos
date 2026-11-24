// Narrow server-side worker access operations for the private E2E stack.
const authUrl = Deno.env.get('GOTRUE_INTERNAL_URL')!
const restUrl = Deno.env.get('REST_INTERNAL_URL')!
const jwtSecret = Deno.env.get('JWT_SECRET')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
const json = (value: unknown) => JSON.stringify(value)
const b64url = (value: string) => btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
async function serviceKey() {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(json({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(json({ role: 'service_role', iat: now, exp: now + 60 }))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(jwtSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(header + '.' + payload))
  return header + '.' + payload + '.' + b64url(String.fromCharCode(...new Uint8Array(signed)))
}
const response = (status: number, body: Record<string, unknown>) => new Response(json(body), { status, headers: { 'content-type': 'application/json' } })
const fail = (status: number, code: string) => response(status, { error: code })
const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
const documentValue = (value: unknown) => typeof value === 'string' ? value.toUpperCase().replace(/[\s.-]/g, '') : ''
const emailFor = (document: string) => document.toLowerCase() + '@workers.e2e.invalid'
async function authFetch(path: string, init: RequestInit = {}, token = '') {
  const key = await serviceKey(); const headers = new Headers(init.headers)
  headers.set('apikey', token ? anonKey : key); headers.set('authorization', 'Bearer ' + (token || key))
  return fetch(authUrl + path, { ...init, headers })
}
async function restFetch(path: string, init: RequestInit = {}, token = '') {
  const key = await serviceKey(); const headers = new Headers(init.headers)
  headers.set('apikey', anonKey || key); headers.set('authorization', 'Bearer ' + (token || key)); headers.set('content-type', 'application/json')
  return fetch(restUrl + path, { ...init, headers })
}
async function actorFor(token: string) { const result = await authFetch('/user', {}, token); return result.ok ? result.json() : null }
async function rows(path: string, token: string) { const result = await restFetch(path, {}, token); if (!result.ok) throw new Error('rest_' + result.status); return result.json() }
async function rpc(name: string, args: Record<string, unknown>, token: string) {
  const result = await restFetch('/rpc/' + name, { method: 'POST', body: json(args) }, token); const body = await result.json().catch(() => null)
  if (!result.ok) throw Object.assign(new Error('rpc_' + result.status), { status: result.status, body }); return body
}
async function isAdmin(actorId: string, organizationId: string, token: string) {
  const members = await rows('/organization_members?organization_id=eq.' + encodeURIComponent(organizationId) + '&user_id=eq.' + encodeURIComponent(actorId) + '&is_active=eq.true&select=role', token)
  return members.some((member: { role?: string }) => member.role === 'owner' || member.role === 'admin')
}
async function workerFor(workerId: string, token: string) {
  const workers = await rows('/workers?id=eq.' + encodeURIComponent(workerId) + '&select=id,organization_id,user_id,document_normalized,status,revision', token); return workers[0] || null
}
async function adminUsersByEmail(email: string) {
  const key = await serviceKey(); const result = await fetch(authUrl + '/admin/users?filter=' + encodeURIComponent(email), { headers: { apikey: key, authorization: 'Bearer ' + key } })
  if (!result.ok) throw new Error('auth_admin_' + result.status); const body = await result.json(); return Array.isArray(body?.users) ? body.users.filter((user: { email?: string }) => user.email === email) : []
}
async function createAuthUser(email: string, password: string, worker: { id: string, organization_id: string }, provisionId: string) {
  const key = await serviceKey(); const result = await fetch(authUrl + '/admin/users', { method: 'POST', headers: { apikey: key, authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: json({ email, password, email_confirm: true, app_metadata: { priteca_worker_access_provision_id: provisionId, priteca_worker_access_worker_id: worker.id, priteca_worker_access_organization_id: worker.organization_id } }) })
  const body = await result.json().catch(() => null); if (!result.ok) throw Object.assign(new Error('auth_create_' + result.status), { body }); return body
}
async function enableAccess(body: Record<string, unknown>, token: string, actor: { id: string }) {
  if (!uuid(body.workerId) || !Number.isInteger(body.expectedRevision) || typeof body.password !== 'string' || body.password.length < 8) return fail(422, 'invalid_request')
  const worker = await workerFor(body.workerId as string, token)
  if (!worker || worker.status !== 'active' || !(await isAdmin(actor.id, worker.organization_id, token))) return fail(403, 'forbidden')
  if (worker.user_id) return fail(409, 'already_linked')
  const provision = await rpc('begin_worker_access_provision', { p_worker_id: worker.id, p_expected_revision: body.expectedRevision }, token)
  const email = emailFor(worker.document_normalized); let user = (await adminUsersByEmail(email))[0]
  if (user && user.app_metadata?.priteca_worker_access_provision_id !== provision.id) return fail(409, 'account_exists')
  if (!user) user = await createAuthUser(email, body.password as string, worker, provision.id)
  try {
    const linked = await rpc('finalize_worker_access_provision', { p_provision_id: provision.id, p_expected_revision: body.expectedRevision, p_target_user_id: user.id, p_reason: typeof body.reason === 'string' ? body.reason : 'Habilitación de acceso de fichaje' }, token)
    return response(200, { worker: linked, status: 'linked' })
  } catch (_) { return response(409, { error: 'pending_link', provisionId: provision.id }) }
}
async function login(body: Record<string, unknown>) {
  const document = documentValue(body.document); if (!document || typeof body.password !== 'string') return fail(401, 'invalid_credentials')
  const users = await adminUsersByEmail(emailFor(document)); if (users.length !== 1) return fail(401, 'invalid_credentials')
  const result = await fetch(authUrl + '/token?grant_type=password', { method: 'POST', headers: { apikey: anonKey, 'content-type': 'application/json' }, body: json({ email: emailFor(document), password: body.password }) })
  if (!result.ok) return fail(401, 'invalid_credentials'); return new Response(await result.text(), { status: 200, headers: { 'content-type': 'application/json' } })
}
async function changePassword(body: Record<string, unknown>, token: string) {
  if (typeof body.password !== 'string' || body.password.length < 8) return fail(422, 'invalid_request')
  const actor = await actorFor(token); if (!actor?.id) return fail(401, 'unauthorized')
  const state = await rpc('get_current_worker_time_tracking_state', {}, token); if (!(Array.isArray(state) ? state[0] : state)?.worker_id) return fail(403, 'forbidden')
  const result = await authFetch('/user', { method: 'PUT', body: json({ password: body.password }), headers: { 'content-type': 'application/json' } }, token)
  return result.ok ? response(200, { status: 'changed' }) : fail(400, 'password_change_failed')
}
async function resetWorkerPassword(body: Record<string, unknown>, token: string, actor: { id: string }) {
  if (!uuid(body.workerId) || typeof body.password !== 'string' || body.password.length < 8) return fail(422, 'invalid_request')
  const worker = await workerFor(body.workerId as string, token)
  if (!worker?.user_id || worker.status !== 'active' || !(await isAdmin(actor.id, worker.organization_id, token))) return fail(403, 'forbidden')
  const targetMembership = await rows('/organization_members?organization_id=eq.' + encodeURIComponent(worker.organization_id) + '&user_id=eq.' + encodeURIComponent(worker.user_id) + '&is_active=eq.true&select=role', token)
  if (targetMembership.some((member: { role?: string }) => member.role === 'owner' || member.role === 'admin')) return fail(403, 'forbidden')
  const key = await serviceKey()
  const result = await fetch(authUrl + '/admin/users/' + encodeURIComponent(worker.user_id), { method: 'PUT', headers: { apikey: key, authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: json({ password: body.password }) })
  return result.ok ? response(200, { status: 'reset' }) : fail(400, 'password_reset_failed')
}
Deno.serve(async (request) => {
  if (request.method !== 'POST') return fail(405, 'method_not_allowed')
  let body: Record<string, unknown>; try { body = await request.json() } catch { return fail(400, 'invalid_json') }
  if (body.operation === 'login') return login(body)
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''; const actor = token ? await actorFor(token) : null
  if (!actor?.id) return fail(401, 'unauthorized')
  try {
    if (body.operation === 'enable_access') return await enableAccess(body, token, actor)
    if (body.operation === 'change_password') return await changePassword(body, token)
    if (body.operation === 'reset_worker_password') return await resetWorkerPassword(body, token, actor)
    return fail(400, 'unsupported_operation')
  } catch (_) { return fail(500, 'worker_access_failed') }
})

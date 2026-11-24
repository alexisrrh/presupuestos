// Run with Node 24+: node --test tests/functions/worker-access-hosted.mjs
// All environment values and fetch responses below are synthetic. No network calls.
import assert from 'node:assert/strict'
import { createHmac, webcrypto } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const source = await readFile(new URL('../../supabase/functions/worker-access/index.ts', import.meta.url), 'utf8')
const script = stripTypeScriptTypes(source, { mode: 'strip' })
const hostedEnv = {
  SUPABASE_URL: 'https://fixture-project.supabase.co/',
  SUPABASE_ANON_KEY: 'fixture-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-role-key',
}
const origin = 'https://priteca.com'
const actorId = '11111111-1111-4111-8111-111111111111'
const workerId = '22222222-2222-4222-8222-222222222222'
const organizationId = '33333333-3333-4333-8333-333333333333'
const provisionId = '44444444-4444-4444-8444-444444444444'
const targetUserId = '55555555-5555-4555-8555-555555555555'
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
})

function runtime(env = {}, responder) {
  let handler
  const requests = []
  const sandbox = {
    Deno: {
      env: { get: (name) => env[name] },
      serve: (callback) => { handler = callback },
    },
    Request,
    Response,
    Headers,
    TextEncoder,
    crypto: webcrypto,
    btoa,
    fetch: async (url, init = {}) => {
      const request = new Request(url, init)
      requests.push(request)
      if (!responder) throw new Error('Unexpected network request in isolated test')
      return responder(request)
    },
  }
  runInNewContext(script, sandbox, { filename: 'worker-access/index.ts' })
  return { handler, requests }
}

function request(body, token) {
  return new Request('https://fixture-project.supabase.co/functions/v1/worker-access', {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      apikey: 'fixture-browser-public-key',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

function assertCors(response) {
  assert.equal(response.headers.get('access-control-allow-origin'), '*')
  assert.equal(response.headers.get('access-control-allow-credentials'), null)
  for (const name of ['authorization', 'apikey', 'content-type']) {
    assert.ok(response.headers.get('access-control-allow-headers').split(', ').includes(name))
  }
}

test('preflight succeeds without secrets or Auth calls', async () => {
  const app = runtime()
  const response = await app.handler(new Request('https://fixture-project.supabase.co/functions/v1/worker-access', {
    method: 'OPTIONS',
    headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'apikey,content-type,authorization' },
  }))
  assert.equal(response.status, 204)
  assertCors(response)
  assert.equal(response.headers.get('access-control-allow-methods'), 'POST, OPTIONS')
  assert.equal(app.requests.length, 0)
})

test('protected operation without a JWT is denied before any service request', async () => {
  const app = runtime()
  const response = await app.handler(request({ operation: 'enable_access' }))
  assert.equal(response.status, 401)
  assertCors(response)
  assert.deepEqual(await response.json(), { error: 'unauthorized' })
  assert.equal(app.requests.length, 0)
})

test('unsupported method and malformed JSON errors include CORS', async () => {
  const app = runtime()
  const methodResponse = await app.handler(new Request('https://fixture.invalid', { headers: { origin } }))
  assert.equal(methodResponse.status, 405)
  assertCors(methodResponse)
  const jsonResponse = await app.handler(new Request('https://fixture.invalid', { method: 'POST', body: '{', headers: { origin } }))
  assert.equal(jsonResponse.status, 400)
  assertCors(jsonResponse)
  assert.equal(app.requests.length, 0)
})

test('hosted login uses managed Auth URL and returns only the user session', async () => {
  const app = runtime(hostedEnv, async (outbound) => {
    const url = new URL(outbound.url)
    assert.equal(url.origin, 'https://fixture-project.supabase.co')
    if (url.pathname === '/auth/v1/admin/users') {
      assert.equal(url.searchParams.get('filter'), '12345678z@workers.e2e.invalid')
      assert.equal(outbound.headers.get('apikey'), hostedEnv.SUPABASE_SERVICE_ROLE_KEY)
      assert.equal(outbound.headers.get('authorization'), `Bearer ${hostedEnv.SUPABASE_SERVICE_ROLE_KEY}`)
      return jsonResponse({ users: [{ email: '12345678z@workers.e2e.invalid' }] })
    }
    assert.equal(url.pathname, '/auth/v1/token')
    assert.equal(url.searchParams.get('grant_type'), 'password')
    assert.equal(outbound.headers.get('apikey'), hostedEnv.SUPABASE_ANON_KEY)
    assert.equal(outbound.headers.get('authorization'), null)
    assert.deepEqual(await outbound.json(), { email: '12345678z@workers.e2e.invalid', password: 'fixture password 9' })
    return jsonResponse({ access_token: 'fixture-user-session', refresh_token: 'fixture-refresh-token' })
  })
  const response = await app.handler(request({ operation: 'login', document: '12.345.678-z', password: 'fixture password 9' }))
  assert.equal(response.status, 200)
  assertCors(response)
  const body = await response.text()
  assert.deepEqual(JSON.parse(body), { access_token: 'fixture-user-session', refresh_token: 'fixture-refresh-token' })
  assert.ok(!body.includes(hostedEnv.SUPABASE_SERVICE_ROLE_KEY))
  assert.ok(!body.includes('fixture password 9'))
  assert.equal(app.requests.length, 2)
})

test('invalid credentials remain a generic 401 with CORS', async () => {
  const app = runtime(hostedEnv, async (outbound) => {
    if (new URL(outbound.url).pathname === '/auth/v1/admin/users') {
      return jsonResponse({ users: [{ email: '12345678z@workers.e2e.invalid' }] })
    }
    return jsonResponse({ error: 'upstream credential detail' }, 400)
  })
  const response = await app.handler(request({ operation: 'login', document: '12345678Z', password: 'wrong fixture password' }))
  assert.equal(response.status, 401)
  assertCors(response)
  assert.deepEqual(await response.json(), { error: 'invalid_credentials' })
})

test('hosted provisioning keeps actor JWT on every RLS read/RPC and service key only on Auth admin', async () => {
  const actorToken = 'fixture-actor-session'
  const worker = { id: workerId, organization_id: organizationId, user_id: null, document_normalized: '12345678Z', status: 'active', revision: 3 }
  const app = runtime(hostedEnv, async (outbound) => {
    const url = new URL(outbound.url)
    assert.equal(url.origin, 'https://fixture-project.supabase.co')
    if (url.pathname.startsWith('/auth/v1/admin/users')) {
      assert.equal(outbound.headers.get('apikey'), hostedEnv.SUPABASE_SERVICE_ROLE_KEY)
      assert.equal(outbound.headers.get('authorization'), `Bearer ${hostedEnv.SUPABASE_SERVICE_ROLE_KEY}`)
      if (outbound.method === 'GET') return jsonResponse({ users: [] })
      const payload = await outbound.json()
      assert.equal(payload.app_metadata.priteca_worker_access_provision_id, provisionId)
      assert.equal(payload.app_metadata.priteca_worker_access_worker_id, workerId)
      assert.equal(payload.app_metadata.priteca_worker_access_organization_id, organizationId)
      return jsonResponse({ id: targetUserId, email: payload.email, app_metadata: payload.app_metadata })
    }
    assert.equal(outbound.headers.get('apikey'), hostedEnv.SUPABASE_ANON_KEY)
    assert.equal(outbound.headers.get('authorization'), `Bearer ${actorToken}`)
    switch (url.pathname) {
      case '/auth/v1/user': return jsonResponse({ id: actorId })
      case '/rest/v1/workers': return jsonResponse([worker])
      case '/rest/v1/organization_members': return jsonResponse([{ role: 'owner' }])
      case '/rest/v1/rpc/begin_worker_access_provision': return jsonResponse({ id: provisionId })
      case '/rest/v1/rpc/finalize_worker_access_provision': {
        const payload = await outbound.json()
        assert.equal(payload.p_target_user_id, targetUserId)
        assert.equal(payload.p_expected_revision, 3)
        return jsonResponse({ ...worker, user_id: targetUserId, revision: 4 })
      }
      default: throw new Error(`Unexpected fixture route: ${url.pathname}`)
    }
  })
  const response = await app.handler(request({ operation: 'enable_access', workerId, expectedRevision: 3, password: 'fixture password 9', reason: 'Fixture managed deployment' }, actorToken))
  assert.equal(response.status, 200)
  assertCors(response)
  const body = await response.text()
  assert.equal(JSON.parse(body).status, 'linked')
  assert.equal(JSON.parse(body).worker.user_id, targetUserId)
  assert.ok(!body.includes(hostedEnv.SUPABASE_SERVICE_ROLE_KEY))
  assert.ok(!body.includes('fixture password 9'))
  assert.equal(app.requests.length, 7)
})

test('invalid actor JWT is rejected before querying workers or invoking admin Auth', async () => {
  const app = runtime(hostedEnv, async (outbound) => {
    assert.equal(new URL(outbound.url).pathname, '/auth/v1/user')
    assert.equal(outbound.headers.get('authorization'), 'Bearer invalid-fixture-session')
    return jsonResponse({ error: 'invalid user token' }, 401)
  })
  const response = await app.handler(request({ operation: 'reset_worker_password', workerId, password: 'fixture password 9' }, 'invalid-fixture-session'))
  assert.equal(response.status, 401)
  assertCors(response)
  assert.deepEqual(await response.json(), { error: 'unauthorized' })
  assert.equal(app.requests.length, 1)
})

test('login and actor network failures are contained without leaking server details', async () => {
  for (const [payload, token] of [
    [{ operation: 'login', document: '12345678Z', password: 'fixture password 9' }, undefined],
    [{ operation: 'change_password', password: 'fixture password 9' }, 'fixture-actor-session'],
  ]) {
    const app = runtime(hostedEnv, async () => { throw new Error(`Do not disclose ${hostedEnv.SUPABASE_SERVICE_ROLE_KEY}`) })
    const response = await app.handler(request(payload, token))
    assert.equal(response.status, 500)
    assertCors(response)
    assert.deepEqual(await response.json(), { error: 'worker_access_failed' })
  }
})

test('private E2E fallback signs a short lived service JWT only with explicit internal configuration', async () => {
  const env = {
    GOTRUE_INTERNAL_URL: 'http://auth:9999',
    REST_INTERNAL_URL: 'http://rest:3000',
    JWT_SECRET: 'synthetic-local-test-secret-not-a-real-credential',
    SUPABASE_ANON_KEY: 'fixture-local-anon-key',
  }
  const app = runtime(env, async (outbound) => {
    assert.equal(new URL(outbound.url).origin, 'http://auth:9999')
    const key = outbound.headers.get('apikey')
    assert.equal(outbound.headers.get('authorization'), `Bearer ${key}`)
    const [header, payload, signature] = key.split('.')
    assert.equal(createHmac('sha256', env.JWT_SECRET).update(`${header}.${payload}`).digest('base64url'), signature)
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    assert.equal(claims.role, 'service_role')
    assert.equal(claims.exp - claims.iat, 60)
    return jsonResponse({ users: [] })
  })
  const response = await app.handler(request({ operation: 'login', document: '12345678Z', password: 'fixture password 9' }))
  assert.equal(response.status, 401)
  assertCors(response)
  assert.equal(app.requests.length, 1)
})

test('missing managed key cannot silently mint an E2E token without both internal URLs', async () => {
  const app = runtime({ SUPABASE_URL: hostedEnv.SUPABASE_URL, JWT_SECRET: 'synthetic-unused-secret' })
  const response = await app.handler(request({ operation: 'login', document: '12345678Z', password: 'fixture password 9' }))
  assert.equal(response.status, 500)
  assertCors(response)
  assert.deepEqual(await response.json(), { error: 'worker_access_failed' })
  assert.equal(app.requests.length, 0)
})

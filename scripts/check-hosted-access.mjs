import { createHash } from 'node:crypto'
import process from 'node:process'

// Non-mutating checks for the reviewed PRITECA deployment. No real account,
// password, session, worker, or attendance fixture is used. The public API key
// is read from the public build in memory and never printed or saved.
const siteUrl = 'https://priteca.com/'
const apiUrl = 'https://yugpxenxjpjicxyznlxz.supabase.co'
const edgeUrl = `${apiUrl}/functions/v1/worker-access`
const origin = new URL(siteUrl).origin

async function request(url, options = {}) {
  return fetch(url, {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(25_000),
  })
}

async function publicBuildConfiguration() {
  const page = await request(siteUrl)
  if (page.status !== 200) throw new Error('public_page_unavailable')
  const html = await page.text()
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
  const source = scripts.find(([, path]) => path.startsWith('/assets/') && path.endsWith('.js'))?.[1]
  if (!source) throw new Error('public_bundle_not_found')
  const bundleUrl = new URL(source, siteUrl)
  if (bundleUrl.origin !== origin) throw new Error('public_bundle_wrong_origin')
  const result = await request(bundleUrl)
  if (result.status !== 200) throw new Error('public_bundle_unavailable')
  const bundle = await result.text()
  const publicKey = bundle.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*:\s*([`"'])(sb_publishable_[A-Za-z0-9_-]+)\1/)?.[2]
  const projectUrl = bundle.match(/VITE_SUPABASE_URL\s*:\s*([`"'])(https:\/\/[^`"']+)\1/)?.[2]
  if (!publicKey || projectUrl !== apiUrl) throw new Error('public_bundle_configuration_mismatch')
  return {
    publicKey,
    evidence: {
      page_status: page.status,
      bundle_status: result.status,
      bundle_url: bundleUrl.href,
      bundle_sha256: createHash('sha256').update(bundle).digest('hex'),
      expected_project: true,
      public_key_kind: 'publishable',
    },
  }
}

function cors(result) {
  const allowedOrigin = result.headers.get('access-control-allow-origin')
  return allowedOrigin === '*' || allowedOrigin === origin
}

async function check(name, url, options, assess) {
  try {
    const result = await request(url, options)
    const body = await result.json().catch(() => null)
    return { name, http_status: result.status, ...assess(result, body) }
  } catch (error) {
    return {
      name,
      http_status: null,
      pass: false,
      transport_error: error?.name === 'TimeoutError' ? 'timeout' : 'request_failed',
    }
  }
}

async function main() {
  const { publicKey, evidence } = await publicBuildConfiguration()
  const headers = { apikey: publicKey, origin, 'content-type': 'application/json' }
  const protectedBody = JSON.stringify({ operation: 'enable_access' })
  const results = await Promise.all([
    check('edge_preflight', edgeUrl, {
      method: 'OPTIONS',
      headers: {
        origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'apikey, authorization, content-type',
      },
    }, (result) => {
      const methods = result.headers.get('access-control-allow-methods') || ''
      const allowedHeaders = (result.headers.get('access-control-allow-headers') || '').toLowerCase()
      const headersAllowed = ['apikey', 'authorization', 'content-type'].every((name) => allowedHeaders.includes(name))
      return {
        cors_origin_allowed: cors(result),
        cors_requested_headers_allowed: headersAllowed,
        cors_post_allowed: methods.includes('POST'),
        pass: result.status === 204 && cors(result) && headersAllowed && methods.includes('POST'),
      }
    }),
    check('edge_no_session', edgeUrl, { method: 'POST', headers, body: protectedBody }, (result, body) => ({
      unauthorized: body?.error === 'unauthorized',
      cors_origin_allowed: cors(result),
      pass: result.status === 401 && body?.error === 'unauthorized' && cors(result),
    })),
    check('edge_invalid_session', edgeUrl, {
      method: 'POST',
      headers: { ...headers, authorization: 'Bearer PRITECA_DEPLOY_CHECK_NOT_A_JWT' },
      body: protectedBody,
    }, (result, body) => ({
      unauthorized: body?.error === 'unauthorized',
      cors_origin_allowed: cors(result),
      pass: result.status === 401 && body?.error === 'unauthorized' && cors(result),
    })),
    check('edge_nonexistent_worker_login', edgeUrl, {
      method: 'POST', headers,
      body: JSON.stringify({
        operation: 'login',
        document: 'PRITECADEPLOYCHECK',
        password: 'SYNTHETIC-INVALID-DEPLOY-CHECK-NOT-A-REAL-PASSWORD',
      }),
    }, (result, body) => ({
      generic_invalid_credentials: body?.error === 'invalid_credentials',
      cors_origin_allowed: cors(result),
      pass: result.status === 401 && body?.error === 'invalid_credentials' && cors(result),
    })),
    check('auth_settings', `${apiUrl}/auth/v1/settings`, {
      headers: { apikey: publicKey },
    }, (result, body) => ({
      email_provider_enabled: body?.external?.email === true,
      pass: result.status === 200 && body?.external?.email === true,
    })),
    check('clock_in_without_session', `${apiUrl}/rest/v1/rpc/clock_in_current_worker`, {
      method: 'POST', headers, body: '{}',
    }, (result, body) => ({
      permission_denied: body?.code === '42501',
      pass: [401, 403].includes(result.status) && body?.code === '42501',
    })),
  ])
  const report = {
    checked_at: new Date().toISOString(),
    site_url: siteUrl,
    edge_url: edgeUrl,
    checks_are_unauthenticated: true,
    public_build: evidence,
    results,
    pass: results.every((result) => result.pass),
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (!report.pass) process.exitCode = 1
}

main().catch((error) => {
  const allowed = new Set([
    'public_page_unavailable', 'public_bundle_not_found', 'public_bundle_wrong_origin',
    'public_bundle_unavailable', 'public_bundle_configuration_mismatch',
  ])
  process.stdout.write(`${JSON.stringify({ pass: false, error: allowed.has(error?.message) ? error.message : 'public_configuration_request_failed' })}\n`)
  process.exitCode = 1
})

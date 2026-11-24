import assert from 'node:assert/strict'
import { createMemoryWorkerRepository } from '../../src/services/workers/memoryWorkerRepository.js'
import { validateSpanishDocument, normalizeSpanishDocument } from '../../src/utils/spanishDocument.js'
import { toWorkerForm, validateWorkerInput, WorkerDomainError } from '../../src/services/workers/workerDomain.js'
import { createLocalDemoGuard } from '../../config/localDemoGuard.js'

const fixture = (overrides = {}) => ({ employeeCode: 'PR-001', firstName: 'Alicia', lastName: 'Ejemplo', documentType: 'DNI', document: '12345678Z', email: '', phone: '', startDate: '', position: '', status: 'draft', ...overrides })
function setup() {
  let context = { userId: 'admin-a', organizationId: 'a', role: 'admin', isActive: true, displayName: 'Admin de prueba' }
  let sequence = 0
  const repo = createMemoryWorkerRepository([], { getContext: () => context, now: () => '2026-11-12T10:00:00.000Z', generateId: () => `worker-${++sequence}` })
  return { repo, setContext: (next) => { context = { ...context, ...next } }, create: (data = fixture(), key = `request-${++sequence}`) => repo.create(data, { requestId: key }) }
}
const rejectsCode = (promise, code) => assert.rejects(promise, (error) => error instanceof WorkerDomainError && error.code === code)
export const domainCases = [
  ['normaliza DNI/NIE y valida ejemplos oficiales', () => {
    assert.equal(normalizeSpanishDocument(' 12345678-z '), '12345678Z')
    assert.equal(validateSpanishDocument('DNI', '12345678Z').valid, true)
    assert.equal(validateSpanishDocument('NIE', 'X-1234567-L').valid, true)
    assert.equal(validateSpanishDocument('NIE', 'Y1234567X').valid, true)
    assert.equal(validateSpanishDocument('NIE', 'Z1234567R').valid, true)
  }],
  ['rechaza letras, tipos y entradas no textuales sin TypeError', () => {
    for (const type of [null, 'PASSPORT', '', undefined, 42, 'dni']) assert.equal(validateSpanishDocument(type, '12345678Z').valid, false)
    for (const value of [null, undefined, {}, [], 12345678, true, '12345678A', '<script>']) assert.equal(validateSpanishDocument('DNI', value).valid, false)
    assert.equal(validateSpanishDocument('NIE', '12345678Z').valid, false)
    assert.equal(validateSpanishDocument('DNI', 'X1234567L').valid, false)
  }],
  ['proyecta ficha a DTO sin campos protegidos', () => {
    const input = toWorkerForm({ ...fixture(), id: 'w', organizationId: 'a', userId: 'u', role: 'owner', history: [] })
    assert.deepEqual(input, fixture())
  }],
  ['valida fechas reales y contactos opcionales', () => {
    assert.equal(validateWorkerInput(fixture({ startDate: '2024-02-29', email: 'demo@example.invalid', phone: '+34 600 123 456' })).startDate, '2024-02-29')
    for (const startDate of ['2025-02-29', '2026-02-30', '2026-13-01', '1800-01-01', 'abc']) assert.throws(() => validateWorkerInput(fixture({ startDate })), /Revisa/)
    for (const changes of [{ email: 'bad' }, { phone: 'abc' }, { firstName: '' }, { lastName: null }, { status: 'archived' }, { document: 'bad' }]) assert.throws(() => validateWorkerInput(fixture(changes)), /Revisa/)
  }],
  ['rechaza payload no objeto y propiedades extra', () => {
    for (const input of [null, [], 'abc', new Date()]) assert.throws(() => validateWorkerInput(input))
    for (const key of ['id', 'organizationId', 'userId', 'role', 'history', 'revision', 'archivedAt']) assert.throws(() => validateWorkerInput({ ...fixture(), [key]: 'forged' }), /protegidos/)
  }],
]
export const repositoryCases = [
  ['edita DTO derivado del detalle sin perder ID, empresa o historial', async () => {
    const { repo, create } = setup(); const original = await create()
    const result = await repo.update(original.id, { ...toWorkerForm(original), firstName: 'Alicia Corregida' }, { expectedRevision: original.revision })
    assert.equal(result.firstName, 'Alicia Corregida'); assert.equal(result.id, original.id); assert.equal(result.organizationId, 'a'); assert.equal(result.history.length, 2)
    assert.deepEqual(result.history[1].changes, [{ field: 'firstName', before: 'Alicia', after: 'Alicia Corregida' }])
    assert.equal(result.history[1].actorId, 'admin-a')
  }],
  ['actualizar un ID inexistente nunca crea', async () => {
    const { repo } = setup(); await rejectsCode(repo.update('missing', fixture(), { expectedRevision: 1 }), 'NOT_FOUND'); assert.deepEqual(await repo.list(), [])
  }],
  ['rechaza lectura, edicion, archivo y recuperacion de otra empresa', async () => {
    const { repo, create, setContext } = setup(); const a = await create(); setContext({ organizationId: 'b' }); const b = await create()
    assert.deepEqual((await repo.list()).map((w) => w.id), [b.id])
    await rejectsCode(repo.get(a.id), 'NOT_FOUND')
    await rejectsCode(repo.update(a.id, fixture(), { expectedRevision: 1 }), 'NOT_FOUND')
    await rejectsCode(repo.archive(a.id, 'Archivo ajeno', { expectedRevision: 1 }), 'NOT_FOUND')
    await rejectsCode(repo.restore(a.id, 'Recuperacion ajena', { expectedRevision: 1 }), 'NOT_FOUND')
    setContext({ organizationId: 'a' }); assert.equal((await repo.get(a.id)).status, 'draft')
  }],
  ['misma identidad documental permitida solo en empresas distintas', async () => {
    const { repo, create, setContext } = setup(); await create(); setContext({ organizationId: 'b' }); await create(); assert.equal((await repo.list()).length, 1)
  }],
  ['duplicados de documento y codigo incluyen archivadas', async () => {
    const { repo, create } = setup(); const w = await create(); await repo.archive(w.id, 'Fin prueba', { expectedRevision: 1 })
    await rejectsCode(create(fixture({ employeeCode: 'PR-002' })), 'DUPLICATE')
    await rejectsCode(create(fixture({ documentType: 'NIE', document: 'X1234567L', employeeCode: ' pr-001 ' })), 'DUPLICATE')
  }],
  ['doble envio simultaneo con mismo requestId devuelve una unica ficha', async () => {
    const { repo, create } = setup(); const [one, two] = await Promise.all([create(fixture(), 'same'), create(fixture(), 'same')])
    assert.equal(one.id, two.id); assert.equal((await repo.list()).length, 1)
  }],
  ['no acepta reutilizar requestId con otro payload', async () => {
    const { create } = setup(); await create(fixture(), 'same'); await rejectsCode(create(fixture({ firstName: 'Otro' }), 'same'), 'CONFLICT')
  }],
  ['doble envio con dos claves rechaza duplicado', async () => {
    const { repo, create } = setup(); const results = await Promise.allSettled([create(), create()]); assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1); assert.equal((await repo.list()).length, 1)
  }],
  ['crear exige requestId', async () => { const { repo } = setup(); await rejectsCode(repo.create(fixture()), 'INVALID_REQUEST') }],
  ['rechaza documentos invalidos tambien desde el servicio', async () => {
    const { create, repo } = setup(); await rejectsCode(create(fixture({ document: 'invalid', firstName: '', email: 'bad' })), 'VALIDATION'); assert.equal((await repo.list()).length, 0)
  }],
  ['no permite inyectar organizacion, rol o historial', async () => {
    const { repo, create } = setup(); const w = await create()
    for (const field of ['organizationId', 'role', 'history', 'userId']) await rejectsCode(repo.update(w.id, { ...fixture(), [field]: 'forged' }, { expectedRevision: 1 }), 'FORBIDDEN_FIELDS')
    assert.equal((await repo.get(w.id)).revision, 1)
  }],
  ['rechaza version obsoleta sin pisar cambios', async () => {
    const { repo, create } = setup(); const w = await create(); await repo.update(w.id, fixture({ position: 'Nuevo puesto' }), { expectedRevision: 1 })
    await rejectsCode(repo.update(w.id, fixture({ firstName: 'Cambio tardio' }), { expectedRevision: 1 }), 'CONFLICT')
    assert.equal((await repo.get(w.id)).position, 'Nuevo puesto')
  }],
  ['sin diferencias no crea un evento ficticio', async () => {
    const { repo, create } = setup(); const w = await create(); const result = await repo.update(w.id, fixture(), { expectedRevision: 1 }); assert.equal(result.history.length, 1); assert.equal(result.revision, 1)
  }],
  ['archivo exige motivo y lo conserva con actor', async () => {
    const { repo, create } = setup(); const w = await create()
    for (const reason of ['', ' ', null, 'ab']) await rejectsCode(repo.archive(w.id, reason, { expectedRevision: 1 }), 'REASON_REQUIRED')
    assert.equal((await repo.get(w.id)).status, 'draft')
    const archived = await repo.archive(w.id, ' Fin de prueba ', { expectedRevision: 1 }); assert.equal(archived.archivedReason, 'Fin de prueba'); assert.equal(archived.history[1].actorId, 'admin-a')
  }],
  ['recupera un borrador como borrador y una activa como activa', async () => {
    for (const status of ['draft', 'active']) {
      const { repo, create } = setup(); const w = await create(fixture({ status })); const a = await repo.archive(w.id, 'Fin de prueba', { expectedRevision: 1 })
      const r = await repo.restore(w.id, 'Recuperar prueba', { expectedRevision: a.revision }); assert.equal(r.status, status); assert.equal(r.id, w.id); assert.equal(r.history.length, 3)
    }
  }],
  ['no se edita una ficha archivada por via general', async () => {
    const { repo, create } = setup(); const w = await create(); const a = await repo.archive(w.id, 'Fin de prueba', { expectedRevision: 1 }); await rejectsCode(repo.update(w.id, fixture(), { expectedRevision: a.revision }), 'ARCHIVED')
  }],
  ['el historial oculta documentos y contactos al editar', async () => {
    const { repo, create } = setup(); const w = await create(); const changed = await repo.update(w.id, fixture({ documentType: 'NIE', document: 'X1234567L', email: 'demo@example.invalid', phone: '+34 600 123 456' }), { expectedRevision: 1 })
    const history = JSON.stringify(changed.history); for (const sensitive of ['12345678Z', 'X1234567L', 'demo@example.invalid', '+34 600 123 456']) assert.equal(history.includes(sensitive), false)
  }],
  ['resultados y semillas se clonan defensivamente', async () => {
    const { repo, create } = setup(); const w = await create(); w.history.push({ action: 'forged' }); const rows = await repo.list(); rows[0].firstName = 'forged'; rows[0].history[0].actorId = 'forged'
    const fresh = await repo.get(w.id); assert.equal(fresh.firstName, 'Alicia'); assert.equal(fresh.history.length, 1); assert.equal(fresh.history[0].actorId, 'admin-a')
  }],
  ['autorizacion se vuelve a evaluar en cada operacion', async () => {
    const { repo, create, setContext } = setup(); const w = await create(); setContext({ isActive: false }); await rejectsCode(repo.get(w.id), 'FORBIDDEN'); await rejectsCode(repo.list(), 'FORBIDDEN')
  }],
  ['sin proveedor de contexto se deniega', async () => { await rejectsCode(createMemoryWorkerRepository().list(), 'FORBIDDEN') }],
  ...['employee', 'member', 'unknown', '', null].map((role) => [`deniega todas las operaciones al rol ${role}`, async () => {
    const { repo, create, setContext } = setup(); const w = await create(); setContext({ role })
    for (const call of [() => repo.list(), () => repo.get(w.id), () => create(), () => repo.update(w.id, fixture(), { expectedRevision: 1 }), () => repo.archive(w.id, 'Prueba', { expectedRevision: 1 }), () => repo.restore(w.id, 'Prueba', { expectedRevision: 1 })]) await rejectsCode(call(), 'FORBIDDEN')
  }]),
  ['owner activo puede gestionar su empresa', async () => { const { create, setContext } = setup(); setContext({ role: 'owner' }); assert.equal((await create()).organizationId, 'a') }],
]
export const guardCases = [
  ['rechaza build y preview con modo local-demo', () => {
    assert.throws(() => createLocalDemoGuard({ command: 'build', mode: 'local-demo' }), /no se puede compilar/)
    assert.throws(() => createLocalDemoGuard({ command: 'serve', mode: 'local-demo', isPreview: true }), /no se puede compilar/)
  }],
  ['exige loopback y bloquea imports demo durante build', () => {
    const plugin = createLocalDemoGuard({ command: 'serve', mode: 'local-demo' })
    assert.throws(() => plugin.configResolved({ server: { host: '0.0.0.0' } }), /loopback/)
    plugin.configResolved({ server: { host: '127.0.0.1' } })
    const build = createLocalDemoGuard({ command: 'build', mode: 'production' })
    for (const id of ['/repo/src/demo/main.jsx', '/repo/demo.html', '/repo/src/data/demoWorkers.js', '/repo/src/services/workers/memoryWorkerRepository.js']) assert.throws(() => build.resolveId(id), /no puede incluir/)
    assert.equal(build.resolveId('/repo/src/App.jsx'), null)
  }],
  ['inspecciona modulo demo en un artefacto de build', () => {
    const plugin = createLocalDemoGuard({ command: 'build', mode: 'production' })
    assert.throws(() => plugin.generateBundle({}, { js: { fileName: 'assets/index.js', moduleIds: ['/repo/src/demo/main.jsx'] } }), /demostraci/)
    plugin.generateBundle({}, { js: { fileName: 'assets/index.js', moduleIds: ['/repo/src/App.jsx'] } })
  }],
  ['servidor normal niega demo y demo redirige raiz y bloquea app real', () => {
    function request(env, url) {
      let middleware; const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v }, end() { this.ended = true } }
      createLocalDemoGuard(env).configureServer({ middlewares: { use(fn) { middleware = fn } } })
      middleware({ url }, res, () => { res.next = true }); return res
    }
    assert.equal(request({ command: 'serve', mode: 'development' }, '/demo.html').statusCode, 404)
    assert.equal(request({ command: 'serve', mode: 'local-demo' }, '/index.html').statusCode, 403)
    const root = request({ command: 'serve', mode: 'local-demo' }, '/'); assert.equal(root.statusCode, 302); assert.equal(root.headers.Location, '/demo.html')
    const allowed = request({ command: 'serve', mode: 'local-demo' }, '/src/demo/main.jsx'); assert.equal(allowed.next, true); assert.match(allowed.headers['Content-Security-Policy'], /connect-src 'self'/)
  }],
]

import { WorkerDomainError, validateWorkerInput, validateArchiveReason, workerChanges } from './workerDomain.js'

const clone = (value) => structuredClone(value)
/** LOCAL DEMO ONLY. The trusted context provider is not a replacement for server auth/RLS. */
export function createMemoryWorkerRepository(seed = [], {
  getContext = () => null, now = () => new Date().toISOString(), generateId = () => crypto.randomUUID(),
} = {}) {
  let workers = clone(seed).map((worker) => ({ ...worker, revision: worker.revision || 1, history: worker.history || [] }))
  const requests = new Map()
  function authorize() {
    const context = getContext()
    if (!context || context.isActive !== true || !['owner', 'admin'].includes(context.role) ||
        typeof context.organizationId !== 'string' || !context.organizationId.trim() ||
        typeof context.userId !== 'string' || !context.userId.trim()) {
      throw new WorkerDomainError('FORBIDDEN', 'No tienes permiso para gestionar trabajadores.')
    }
    return { organizationId: context.organizationId, userId: context.userId, displayName: context.displayName || 'Administración' }
  }
  function find(id, context) {
    const worker = workers.find((w) => w.id === id && w.organizationId === context.organizationId)
    if (!worker) throw new WorkerDomainError('NOT_FOUND', 'Ficha inexistente o no accesible.')
    return worker
  }
  function checkRevision(worker, expectedRevision) {
    if (!Number.isInteger(expectedRevision) || expectedRevision !== worker.revision) {
      throw new WorkerDomainError('CONFLICT', 'La ficha ha cambiado. Vuelve a abrirla antes de guardar; tus cambios no se han sobrescrito.')
    }
  }
  function checkDuplicates(data, context, excludingId) {
    const rows = workers.filter((w) => w.organizationId === context.organizationId && w.id !== excludingId)
    if (rows.some((w) => w.document === data.document)) {
      throw new WorkerDomainError('DUPLICATE', 'Ya existe una ficha con este documento, incluso archivada.', { document: 'Ya existe en esta empresa, también entre las archivadas.' })
    }
    if (rows.some((w) => w.employeeCode === data.employeeCode)) {
      throw new WorkerDomainError('DUPLICATE', 'Ya existe una ficha con este código.', { employeeCode: 'El código ya está utilizado.' })
    }
  }
  function event(context, action, changes = [], reason = '') {
    return { at: now(), actorId: context.userId, actorLabel: context.displayName, action, changes, ...(reason ? { reason } : {}) }
  }
  function replace(next) {
    workers = workers.map((w) => w.id === next.id && w.organizationId === next.organizationId ? next : w)
    return clone(next)
  }
  return {
    async list() {
      const context = authorize()
      return clone(workers.filter((w) => w.organizationId === context.organizationId))
    },
    async get(id) { const context = authorize(); return clone(find(id, context)) },
    async create(input, { requestId } = {}) {
      const context = authorize()
      const data = validateWorkerInput(input)
      if (typeof requestId !== 'string' || !requestId.trim() || requestId.length > 128) {
        throw new WorkerDomainError('INVALID_REQUEST', 'Falta un identificador de petición válido.')
      }
      const key = JSON.stringify([context.organizationId, context.userId, requestId])
      const signature = JSON.stringify(data)
      const prior = requests.get(key)
      if (prior) {
        if (prior.signature !== signature) throw new WorkerDomainError('CONFLICT', 'No reutilices una petición con datos diferentes.')
        return clone(find(prior.id, context))
      }
      checkDuplicates(data, context)
      const at = now()
      const next = { ...data, id: generateId(), organizationId: context.organizationId,
        createdAt: at, updatedAt: at, revision: 1, history: [event(context, 'created', [{ field: 'status', before: '', after: data.status }])] }
      if (workers.some((w) => w.id === next.id)) throw new WorkerDomainError('CONFLICT', 'El identificador generado ya existe.')
      workers.push(next)
      requests.set(key, { signature, id: next.id })
      return clone(next)
    },
    async update(id, input, { expectedRevision } = {}) {
      const context = authorize()
      const existing = find(id, context)
      checkRevision(existing, expectedRevision)
      if (existing.status === 'archived') throw new WorkerDomainError('ARCHIVED', 'Recupera la ficha antes de editarla.')
      const data = validateWorkerInput(input)
      checkDuplicates(data, context, existing.id)
      const changes = workerChanges(existing, data)
      if (!changes.length) return clone(existing)
      return replace({ ...existing, ...data, updatedAt: now(), revision: existing.revision + 1,
        history: [...existing.history, event(context, 'edited', changes)] })
    },
    async archive(id, reason, { expectedRevision } = {}) {
      const context = authorize()
      const existing = find(id, context)
      checkRevision(existing, expectedRevision)
      const normalizedReason = validateArchiveReason(reason)
      if (!['draft', 'active'].includes(existing.status)) throw new WorkerDomainError('INVALID_STATE', 'La ficha ya está archivada.')
      const at = now()
      return replace({ ...existing, status: 'archived', statusBeforeArchive: existing.status,
        archivedAt: at, archivedReason: normalizedReason, updatedAt: at, revision: existing.revision + 1,
        history: [...existing.history, event(context, 'archived', [{ field: 'status', before: existing.status, after: 'archived' }], normalizedReason)] })
    },
    async restore(id, reason, { expectedRevision } = {}) {
      const context = authorize()
      const existing = find(id, context)
      checkRevision(existing, expectedRevision)
      const normalizedReason = validateArchiveReason(reason)
      if (existing.status !== 'archived' || !['draft', 'active'].includes(existing.statusBeforeArchive)) {
        throw new WorkerDomainError('INVALID_STATE', 'No se conoce un estado anterior recuperable.')
      }
      const status = existing.statusBeforeArchive
      return replace({ ...existing, status, statusBeforeArchive: null, archivedAt: null, archivedReason: '',
        updatedAt: now(), revision: existing.revision + 1,
        history: [...existing.history, event(context, 'restored', [{ field: 'status', before: 'archived', after: status }], normalizedReason)] })
    },
  }
}

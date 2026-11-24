import { WorkerDomainError, validateArchiveReason, validateWorkerInput } from './workerDomain.js'

const workerFields = 'id, organization_id, user_id, employee_code, document_type, document_normalized, first_name, last_name, email, phone, start_date, position, status, archived_at, archived_reason, created_at, updated_at, revision'
const auditFields = 'id, organization_id, worker_id, actor_id, action, reason, occurred_at'

const editableFields = Object.freeze({
  employeeCode: 'employee_code',
  documentType: 'document_type',
  document: 'document_normalized',
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  phone: 'phone',
  startDate: 'start_date',
  position: 'position',
})

const requestTimeoutMs = 4_000

async function awaitRequest(request) {
  let timeoutId
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new TypeError('Network request timed out.')), requestTimeoutMs)
      }),
    ])
  } catch (error) {
    throw toWorkerRepositoryError(error)
  } finally {
    clearTimeout(timeoutId)
  }
}

function requireOrganizationId(organizationId) {
  if (typeof organizationId !== 'string' || !organizationId.trim()) {
    throw new WorkerDomainError('FORBIDDEN', 'No hay una organización autorizada para gestionar trabajadores.')
  }
  return organizationId
}

function nullable(value) {
  return value || null
}

export function mapWorkerRow(row) {
  if (!row || typeof row !== 'object') {
    throw new WorkerDomainError('INVALID_RESPONSE', 'La respuesta de la ficha no es válida.')
  }

  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    employeeCode: row.employee_code,
    documentType: row.document_type,
    document: row.document_normalized,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email ?? '',
    phone: row.phone ?? '',
    startDate: row.start_date ?? '',
    position: row.position ?? '',
    status: row.status,
    archivedAt: row.archived_at,
    archivedReason: row.archived_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revision: row.revision,
    history: Array.isArray(row.history) ? row.history : [],
  }
}

export function mapWorkerAuditRow(row) {
  return {
    id: row.id,
    at: row.occurred_at,
    actorId: row.actor_id,
    action: row.action === 'updated' ? 'edited' : row.action === 'recovered' ? 'restored' : row.action,
    reason: row.reason || '',
    changes: [],
  }
}

export function toWorkerInsert(input, organizationId) {
  const data = validateWorkerInput(input)
  return {
    organization_id: requireOrganizationId(organizationId),
    employee_code: data.employeeCode,
    document_type: data.documentType,
    document_normalized: data.document,
    first_name: data.firstName,
    last_name: data.lastName,
    email: nullable(data.email),
    phone: nullable(data.phone),
    start_date: nullable(data.startDate),
    position: nullable(data.position),
    status: data.status,
  }
}

// The client always projects a closed patch. It never forwards status, identity,
// organisation, revision, archive metadata, or unrecognised form state to the RPC.
export function toWorkerPatch(currentWorker, input) {
  const data = validateWorkerInput(input)
  const patch = {}
  for (const [formField, databaseField] of Object.entries(editableFields)) {
    const next = data[formField]
    const current = currentWorker[formField]
    if (next !== current) patch[databaseField] = nullable(next)
  }
  return patch
}

export function toWorkerRepositoryError(error) {
  if (error instanceof WorkerDomainError) return error
  const code = error?.code
  if (code === '40001') {
    return new WorkerDomainError('CONFLICT', 'La ficha ha cambiado. Actualízala antes de guardar; tus cambios se conservan en el formulario.')
  }
  if (code === '22023') {
    return new WorkerDomainError('VALIDATION', 'Los datos del trabajador no son válidos.')
  }
  if (code === '23505') {
    return new WorkerDomainError('DUPLICATE', 'Ya existe una ficha con ese código o documento en esta organización.')
  }
  if (code === '42501') {
    return new WorkerDomainError('FORBIDDEN', 'No tienes permiso para gestionar esta ficha.')
  }
  if (code === 'PGRST116') {
    return new WorkerDomainError('NOT_FOUND', 'La ficha no existe o no está accesible.')
  }
  const httpStatus = error?.status ?? error?.statusCode
  if ([502, 503, 504].includes(httpStatus) || error instanceof TypeError || /fetch|network|networkerror/i.test(error?.message || '')) {
    return new WorkerDomainError('CONNECTION', 'No se pudo conectar con el servicio. Revisa la conexión e inténtalo de nuevo.')
  }
  return new WorkerDomainError('UNKNOWN', 'No se pudo completar la operación. Inténtalo de nuevo.')
}

export function createSupabaseWorkerRepository({ client, organizationId, accessService = null }) {
  const authorizedOrganizationId = requireOrganizationId(organizationId)
  if (!client?.from || !client?.rpc) {
    throw new WorkerDomainError('CONFIGURATION', 'El cliente de datos no está disponible.')
  }

  async function getWorkerRow(id) {
    const { data, error } = await awaitRequest(client
      .from('workers')
      .select(workerFields)
      .eq('id', id)
      .eq('organization_id', authorizedOrganizationId)
      .maybeSingle())
    if (error) throw toWorkerRepositoryError(error)
    if (!data) throw new WorkerDomainError('NOT_FOUND', 'La ficha no existe o no está accesible.')
    return data
  }

  async function getHistory(id) {
    const { data, error } = await awaitRequest(client
      .from('worker_audit_log')
      .select(auditFields)
      .eq('worker_id', id)
      .eq('organization_id', authorizedOrganizationId)
      .order('occurred_at', { ascending: true }))
    if (error) throw toWorkerRepositoryError(error)
    return (data || []).map(mapWorkerAuditRow)
  }

  async function get(id) {
    const [row, history] = await Promise.all([getWorkerRow(id), getHistory(id)])
    return { ...mapWorkerRow(row), history }
  }

  async function transition(id, reason, expectedRevision, rpcName) {
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
      throw new WorkerDomainError('CONFLICT', 'La ficha ha cambiado. Actualízala antes de continuar.')
    }
    const normalizedReason = validateArchiveReason(reason)
    const { data, error } = await awaitRequest(client.rpc(rpcName, {
      p_worker_id: id,
      p_expected_revision: expectedRevision,
      p_reason: normalizedReason,
    }))
    if (error) throw toWorkerRepositoryError(error)
    if (!data?.id) throw new WorkerDomainError('INVALID_RESPONSE', 'La ficha modificada no se pudo recuperar.')
    return get(data.id)
  }

  return Object.freeze({
    supportsArchive: true,
    async list() {
      const { data, error } = await awaitRequest(client
        .from('workers')
        .select(workerFields)
        .eq('organization_id', authorizedOrganizationId)
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true }))
      if (error) throw toWorkerRepositoryError(error)
      return (data || []).map(mapWorkerRow)
    },
    get,
    async create(input) {
      const payload = toWorkerInsert(input, authorizedOrganizationId)
      const { data, error } = await awaitRequest(client.from('workers').insert(payload).select(workerFields).single())
      if (error) throw toWorkerRepositoryError(error)
      if (!data?.id) throw new WorkerDomainError('INVALID_RESPONSE', 'La ficha creada no se pudo recuperar.')
      return get(data.id)
    },
    async update(id, input, { expectedRevision } = {}) {
      if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
        throw new WorkerDomainError('CONFLICT', 'La ficha ha cambiado. Actualízala antes de guardar.')
      }
      const current = await getWorkerRow(id)
      const currentWorker = mapWorkerRow(current)
      const changes = toWorkerPatch(currentWorker, input)
      if (Object.keys(changes).length === 0) return get(id)
      const { data, error } = await awaitRequest(client.rpc('update_worker_with_revision', {
        p_worker_id: id,
        p_expected_revision: expectedRevision,
        p_changes: changes,
      }))
      if (error) throw toWorkerRepositoryError(error)
      if (!data?.id) throw new WorkerDomainError('INVALID_RESPONSE', 'La ficha actualizada no se pudo recuperar.')
      return get(data.id)
    },
    async archive(id, reason, { expectedRevision } = {}) {
      return transition(id, reason, expectedRevision, 'archive_worker_with_revision')
    },
    async restore(id, reason, { expectedRevision } = {}) {
      return transition(id, reason, expectedRevision, 'restore_worker_with_revision')
    },
    async enableAccess(id, password, reason, { expectedRevision } = {}) {
      if (!accessService) throw new WorkerDomainError('CONFIGURATION', 'La habilitación de acceso no está disponible.')
      return accessService.enable({ workerId: id, expectedRevision, password, reason })
    },
    async resetWorkerPassword(id, password) {
      if (!accessService) throw new WorkerDomainError('CONFIGURATION', 'La recuperación de acceso no está disponible.')
      return accessService.resetWorkerPassword(id, password)
    },
  })
}

import { normalizeSpanishDocument, validateSpanishDocument } from '../../utils/spanishDocument.js'

export const WORKER_FIELDS = Object.freeze([
  'employeeCode', 'firstName', 'lastName', 'documentType', 'document',
  'email', 'phone', 'startDate', 'position', 'status',
])
export const WORKER_LABELS = Object.freeze({
  employeeCode: 'Código', firstName: 'Nombre', lastName: 'Apellidos',
  documentType: 'Tipo de documento', document: 'DNI/NIE', email: 'Correo',
  phone: 'Teléfono', startDate: 'Incorporación', position: 'Puesto', status: 'Estado',
})
export const WORKER_STATUSES = Object.freeze({ draft: 'Borrador', active: 'Activa', archived: 'Archivada' })

export class WorkerDomainError extends Error {
  constructor(code, message, fieldErrors = {}) {
    super(message)
    this.name = 'WorkerDomainError'
    this.code = code
    this.fieldErrors = fieldErrors
  }
}
export function blankWorkerForm() {
  return Object.fromEntries(WORKER_FIELDS.map((key) => [key,
    key === 'documentType' ? 'DNI' : key === 'status' ? 'draft' : '',
  ]))
}
// Deliberate projection: never forward the record (id/organization/history) as a DTO.
export function toWorkerForm(worker) {
  const empty = blankWorkerForm()
  return Object.fromEntries(WORKER_FIELDS.map((key) => [key, worker?.[key] ?? empty[key]]))
}
export function validateWorkerInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new WorkerDomainError('INVALID_INPUT', 'La ficha debe ser un objeto de campos editables.')
  }
  if (Object.keys(input).some((key) => !WORKER_FIELDS.includes(key))) {
    throw new WorkerDomainError('FORBIDDEN_FIELDS', 'Campos protegidos o desconocidos no permitidos.')
  }
  const fieldErrors = {}
  const data = blankWorkerForm()
  for (const key of WORKER_FIELDS) {
    if (input[key] !== undefined && typeof input[key] !== 'string') {
      fieldErrors[key] = 'Introduce texto en este campo.'
    } else if (input[key] !== undefined) data[key] = input[key].trim()
  }
  data.employeeCode = data.employeeCode.toUpperCase()
  data.document = normalizeSpanishDocument(data.document)
  if (!/^[A-Z0-9][A-Z0-9._/-]{0,23}$/.test(data.employeeCode)) {
    fieldErrors.employeeCode = 'Introduce un código de 1 a 24 letras, números o separadores . _ / -.'
  }
  for (const key of ['firstName', 'lastName']) {
    if (!data[key] || data[key].length > 100 || !/\p{L}/u.test(data[key])) {
      fieldErrors[key] = 'Introduce un nombre válido de hasta 100 caracteres.'
    }
  }
  if (!['DNI', 'NIE'].includes(data.documentType)) fieldErrors.documentType = 'Selecciona DNI o NIE.'
  if (!validateSpanishDocument(data.documentType, data.document).valid) {
    fieldErrors.document = 'Revisa el formato y la letra del DNI/NIE. Esto no verifica la identidad.'
  }
  if (data.email && (data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))) {
    fieldErrors.email = 'Introduce un correo válido o deja el campo vacío.'
  }
  if (data.phone && (!/^\+?[0-9 ().-]+$/.test(data.phone) ||
      !/^\d{7,15}$/.test(data.phone.replace(/\D/g, '')))) {
    fieldErrors.phone = 'Introduce de 7 a 15 cifras con separadores válidos, o deja el campo vacío.'
  }
  if (data.startDate) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(data.startDate) ? new Date(`${data.startDate}T00:00:00Z`) : null
    if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== data.startDate ||
        Number(data.startDate.slice(0, 4)) < 1900) {
      fieldErrors.startDate = 'Introduce una fecha real en formato AAAA-MM-DD, desde 1900.'
    }
  }
  if (data.position.length > 120) fieldErrors.position = 'El puesto admite hasta 120 caracteres.'
  if (!['draft', 'active'].includes(data.status)) fieldErrors.status = 'El archivo se realiza desde su acción específica.'
  if (Object.keys(fieldErrors).length) {
    throw new WorkerDomainError('VALIDATION', 'Revisa los campos señalados.', fieldErrors)
  }
  return data
}
export function validateArchiveReason(value) {
  if (typeof value !== 'string' || value.trim().length < 3 || value.trim().length > 500) {
    throw new WorkerDomainError('REASON_REQUIRED', 'Indica un motivo de entre 3 y 500 caracteres.', { reason: 'El motivo es obligatorio (3-500 caracteres).' })
  }
  return value.trim()
}
export function maskWorkerDocument(value) {
  const doc = normalizeSpanishDocument(value)
  return doc ? `${doc.slice(0, 3)}••••${doc.slice(-1)}` : '—'
}
export function workerChanges(before, after) {
  return WORKER_FIELDS.filter((key) => before?.[key] !== after[key]).map((field) => {
    const redact = (value, previous) => {
      if (field === 'document') return maskWorkerDocument(value)
      if (['email', 'phone'].includes(field)) return value ? (previous ? 'Dato anterior oculto' : 'Dato actualizado oculto') : '(vacío)'
      return value ?? ''
    }
    return { field, before: redact(before?.[field], true), after: redact(after[field], false) }
  })
}

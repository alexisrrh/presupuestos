import { describe, expect, it } from 'vitest'
import {
  createSupabaseWorkerRepository,
  mapWorkerRow,
  toWorkerInsert,
  toWorkerPatch,
  toWorkerRepositoryError,
} from './supabaseWorkerRepository.js'

const valid = Object.freeze({
  employeeCode: 'PR-001', documentType: 'DNI', document: '12345678Z', firstName: 'Ana', lastName: 'Prueba',
  email: 'ana@example.test', phone: '600123456', startDate: '2024-01-15', position: 'Oficial', status: 'active',
})

function workerRow(overrides = {}) {
  return {
    id: 'worker-1', organization_id: 'org-1', user_id: null, employee_code: 'PR-001', document_type: 'DNI',
    document_normalized: '12345678Z', first_name: 'Ana', last_name: 'Prueba', email: 'ana@example.test',
    phone: '600123456', start_date: '2024-01-15', position: 'Oficial', status: 'active', revision: 4,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...overrides,
  }
}

function readQuery(result) {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({ maybeSingle: async () => result }),
      }),
    }),
  }
}

describe('repositorio Supabase de trabajadores', () => {
  it('mapea la fila de base de datos al contrato de la interfaz sin exponer nombres de columnas', () => {
    expect(mapWorkerRow({ id: 'worker-1', organization_id: 'org-1', employee_code: 'PR-001', document_type: 'DNI', document_normalized: '12345678Z', first_name: 'Ana', last_name: 'Prueba', email: null, phone: null, start_date: null, position: null, status: 'draft', revision: 1 })).toMatchObject({
      id: 'worker-1', organizationId: 'org-1', employeeCode: 'PR-001', document: '12345678Z', email: '', phone: '', revision: 1,
    })
  })

  it('crea un payload limitado a la organización autorizada', () => {
    expect(toWorkerInsert(valid, 'org-1')).toEqual({
      organization_id: 'org-1', employee_code: 'PR-001', document_type: 'DNI', document_normalized: '12345678Z',
      first_name: 'Ana', last_name: 'Prueba', email: 'ana@example.test', phone: '600123456',
      start_date: '2024-01-15', position: 'Oficial', status: 'active',
    })
  })

  it('proyecta solo campos editables que han cambiado para la RPC con revisión', () => {
    const current = { ...valid, id: 'worker-1', organizationId: 'org-1', revision: 4 }
    expect(toWorkerPatch(current, { ...valid, phone: '600654321', status: 'draft' })).toEqual({ phone: '600654321' })
  })

  it('traduce el conflicto de revisión sin pedir reintento destructivo', () => {
    expect(toWorkerRepositoryError({ code: '40001' })).toMatchObject({ code: 'CONFLICT' })
  })

  it('traduce una indisponibilidad temporal del gateway a un error de conexión', () => {
    expect(toWorkerRepositoryError({ status: 503 })).toMatchObject({ code: 'CONNECTION' })
    expect(toWorkerRepositoryError({ statusCode: 503 })).toMatchObject({ code: 'CONNECTION' })
  })

  it('usa la RPC controlada con la revisión vigente y no reenvía campos protegidos', async () => {
    const calls = []
    const client = {
      from(table) {
        if (table === 'workers') return readQuery({ data: workerRow(), error: null })
        if (table === 'worker_audit_log') {
          return { select: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) }) }
        }
        throw new Error(`Tabla no esperada: ${table}`)
      },
      async rpc(name, args) {
        calls.push({ name, args })
        return { data: workerRow({ phone: '600654321', revision: 5 }), error: null }
      },
    }
    const repository = createSupabaseWorkerRepository({ client, organizationId: 'org-1' })
    await repository.update('worker-1', { ...valid, phone: '600654321', status: 'draft' }, { expectedRevision: 4 })

    expect(calls).toEqual([{
      name: 'update_worker_with_revision',
      args: { p_worker_id: 'worker-1', p_expected_revision: 4, p_changes: { phone: '600654321' } },
    }])
  })

  it('archiva con la RPC específica, motivo validado y revisión vigente', async () => {
    const calls = []
    const client = {
      from(table) {
        if (table === 'workers') return readQuery({ data: workerRow({ status: 'archived', revision: 5 }), error: null })
        if (table === 'worker_audit_log') {
          return { select: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) }) }
        }
        throw new Error(`Tabla no esperada: ${table}`)
      },
      async rpc(name, args) {
        calls.push({ name, args })
        return { data: workerRow({ status: 'archived', revision: 5 }), error: null }
      },
    }
    const repository = createSupabaseWorkerRepository({ client, organizationId: 'org-1' })
    await repository.archive('worker-1', 'Fin de contrato de prueba', { expectedRevision: 4 })

    expect(repository.supportsArchive).toBe(true)
    expect(calls).toEqual([{
      name: 'archive_worker_with_revision',
      args: {
        p_worker_id: 'worker-1',
        p_expected_revision: 4,
        p_reason: 'Fin de contrato de prueba',
      },
    }])
  })
})

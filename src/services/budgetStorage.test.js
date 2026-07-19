import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BUDGETS_STORAGE_KEY,
  clearBudgets,
  deleteBudget,
  duplicateBudget,
  getBudgets,
  saveBudget,
  updateBudget,
} from './budgetStorage'

function createStorageMock() {
  let store = {}

  return {
    clear: vi.fn(() => {
      store = {}
    }),
    getItem: vi.fn((key) => store[key] || null),
    removeItem: vi.fn((key) => {
      delete store[key]
    }),
    setItem: vi.fn((key, value) => {
      store[key] = String(value)
    }),
  }
}

function createBudget(overrides = {}) {
  return {
    budgetNumber: 'PR-2026-0001',
    chapters: [{ items: [{ quantity: 1, unitPrice: 100 }] }],
    clientData: { name: 'Cliente' },
    conditions: {},
    discountPercentage: '0',
    generalData: { number: 'PR-2026-0001', date: '2026-07-18' },
    status: 'draft',
    vatPercentage: '21',
    ...overrides,
  }
}

describe('budgetStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock())
  })

  it('devuelve array vacio si no hay datos', () => {
    expect(getBudgets()).toEqual([])
  })

  it('guarda un presupuesto', () => {
    const savedBudget = saveBudget(createBudget())

    expect(savedBudget.id).toBeTruthy()
    expect(getBudgets()).toHaveLength(1)
    expect(getBudgets()[0].budgetNumber).toBe('PR-2026-0001')
  })

  it('actualiza sin duplicar', () => {
    const savedBudget = saveBudget(createBudget())
    updateBudget(savedBudget.id, { clientData: { name: 'Cliente actualizado' } })

    expect(getBudgets()).toHaveLength(1)
    expect(getBudgets()[0].clientData.name).toBe('Cliente actualizado')
  })

  it('elimina un presupuesto', () => {
    const savedBudget = saveBudget(createBudget())
    deleteBudget(savedBudget.id)

    expect(getBudgets()).toEqual([])
  })

  it('duplica con id nuevo', () => {
    const savedBudget = saveBudget(createBudget())
    const duplicatedBudget = duplicateBudget(savedBudget.id)

    expect(duplicatedBudget.id).not.toBe(savedBudget.id)
  })

  it('duplica con numero nuevo', () => {
    const savedBudget = saveBudget(createBudget())
    const duplicatedBudget = duplicateBudget(savedBudget.id)

    expect(duplicatedBudget.budgetNumber).toBe('PR-2026-0002')
    expect(duplicatedBudget.generalData.number).toBe('PR-2026-0002')
  })

  it('maneja JSON corrupto', () => {
    localStorage.setItem(BUDGETS_STORAGE_KEY, '{mal json')

    expect(getBudgets()).toEqual([])
  })

  it('conserva createdAt al editar', () => {
    const savedBudget = saveBudget(createBudget())
    const createdAt = savedBudget.createdAt
    const updatedBudget = updateBudget(savedBudget.id, {
      generalData: { projectName: 'Nueva obra' },
    })

    expect(updatedBudget.createdAt).toBe(createdAt)
  })

  it('actualiza updatedAt', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const savedBudget = saveBudget(createBudget())

    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'))
    const updatedBudget = updateBudget(savedBudget.id, {
      generalData: { projectName: 'Nueva obra' },
    })

    expect(updatedBudget.updatedAt).toBe('2026-01-02T00:00:00.000Z')
    vi.useRealTimers()
  })

  it('limpia todos los presupuestos', () => {
    saveBudget(createBudget())
    clearBudgets()

    expect(getBudgets()).toEqual([])
  })

  it('guarda documentType', () => {
    const savedBudget = saveBudget(createBudget({ documentType: 'professional' }))

    expect(savedBudget.documentType).toBe('professional')
  })

  it('guarda technicalReport', () => {
    const savedBudget = saveBudget(
      createBudget({
        technicalReport: {
          offerObject: 'Oferta',
          generalScope: ['Alcance'],
        },
      }),
    )

    expect(savedBudget.technicalReport.offerObject).toBe('Oferta')
    expect(savedBudget.technicalReport.generalScope).toEqual(['Alcance'])
  })

  it('carga presupuestos antiguos como quick', () => {
    const savedBudget = saveBudget(createBudget({ documentType: undefined }))

    expect(savedBudget.documentType).toBe('quick')
  })

  it('duplica conservando memoria tecnica', () => {
    const savedBudget = saveBudget(
      createBudget({
        documentType: 'professional',
        technicalReport: { offerObject: 'Memoria' },
      }),
    )
    const duplicatedBudget = duplicateBudget(savedBudget.id)

    expect(duplicatedBudget.technicalReport.offerObject).toBe('Memoria')
  })

  it('edita sin eliminar campos profesionales', () => {
    const savedBudget = saveBudget(
      createBudget({
        documentType: 'professional',
        technicalReport: { offerObject: 'Memoria' },
      }),
    )
    const updatedBudget = updateBudget(savedBudget.id, {
      clientData: { name: 'Nuevo cliente' },
    })

    expect(updatedBudget.documentType).toBe('professional')
    expect(updatedBudget.technicalReport.offerObject).toBe('Memoria')
  })
})

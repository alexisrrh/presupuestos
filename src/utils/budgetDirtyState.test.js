import { describe, expect, it } from 'vitest'
import { createBudgetDirtySnapshot, hasUnsavedChanges } from './budgetDirtyState'

function createBudget(overrides = {}) {
  return {
    budgetNumber: 'PR-2026-0001',
    chapters: [{ id: 'c1', name: 'Capitulo', items: [{ id: 'i1', quantity: '1', unitPrice: '10' }] }],
    clientData: { name: 'Cliente' },
    conditions: { paymentTerms: '' },
    discountPercentage: '0',
    documentType: 'quick',
    generalData: { number: 'PR-2026-0001', date: '2026-07-19' },
    status: 'draft',
    technicalReport: { offerObject: '' },
    vatPercentage: '21',
    ...overrides,
  }
}

describe('budgetDirtyState', () => {
  it('detecta cambios', () => {
    const budget = createBudget()
    const snapshot = createBudgetDirtySnapshot(budget)

    expect(hasUnsavedChanges({ ...budget, clientData: { name: 'Otro' } }, snapshot)).toBe(true)
  })

  it('no marca cambios al cargar', () => {
    const budget = createBudget()
    const snapshot = createBudgetDirtySnapshot(budget)

    expect(hasUnsavedChanges(budget, snapshot)).toBe(false)
  })

  it('limpia estado despues de guardar', () => {
    const savedBudget = createBudget({ clientData: { name: 'Guardado' } })
    const snapshot = createBudgetDirtySnapshot(savedBudget)

    expect(hasUnsavedChanges(savedBudget, snapshot)).toBe(false)
  })

  it('detecta cambios en capitulos', () => {
    const budget = createBudget()
    const snapshot = createBudgetDirtySnapshot(budget)
    const changedBudget = createBudget({
      chapters: [{ id: 'c1', name: 'Nuevo nombre', items: budget.chapters[0].items }],
    })

    expect(hasUnsavedChanges(changedBudget, snapshot)).toBe(true)
  })

  it('detecta cambios en technicalReport', () => {
    const budget = createBudget({ documentType: 'professional' })
    const snapshot = createBudgetDirtySnapshot(budget)

    expect(
      hasUnsavedChanges(
        createBudget({
          documentType: 'professional',
          technicalReport: { offerObject: 'Nuevo objeto' },
        }),
        snapshot,
      ),
    ).toBe(true)
  })

  it('detecta cambios en IVA y descuento', () => {
    const budget = createBudget()
    const snapshot = createBudgetDirtySnapshot(budget)

    expect(hasUnsavedChanges(createBudget({ vatPercentage: '10' }), snapshot)).toBe(true)
    expect(hasUnsavedChanges(createBudget({ discountPercentage: '5' }), snapshot)).toBe(true)
  })
})


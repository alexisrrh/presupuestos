import { describe, expect, it } from 'vitest'
import { getNextBudgetNumber } from './budgetNumber'

describe('budgetNumber', () => {
  it('devuelve el primer numero del año', () => {
    expect(getNextBudgetNumber([], 2026)).toBe('PR-2026-0001')
  })

  it('devuelve el siguiente numero', () => {
    expect(getNextBudgetNumber([{ budgetNumber: 'PR-2026-0001' }], 2026)).toBe(
      'PR-2026-0002',
    )
  })

  it('ignora presupuestos de otros años', () => {
    expect(getNextBudgetNumber([{ budgetNumber: 'PR-2025-0099' }], 2026)).toBe(
      'PR-2026-0001',
    )
  })

  it('soporta huecos en la numeracion', () => {
    const budgets = [{ budgetNumber: 'PR-2026-0001' }, { budgetNumber: 'PR-2026-0003' }]

    expect(getNextBudgetNumber(budgets, 2026)).toBe('PR-2026-0004')
  })

  it('usa el numero mayor existente', () => {
    const budgets = [{ budgetNumber: 'PR-2026-0008' }, { budgetNumber: 'PR-2026-0002' }]

    expect(getNextBudgetNumber(budgets, 2026)).toBe('PR-2026-0009')
  })

  it('ignora formatos invalidos', () => {
    const budgets = [{ budgetNumber: 'P-2026-9999' }, { budgetNumber: 'PR-2026-ABCD' }]

    expect(getNextBudgetNumber(budgets, 2026)).toBe('PR-2026-0001')
  })
})

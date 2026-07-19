import { describe, expect, it } from 'vitest'
import {
  calculateBudgetTotals,
  calculateItemTotal,
  calculateSubtotal,
  toNumber,
} from './budgetCalculations'

describe('budgetCalculations', () => {
  it('calcula el total de una partida como cantidad por precio unitario', () => {
    expect(calculateItemTotal({ quantity: 3, unitPrice: 25 })).toBe(75)
  })

  it('trata una cantidad vacia como 0', () => {
    expect(calculateItemTotal({ quantity: '', unitPrice: 25 })).toBe(0)
  })

  it('trata un precio vacio como 0', () => {
    expect(calculateItemTotal({ quantity: 3, unitPrice: '' })).toBe(0)
  })

  it('calcula valores numericos recibidos como strings', () => {
    expect(calculateItemTotal({ quantity: '4', unitPrice: '12.5' })).toBe(50)
  })

  it('calcula el subtotal de un capitulo', () => {
    const chapters = [
      {
        items: [
          { quantity: 2, unitPrice: 10 },
          { quantity: 3, unitPrice: 5 },
        ],
      },
    ]

    expect(calculateSubtotal(chapters)).toBe(35)
  })

  it('calcula el subtotal de varios capitulos', () => {
    const chapters = [
      { items: [{ quantity: 2, unitPrice: 10 }] },
      { items: [{ quantity: 3, unitPrice: 5 }] },
    ]

    expect(calculateSubtotal(chapters)).toBe(35)
  })

  it('devuelve 0 para un capitulo sin partidas', () => {
    expect(calculateSubtotal([{ items: [] }])).toBe(0)
  })

  it('devuelve 0 para una lista de capitulos vacia', () => {
    expect(calculateSubtotal([])).toBe(0)
  })

  it('aplica descuento del 0 por ciento', () => {
    const totals = calculateBudgetTotals([{ items: [{ quantity: 2, unitPrice: 100 }] }], 0, 21)

    expect(totals.discountAmount).toBe(0)
    expect(totals.taxableBase).toBe(200)
  })

  it('calcula correctamente un descuento porcentual', () => {
    const totals = calculateBudgetTotals([{ items: [{ quantity: 1, unitPrice: 200 }] }], 10, 21)

    expect(totals.discountAmount).toBe(20)
  })

  it('calcula la base imponible despues del descuento', () => {
    const totals = calculateBudgetTotals([{ items: [{ quantity: 1, unitPrice: 200 }] }], 10, 21)

    expect(totals.taxableBase).toBe(180)
  })

  it('calcula el IVA del 21 por ciento', () => {
    const totals = calculateBudgetTotals([{ items: [{ quantity: 1, unitPrice: 100 }] }], 0, 21)

    expect(totals.ivaAmount).toBe(21)
  })

  it('calcula el IVA del 10 por ciento', () => {
    const totals = calculateBudgetTotals([{ items: [{ quantity: 1, unitPrice: 100 }] }], 0, 10)

    expect(totals.ivaAmount).toBe(10)
  })

  it('calcula el total final', () => {
    const totals = calculateBudgetTotals([{ items: [{ quantity: 1, unitPrice: 200 }] }], 10, 21)

    expect(totals.total).toBeCloseTo(217.8)
  })

  it('evita NaN con valores vacios, null o undefined', () => {
    expect(toNumber('')).toBe(0)
    expect(toNumber(null)).toBe(0)
    expect(toNumber(undefined)).toBe(0)

    const totals = calculateBudgetTotals(
      [{ items: [{ quantity: null, unitPrice: undefined }] }],
      '',
      undefined,
    )

    expect(Number.isNaN(totals.total)).toBe(false)
    expect(totals.total).toBe(0)
  })

  it('calcula decimales como 2.5 y 10.75', () => {
    expect(calculateItemTotal({ quantity: 2.5, unitPrice: 10.75 })).toBeCloseTo(26.875)
  })

  it('mantiene el comportamiento actual con cantidades negativas', () => {
    expect(calculateItemTotal({ quantity: -2, unitPrice: 10 })).toBe(-20)
  })

  it('mantiene el comportamiento actual con precios negativos', () => {
    expect(calculateItemTotal({ quantity: 2, unitPrice: -10 })).toBe(-20)
  })
})

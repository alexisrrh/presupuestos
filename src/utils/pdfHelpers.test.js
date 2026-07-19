import { describe, expect, it } from 'vitest'
import {
  buildBudgetPdfFileName,
  calculateChapterSubtotal,
  formatPdfCurrency,
  safeText,
  sanitizeFileName,
} from './pdfHelpers'

describe('pdfHelpers', () => {
  it('formatea 1234.56 como moneda espanola', () => {
    expect(formatPdfCurrency(1234.56)).toBe('1.234,56 €')
  })

  it('formatea 0 correctamente', () => {
    expect(formatPdfCurrency(0)).toBe('0,00 €')
  })

  it('evita NaN con null, undefined y valores invalidos', () => {
    expect(formatPdfCurrency(null)).toBe('0,00 €')
    expect(formatPdfCurrency(undefined)).toBe('0,00 €')
    expect(formatPdfCurrency('abc')).toBe('0,00 €')
  })

  it('convierte el nombre del cliente en un nombre de archivo seguro', () => {
    expect(sanitizeFileName('Enmanuel Rojas')).toBe('Enmanuel-Rojas')
  })

  it('sustituye tildes y caracteres especiales', () => {
    expect(sanitizeFileName('Ángel Núñez: obra/cocina')).toBe('Angel-Nunez-obra-cocina')
  })

  it('convierte espacios en guiones', () => {
    expect(sanitizeFileName('cliente final obra')).toBe('cliente-final-obra')
  })

  it('no deja barras, dos puntos ni caracteres invalidos', () => {
    const result = sanitizeFileName('cliente:/obra\\2026?*')

    expect(result).not.toMatch(/[/:\\?*]/)
  })

  it('usa un nombre neutro para un cliente vacio', () => {
    expect(sanitizeFileName('')).toBe('cliente')
  })

  it('conserva el numero de presupuesto de forma segura', () => {
    expect(sanitizeFileName('PR-2026-0001')).toBe('PR-2026-0001')
  })

  it('crea el nombre final terminado en pdf', () => {
    expect(buildBudgetPdfFileName('PR-2026-0001', 'enmanuel rojas')).toBe(
      'PR-2026-0001-enmanuel-rojas.pdf',
    )
  })

  it('usa cliente como nombre neutro en el PDF final', () => {
    expect(buildBudgetPdfFileName('PR-2026-0001', '')).toBe('PR-2026-0001-cliente.pdf')
  })

  it('convierte valores vacios a texto neutro', () => {
    expect(safeText(null)).toBe('-')
    expect(safeText(undefined)).toBe('-')
    expect(safeText('')).toBe('-')
  })

  it('calcula el subtotal de capitulo con la utilidad compartida', () => {
    const subtotal = calculateChapterSubtotal({
      items: [
        { quantity: 2, unitPrice: 10 },
        { quantity: '1.5', unitPrice: '20' },
      ],
    })

    expect(subtotal).toBeCloseTo(50)
  })
})

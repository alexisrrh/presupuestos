import { describe, expect, it } from 'vitest'
import {
  buildProfessionalPdfFileName,
  cleanStringList,
  combinePartialValues,
  formatPercentLabel,
  getBudgetDocumentType,
  getChapterSubtotal,
  getItemCode,
  getProfessionalProjectTitle,
  mergeProfessionalDefaults,
  normalizeTechnicalReport,
} from './professionalBudgetHelpers'

describe('professionalBudgetHelpers', () => {
  it('normaliza technicalReport antiguo o incompleto', () => {
    const report = normalizeTechnicalReport({ offerObject: 'Reforma' })
    expect(report.offerObject).toBe('Reforma')
    expect(report.executiveSummary).toBe('')
    expect(report.generalScope).toEqual([])
  })

  it('mantiene arrays vacios como arrays', () => {
    expect(normalizeTechnicalReport({ generalScope: [] }).generalScope).toEqual([])
  })

  it('elimina lineas vacias de listas', () => {
    expect(cleanStringList(['Uno', ' ', '', 'Dos'])).toEqual(['Uno', 'Dos'])
  })

  it('genera codigos de partida', () => {
    expect(getItemCode(0, 0)).toBe('01.01')
    expect(getItemCode(0, 1)).toBe('01.02')
    expect(getItemCode(1, 0)).toBe('02.01')
  })

  it('selecciona valores del presupuesto frente a predeterminados', () => {
    const report = mergeProfessionalDefaults(
      { executiveSummary: 'Usuario' },
      { professionalDefaults: { executiveSummary: 'Default' } },
    )
    expect(report.executiveSummary).toBe('Usuario')
  })

  it('preserva valores modificados por el usuario', () => {
    const report = mergeProfessionalDefaults(
      { warranty: 'Garantia propia' },
      { professionalDefaults: { warranty: 'Garantia default' } },
    )
    expect(report.warranty).toBe('Garantia propia')
  })

  it('crea nombre de archivo profesional seguro', () => {
    expect(buildProfessionalPdfFileName('PR-2026-0001', 'Enmanuel Rojas')).toBe(
      'PR-2026-0001-Enmanuel-Rojas-profesional.pdf',
    )
  })

  it('evita undefined en campos vacios', () => {
    expect(normalizeTechnicalReport({ offerObject: undefined }).offerObject).toBe('')
  })

  it('usa quick si el presupuesto antiguo no tiene documentType', () => {
    expect(getBudgetDocumentType({})).toBe('quick')
  })

  it('calcula subtotal de capitulo reutilizando calculos existentes', () => {
    const subtotal = getChapterSubtotal({
      items: [{ quantity: 2, unitPrice: 10 }],
    })
    expect(subtotal).toBe(20)
  })

  it('combina cliente y documento sin doble guion', () => {
    expect(combinePartialValues(['Cliente', '12345678A'])).toBe('Cliente / 12345678A')
    expect(combinePartialValues(['', '12345678A'])).toBe('12345678A')
    expect(combinePartialValues(['Cliente', ''])).toBe('Cliente')
    expect(combinePartialValues(['', ''])).toBe('-')
  })

  it('devuelve titulo alternativo si no hay proyecto', () => {
    expect(getProfessionalProjectTitle({}, {})).toBe('Presupuesto de obra')
    expect(getProfessionalProjectTitle({ projectName: 'Reforma' }, {})).toBe('Reforma')
  })

  it('crea etiqueta de IVA con porcentaje español', () => {
    expect(formatPercentLabel('IVA', 21)).toBe('IVA (21,00 %)')
  })
})

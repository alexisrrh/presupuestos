import { describe, expect, it } from 'vitest'
import {
  isUuid,
  mapBudgetFromRows,
  mapBudgetToPayload,
  mapCompanySettingsFromRow,
  mapCompanySettingsToRow,
} from './budgetMappers'

const organizationId = '11111111-1111-4111-8111-111111111111'

describe('budgetMappers', () => {
  it('convierte configuracion snake_case a camelCase', () => {
    const settings = mapCompanySettingsFromRow({
      business_name: 'Empresa',
      default_tax: 10,
      logo_url: 'organizations/1/logo.png',
    })

    expect(settings.name).toBe('Empresa')
    expect(settings.defaultVat).toBe(10)
    expect(settings.logoUrl).toBe('organizations/1/logo.png')
  })

  it('convierte configuracion camelCase a snake_case', () => {
    const row = mapCompanySettingsToRow(
      { name: 'Empresa', defaultVat: '21', taxId: 'B123' },
      organizationId,
    )

    expect(row.organization_id).toBe(organizationId)
    expect(row.business_name).toBe('Empresa')
    expect(row.default_tax).toBe(21)
    expect(row.tax_id).toBe('B123')
  })

  it('mapea presupuesto completo a payload Supabase', () => {
    const payload = mapBudgetToPayload(
      {
        budgetNumber: 'PR-2026-0001',
        chapters: [{ name: 'Capitulo', items: [{ description: 'Partida', quantity: '2', unitPrice: '10' }] }],
        clientData: { name: 'Cliente' },
        conditions: {},
        discountPercentage: '0',
        documentType: 'professional',
        generalData: { number: 'PR-2026-0001', projectName: 'Obra', date: '2026-07-19' },
        status: 'draft',
        vatPercentage: '21',
      },
      organizationId,
    )

    expect(payload.budget.organization_id).toBe(organizationId)
    expect(payload.budget.document_type).toBe('professional')
    expect(payload.chapters[0].items[0].total).toBe(20)
  })

  it('mapea filas Supabase a presupuesto del frontend conservando orden', () => {
    const budget = mapBudgetFromRows(
      {
        id: organizationId,
        budget_number: 'PR-2026-0001',
        title: 'Obra',
        status: 'draft',
        document_type: 'quick',
        tax_rate: 21,
        discount_rate: 0,
      },
      [
        { id: 'c2', budget_id: organizationId, title: 'Segundo', position: 2 },
        { id: 'c1', budget_id: organizationId, title: 'Primero', position: 1 },
      ],
      [
        { id: 'i1', chapter_id: 'c1', description: 'Uno', position: 1, quantity: 1, unit_price: 5 },
      ],
    )

    expect(budget.generalData.projectName).toBe('Obra')
    expect(budget.chapters[0].name).toBe('Primero')
    expect(budget.chapters[0].items[0].description).toBe('Uno')
  })

  it('detecta UUID valido', () => {
    expect(isUuid(organizationId)).toBe(true)
    expect(isUuid('id-local')).toBe(false)
  })
})


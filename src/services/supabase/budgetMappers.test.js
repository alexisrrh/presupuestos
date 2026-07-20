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
  function expectNoUndefined(value) {
    if (Array.isArray(value)) {
      value.forEach(expectNoUndefined)
      return
    }

    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, entryValue]) => {
        expect(entryValue, key).not.toBeUndefined()
        expectNoUndefined(entryValue)
      })
    }
  }

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
    expect(payload.budget.issue_date).toBe('2026-07-19')
    expect(payload.chapters[0].items[0].total).toBe(20)
  })

  it('crea payload con capitulos y partidas sin valores undefined', () => {
    const payload = mapBudgetToPayload(
      {
        budgetNumber: 'PR-2026-0002',
        chapters: [
          {
            description: undefined,
            name: 'Demoliciones',
            items: [
              { description: 'Retirada', quantity: '2.5', unit: 'h', unitPrice: '40' },
            ],
          },
        ],
        clientData: { email: undefined, name: 'Cliente' },
        conditions: { notes: 'Condiciones' },
        discountPercentage: '10',
        generalData: {
          date: new Date('2026-07-20T10:30:00.000Z'),
          projectName: 'Reforma',
          validityDays: '15',
        },
        vatPercentage: '21',
      },
      organizationId,
    )

    expect(payload.budget.issue_date).toBe('2026-07-20')
    expect(payload.budget.validity_days).toBe(15)
    expect(payload.budget.subtotal).toBe(100)
    expect(payload.budget.discount_amount).toBe(10)
    expect(payload.budget.tax_amount).toBe(18.9)
    expect(payload.budget.total).toBe(108.9)
    expect(payload.chapters[0].subtotal).toBe(100)
    expectNoUndefined(payload)
  })

  it('mapea actualizacion de presupuesto con id UUID', () => {
    const budgetId = '22222222-2222-4222-8222-222222222222'
    const payload = mapBudgetToPayload(
      {
        id: budgetId,
        budgetNumber: 'PR-2026-0003',
        chapters: [],
        clientData: {},
        conditions: {},
        generalData: { projectName: 'Actualizada' },
      },
      organizationId,
    )

    expect(payload.budget.id).toBe(budgetId)
    expect(payload.budget.title).toBe('Actualizada')
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

  it('lee datos antiguos desde budget_date, project_name y client_snapshot', () => {
    const budget = mapBudgetFromRows(
      {
        id: organizationId,
        budget_date: '2026-07-18',
        budget_number: 'PR-2026-0004',
        client_snapshot: {
          address: 'Calle Mayor 1',
          email: 'cliente@example.com',
          name: 'Cliente antiguo',
          phone: '600000000',
          tax_id: 'B12345678',
        },
        discount_percentage: 5,
        project_name: 'Obra antigua',
        status: 'draft',
        vat_percentage: 10,
      },
      [],
      [],
    )

    expect(budget.generalData.date).toBe('2026-07-18')
    expect(budget.generalData.projectName).toBe('Obra antigua')
    expect(budget.clientData.name).toBe('Cliente antiguo')
    expect(budget.clientData.taxId).toBe('B12345678')
    expect(budget.discountPercentage).toBe('5')
    expect(budget.vatPercentage).toBe('10')
  })

  it('detecta UUID valido', () => {
    expect(isUuid(organizationId)).toBe(true)
    expect(isUuid('id-local')).toBe(false)
  })
})

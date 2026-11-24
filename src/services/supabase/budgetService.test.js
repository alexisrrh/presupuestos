import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createBudget,
  duplicateBudget,
  updateBudget,
  updateBudgetStatus,
} from './budgetService'
import { getCurrentBudgetYear } from '../../utils/budgetNumber'
import * as organizationService from './organizationService'

vi.mock('./organizationService', () => ({
  ensureCurrentOrganization: vi.fn(() =>
    Promise.resolve({ id: '11111111-1111-4111-8111-111111111111', name: 'Org' }),
  ),
  getCurrentOrganization: vi.fn(() =>
    Promise.resolve({ id: '11111111-1111-4111-8111-111111111111', name: 'Org' }),
  ),
}))

const rpcMock = vi.fn()
const queryHandler = vi.fn()

class Query {
  constructor(table) {
    this.table = table
    this.filters = []
    this.operation = 'select'
    this.payload = undefined
  }

  select() {
    return this
  }

  update(payload) {
    this.operation = 'update'
    this.payload = payload
    return this
  }

  eq(column, value) {
    this.filters.push({ column, value })
    return this
  }

  in(column, value) {
    this.filters.push({ column, value })
    return this
  }

  order() {
    return this
  }

  then(resolve, reject) {
    return Promise.resolve(queryHandler(this)).then(resolve, reject)
  }
}

const fromMock = vi.fn((table) => new Query(table))

vi.mock('./supabaseServiceUtils', () => ({
  requireSupabase: vi.fn(() => ({
    from: fromMock,
    rpc: rpcMock,
  })),
}))

function createBudgetRow(overrides = {}) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    budget_number: 'PR-2026-0001',
    conditions: {},
    document_type: 'quick',
    status: 'draft',
    tax_rate: 21,
    discount_rate: 0,
    title: 'Obra',
    ...overrides,
  }
}

describe('supabase budgetService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryHandler.mockImplementation((query) => {
      if (query.table === 'budgets') {
        return { data: [createBudgetRow()], error: null }
      }

      return { data: [], error: null }
    })
    rpcMock.mockResolvedValue({
      data: {
        id: '22222222-2222-4222-8222-222222222222',
        budget_number: 'PR-2026-0001',
      },
      error: null,
    })
  })

  it('crea presupuesto nuevo delegando el numero definitivo en la RPC', async () => {
    queryHandler.mockImplementation((query) => {
      if (query.table === 'budgets') {
        if (
          query.filters.some(
            (filter) =>
              filter.column === 'id' &&
              filter.value === '33333333-3333-4333-8333-333333333333',
          )
        ) {
          return { data: [], error: null }
        }

        return { data: [createBudgetRow({ budget_number: 'PR-2026-0002' })], error: null }
      }

      return { data: [], error: null }
    })
    rpcMock.mockResolvedValue({
      data: {
        id: '22222222-2222-4222-8222-222222222222',
        budget_number: 'PR-2026-0002',
      },
      error: null,
    })

    const savedBudget = await createBudget({
      id: '33333333-3333-4333-8333-333333333333',
      budgetNumber: 'PR-2026-0001',
      chapters: [],
      clientData: {},
      conditions: {},
      generalData: { number: 'PR-2026-0001', projectName: 'Nueva' },
    })

    expect(rpcMock).toHaveBeenCalledWith(
      'save_budget_with_details',
      expect.objectContaining({
        payload: expect.objectContaining({
          budget: expect.objectContaining({
            budget_number: 'PR-2026-0001',
            id: null,
          }),
        }),
      }),
    )
    expect(savedBudget.budgetNumber).toBe('PR-2026-0002')
    expect(
      fromMock.mock.results.some((result) => typeof result.value?.upsert === 'function'),
    ).toBe(false)
  })

  it('conserva el budget_number existente al editar aunque el formulario envie otro', async () => {
    await updateBudget('22222222-2222-4222-8222-222222222222', {
      budgetNumber: 'PR-2026-9999',
      chapters: [],
      clientData: {},
      conditions: {},
      generalData: { number: 'PR-2026-9999', projectName: 'Editada' },
    })

    expect(rpcMock).toHaveBeenCalledWith(
      'save_budget_with_details',
      expect.objectContaining({
        payload: expect.objectContaining({
          budget: expect.objectContaining({
            id: '22222222-2222-4222-8222-222222222222',
            budget_number: 'PR-2026-0001',
          }),
        }),
      }),
    )
  })

  it('rechaza editar un presupuesto inexistente sin convertirlo en un alta', async () => {
    queryHandler.mockResolvedValue({ data: [], error: null })

    await expect(
      updateBudget('22222222-2222-4222-8222-222222222222', { status: 'accepted' }),
    ).rejects.toThrow('No se encontro el presupuesto')

    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('duplica un presupuesto mediante el guardado completo existente', async () => {
    const currentYear = getCurrentBudgetYear()
    const sourceBudget = createBudgetRow({ budget_number: `PR-${currentYear}-0001` })
    queryHandler.mockImplementation((query) => {
      if (query.table === 'budgets') {
        const requestedId = query.filters.find((filter) => filter.column === 'id')?.value
        return { data: requestedId ? [] : [sourceBudget], error: null }
      }
      return { data: [], error: null }
    })

    await duplicateBudget(sourceBudget.id)

    expect(rpcMock).toHaveBeenCalledWith(
      'save_budget_with_details',
      expect.objectContaining({
        payload: expect.objectContaining({
          budget: expect.objectContaining({
            budget_number: `PR-${currentYear}-0002`,
            id: null,
            status: 'draft',
          }),
        }),
      }),
    )
  })

  it('conserva cliente, partidas, condiciones e importes al cambiar solo el estado', async () => {
    const budgetRow = createBudgetRow({
      client_address: 'Calle Cliente 1',
      client_email: 'cliente@example.test',
      client_name: 'Cliente de prueba',
      client_phone: '600000000',
      client_tax_id: 'B12345678',
      conditions: { paymentTerms: '30 dias', notes: 'Mantener acceso libre' },
      discount_rate: 10,
      tax_rate: 21,
      title: 'Reforma integral',
    })
    const chapterRow = {
      id: '33333333-3333-4333-8333-333333333333',
      budget_id: budgetRow.id,
      description: 'Trabajos previos',
      position: 0,
      title: 'Preparacion',
    }
    const itemRow = {
      chapter_id: chapterRow.id,
      description: 'Desmontaje',
      id: '44444444-4444-4444-8444-444444444444',
      position: 0,
      quantity: 2,
      total: 250,
      unit: 'ud',
      unit_price: 125,
    }

    queryHandler.mockImplementation((query) => {
      if (query.table === 'budgets') return { data: [budgetRow], error: null }
      if (query.table === 'budget_chapters') return { data: [chapterRow], error: null }
      if (query.table === 'budget_items') return { data: [itemRow], error: null }
      return { data: [], error: null }
    })

    await updateBudget(budgetRow.id, { status: 'accepted' })

    expect(rpcMock).toHaveBeenCalledWith(
      'save_budget_with_details',
      expect.objectContaining({
        payload: expect.objectContaining({
          budget: expect.objectContaining({
            client_address: 'Calle Cliente 1',
            client_email: 'cliente@example.test',
            client_name: 'Cliente de prueba',
            client_phone: '600000000',
            client_tax_id: 'B12345678',
            conditions: { paymentTerms: '30 dias', notes: 'Mantener acceso libre' },
            discount_rate: 10,
            status: 'accepted',
            tax_rate: 21,
            title: 'Reforma integral',
          }),
          chapters: [
            expect.objectContaining({
              description: 'Trabajos previos',
              items: [
                expect.objectContaining({
                  description: 'Desmontaje',
                  quantity: 2,
                  total: 250,
                  unit: 'ud',
                  unit_price: 125,
                }),
              ],
              title: 'Preparacion',
            }),
          ],
        }),
      }),
    )
  })

  it('actualiza solo el estado en el presupuesto y la organizacion actuales', async () => {
    queryHandler.mockImplementation((query) => {
      if (query.table === 'budgets' && query.operation === 'update') {
        return {
          data: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              organization_id: '11111111-1111-4111-8111-111111111111',
              status: 'accepted',
            },
          ],
          error: null,
        }
      }

      return { data: [], error: null }
    })

    await expect(
      updateBudgetStatus('22222222-2222-4222-8222-222222222222', 'accepted'),
    ).resolves.toEqual({
      id: '22222222-2222-4222-8222-222222222222',
      organization_id: '11111111-1111-4111-8111-111111111111',
      status: 'accepted',
    })

    const updateQuery = fromMock.mock.results
      .map((result) => result.value)
      .find((query) => query.operation === 'update')
    expect(updateQuery.payload).toEqual({ status: 'accepted' })
    expect(updateQuery.filters).toEqual([
      { column: 'id', value: '22222222-2222-4222-8222-222222222222' },
      { column: 'organization_id', value: '11111111-1111-4111-8111-111111111111' },
    ])
    expect(organizationService.ensureCurrentOrganization).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('rechaza un estado invalido sin escribir', async () => {
    await expect(
      updateBudgetStatus('22222222-2222-4222-8222-222222222222', 'archived'),
    ).rejects.toThrow('no es valido')

    expect(fromMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('no crea una organizacion si no hay una sesion con membresia activa', async () => {
    vi.mocked(organizationService.getCurrentOrganization).mockResolvedValueOnce(null)

    await expect(
      updateBudgetStatus('22222222-2222-4222-8222-222222222222', 'accepted'),
    ).rejects.toThrow('No se encontro una organizacion activa')

    expect(fromMock).not.toHaveBeenCalled()
    expect(organizationService.ensureCurrentOrganization).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('rechaza un presupuesto inexistente o inaccesible sin crear uno nuevo', async () => {
    queryHandler.mockResolvedValue({ data: [], error: null })

    await expect(
      updateBudgetStatus('22222222-2222-4222-8222-222222222222', 'accepted'),
    ).rejects.toThrow('No se actualizo el presupuesto solicitado.')

    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('propaga el fallo del servidor al actualizar el estado', async () => {
    queryHandler.mockResolvedValue({ data: null, error: new Error('fallo update') })

    await expect(
      updateBudgetStatus('22222222-2222-4222-8222-222222222222', 'accepted'),
    ).rejects.toThrow('fallo update')

    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('propaga errores de la RPC y no intenta inserts directos en budgets', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('fallo rpc') })

    await expect(
      createBudget({
        budgetNumber: 'PR-2026-0001',
        chapters: [],
        clientData: {},
        conditions: {},
        generalData: { number: 'PR-2026-0001' },
      }),
    ).rejects.toThrow('fallo rpc')

    expect(rpcMock).toHaveBeenCalledTimes(1)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBudget, updateBudget } from './budgetService'

vi.mock('./organizationService', () => ({
  ensureCurrentOrganization: vi.fn(() =>
    Promise.resolve({ id: '11111111-1111-4111-8111-111111111111', name: 'Org' }),
  ),
}))

const rpcMock = vi.fn()
const queryHandler = vi.fn()

class Query {
  constructor(table) {
    this.table = table
    this.filters = []
  }

  select() {
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
    return Promise.resolve(queryHandler(this.table, this.filters)).then(resolve, reject)
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
    queryHandler.mockImplementation((table) => {
      if (table === 'budgets') {
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
    queryHandler.mockImplementation((table, filters) => {
      if (table === 'budgets') {
        if (
          filters.some(
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

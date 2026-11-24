import { getNextBudgetNumber } from '../../utils/budgetNumber'
import { BUDGET_STATUSES, normalizeStoredBudget } from '../budgetStorage'
import {
  createClientId,
  isUuid,
  mapBudgetFromRows,
  mapBudgetToPayload,
} from './budgetMappers'
import { ensureCurrentOrganization, getCurrentOrganization } from './organizationService'
import { requireSupabase } from './supabaseServiceUtils'

async function fetchBudgetRows(client, organizationId, budgetId = null) {
  let budgetQuery = client
    .from('budgets')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (budgetId) {
    budgetQuery = budgetQuery.eq('id', budgetId)
  }

  const { data: budgetRows, error: budgetError } = await budgetQuery
  if (budgetError) throw budgetError

  const budgetIds = (budgetRows || []).map((budget) => budget.id)
  if (budgetIds.length === 0) {
    return []
  }

  const { data: chapterRows, error: chapterError } = await client
    .from('budget_chapters')
    .select('*')
    .in('budget_id', budgetIds)
    .order('position', { ascending: true })
  if (chapterError) throw chapterError

  const chapterIds = (chapterRows || []).map((chapter) => chapter.id)
  const { data: itemRows, error: itemError } = chapterIds.length
    ? await client
        .from('budget_items')
        .select('*')
        .in('chapter_id', chapterIds)
        .order('position', { ascending: true })
    : { data: [], error: null }
  if (itemError) throw itemError

  return budgetRows.map((budget) =>
    mapBudgetFromRows(budget, chapterRows || [], itemRows || []),
  )
}

export async function listBudgets() {
  const client = requireSupabase()
  const organization = await ensureCurrentOrganization()
  return fetchBudgetRows(client, organization.id)
}

export async function getBudgetById(id) {
  const client = requireSupabase()
  const organization = await ensureCurrentOrganization()
  const budgets = await fetchBudgetRows(client, organization.id, id)
  return budgets[0] || null
}

export async function createBudget(budget) {
  const client = requireSupabase()
  const organization = await ensureCurrentOrganization()
  const existingBudget = isUuid(budget.id) ? await getBudgetById(budget.id) : null
  const budgetNumber = existingBudget
    ? existingBudget.budgetNumber
    : budget.budgetNumber || budget.generalData?.number || ''
  const normalizedBudget = normalizeStoredBudget({
    ...budget,
    id: budget.id || createClientId(),
    budgetNumber,
    generalData: {
      ...(budget.generalData || {}),
      number: budgetNumber,
    },
  })
  const payload = mapBudgetToPayload(normalizedBudget, organization.id)
  if (!existingBudget) {
    payload.budget.id = null
  }
  const { data, error } = await client.rpc('save_budget_with_details', {
    payload,
  })

  if (error) {
    throw error
  }

  if (!data?.id) {
    throw new Error('No se pudo guardar el presupuesto.')
  }

  return getBudgetById(data.id)
}

export async function updateBudget(id, changes) {
  const existingBudget = await getBudgetById(id)

  if (!existingBudget) {
    throw new Error('No se encontro el presupuesto que se quiere actualizar.')
  }

  return createBudget({
    ...existingBudget,
    ...changes,
    id,
    clientData: {
      ...existingBudget.clientData,
      ...(changes.clientData || {}),
    },
    conditions: {
      ...existingBudget.conditions,
      ...(changes.conditions || {}),
    },
    generalData: {
      ...existingBudget.generalData,
      ...(changes.generalData || {}),
    },
    technicalReport: {
      ...existingBudget.technicalReport,
      ...(changes.technicalReport || {}),
    },
  })
}

export async function updateBudgetStatus(id, status) {
  if (!BUDGET_STATUSES.includes(status)) {
    throw new Error('El estado del presupuesto no es valido.')
  }

  const client = requireSupabase()
  const organization = await getCurrentOrganization()

  if (!organization?.id) {
    throw new Error('No se encontro una organizacion activa para actualizar el presupuesto.')
  }

  const { data, error } = await client
    .from('budgets')
    .update({ status })
    .eq('id', id)
    .eq('organization_id', organization.id)
    .select('id, status, organization_id')

  if (error) {
    throw error
  }

  if (
    !Array.isArray(data) ||
    data.length !== 1 ||
    data[0].id !== id ||
    data[0].status !== status ||
    data[0].organization_id !== organization.id
  ) {
    throw new Error('No se actualizo el presupuesto solicitado.')
  }

  return data[0]
}

export async function deleteBudget(id) {
  const client = requireSupabase()
  const { error } = await client.from('budgets').delete().eq('id', id)

  if (error) {
    throw error
  }
}

export async function duplicateBudget(id) {
  const budgets = await listBudgets()
  const originalBudget = budgets.find((budget) => budget.id === id)

  if (!originalBudget) {
    return null
  }

  const budgetNumber = getNextBudgetNumber(budgets)
  return createBudget({
    ...originalBudget,
    id: createClientId(),
    budgetNumber,
    status: 'draft',
    generalData: {
      ...originalBudget.generalData,
      number: budgetNumber,
    },
  })
}

export async function replaceBudgets(importedBudgets) {
  const client = requireSupabase()
  const organization = await ensureCurrentOrganization()
  const { error } = await client
    .from('budgets')
    .delete()
    .eq('organization_id', organization.id)

  if (error) throw error

  const savedBudgets = []
  for (const budget of importedBudgets) {
    savedBudgets.push(await createBudget(budget))
  }

  return savedBudgets
}

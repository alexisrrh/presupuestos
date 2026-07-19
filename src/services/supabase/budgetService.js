import { getNextBudgetNumber } from '../../utils/budgetNumber'
import { normalizeStoredBudget } from '../budgetStorage'
import {
  createClientId,
  mapBudgetFromRows,
  mapBudgetToPayload,
} from './budgetMappers'
import { ensureCurrentOrganization } from './organizationService'
import { getCurrentUserId, requireSupabase } from './supabaseServiceUtils'

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

async function saveWithFallback(client, organizationId, userId, budget) {
  const payload = mapBudgetToPayload(budget, organizationId)
  const budgetRow = {
    ...payload.budget,
    created_by: userId,
  }
  if (!budgetRow.id) {
    delete budgetRow.id
  }

  const { data: savedBudget, error: budgetError } = await client
    .from('budgets')
    .upsert(budgetRow, { onConflict: 'id' })
    .select('*')
    .single()

  if (budgetError) throw budgetError

  const { data: existingChapters, error: existingChapterError } = await client
    .from('budget_chapters')
    .select('id')
    .eq('budget_id', savedBudget.id)
  if (existingChapterError) throw existingChapterError

  if (existingChapters?.length) {
    const { error: deleteItemsError } = await client
      .from('budget_items')
      .delete()
      .in(
        'chapter_id',
        existingChapters.map((chapter) => chapter.id),
      )
    if (deleteItemsError) throw deleteItemsError
  }

  const { error: deleteChaptersError } = await client
    .from('budget_chapters')
    .delete()
    .eq('budget_id', savedBudget.id)
  if (deleteChaptersError) throw deleteChaptersError

  for (const chapter of payload.chapters) {
    const { items, ...chapterRow } = chapter
    if (!chapterRow.id) {
      delete chapterRow.id
    }
    const { data: savedChapter, error: chapterError } = await client
      .from('budget_chapters')
      .insert({
        ...chapterRow,
        budget_id: savedBudget.id,
        organization_id: organizationId,
      })
      .select('*')
      .single()

    if (chapterError) throw chapterError

    if (items.length) {
      const { error: itemsError } = await client.from('budget_items').insert(
        items.map((item) => ({
          ...Object.fromEntries(
            Object.entries(item).filter(([key, value]) => key !== 'id' || value),
          ),
          chapter_id: savedChapter.id,
          organization_id: organizationId,
        })),
      )
      if (itemsError) throw itemsError
    }
  }

  return getBudgetById(savedBudget.id)
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
  const userId = await getCurrentUserId(client)
  const budgetNumber = budget.budgetNumber || budget.generalData?.number
  const normalizedBudget = normalizeStoredBudget({
    ...budget,
    id: budget.id || createClientId(),
    budgetNumber,
  })
  const payload = mapBudgetToPayload(normalizedBudget, organization.id)
  const { data, error } = await client.rpc('save_budget_with_details', {
    payload: {
      ...payload,
      budget: { ...payload.budget, created_by: userId },
    },
  })

  if (!error && data?.id) {
    const savedBudget = await getBudgetById(data.id)
    if (savedBudget) {
      return savedBudget
    }
  }

  return saveWithFallback(client, organization.id, userId, normalizedBudget)
}

export async function updateBudget(id, budget) {
  return createBudget({ ...budget, id })
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

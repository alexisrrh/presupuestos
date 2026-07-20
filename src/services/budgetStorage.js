import { getNextBudgetNumber } from '../utils/budgetNumber'
import {
  normalizeDocumentType,
  normalizeTechnicalReport,
} from '../utils/professionalBudgetHelpers'

// Almacenamiento local temporal: se mantiene como respaldo durante la migracion
// progresiva a Supabase. No sincroniza ni sube datos remotos automaticamente.
export const BUDGETS_STORAGE_KEY = 'priteca_budgets'
export const BUDGET_STATUSES = ['draft', 'sent', 'accepted', 'rejected']

function createId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`
}

function getStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage
}

function readBudgets() {
  const storage = getStorage()

  if (!storage) {
    return []
  }

  try {
    const parsed = JSON.parse(storage.getItem(BUDGETS_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeBudgets(budgets) {
  const storage = getStorage()

  if (!storage) {
    return budgets
  }

  storage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(budgets))
  return budgets
}

function getNowIso() {
  return new Date().toISOString()
}

function normalizeStatus(status) {
  return BUDGET_STATUSES.includes(status) ? status : 'draft'
}

export function normalizeStoredBudget(budget = {}, existingBudget) {
  const now = getNowIso()
  const id = budget.id || existingBudget?.id || createId()
  const budgetNumber =
    budget.budgetNumber || budget.generalData?.number || existingBudget?.budgetNumber || ''
  const createdAt = existingBudget?.createdAt || budget.createdAt || now
  const updatedAt = now
  const discountPercentage =
    budget.discountPercentage ?? budget.summary?.discountPercent ?? existingBudget?.discountPercentage ?? '0'
  const vatPercentage =
    budget.vatPercentage ?? budget.summary?.ivaPercent ?? existingBudget?.vatPercentage ?? '21'

  return {
    id,
    budgetNumber,
    clientId: budget.clientId || existingBudget?.clientId,
    documentType: normalizeDocumentType(
      budget.documentType || existingBudget?.documentType,
    ),
    status: normalizeStatus(budget.status || existingBudget?.status),
    createdAt,
    updatedAt,
    generalData: {
      ...(existingBudget?.generalData || {}),
      ...(budget.generalData || {}),
      number: budgetNumber,
    },
    clientData: {
      ...(existingBudget?.clientData || {}),
      ...(budget.clientData || {}),
    },
    chapters: budget.chapters || existingBudget?.chapters || [],
    conditions: {
      ...(existingBudget?.conditions || {}),
      ...(budget.conditions || {}),
    },
    discountPercentage,
    technicalReport: normalizeTechnicalReport(
      budget.technicalReport || existingBudget?.technicalReport,
    ),
    vatPercentage,
  }
}

export function getBudgets() {
  return readBudgets().map((budget) => ({
    ...budget,
    documentType: normalizeDocumentType(budget.documentType),
    technicalReport: normalizeTechnicalReport(budget.technicalReport),
  }))
}

export function getBudgetById(id) {
  return getBudgets().find((budget) => budget.id === id) || null
}

export function saveBudget(budget) {
  const budgets = getBudgets()
  const existingBudget = budgets.find((current) => current.id === budget.id)
  const budgetNumber =
    budget.budgetNumber || budget.generalData?.number || getNextBudgetNumber(budgets)
  const normalizedBudget = normalizeStoredBudget({ ...budget, budgetNumber }, existingBudget)
  const nextBudgets = budgets
    .filter((current) => current.id !== normalizedBudget.id)
    .concat(normalizedBudget)

  writeBudgets(nextBudgets)
  return normalizedBudget
}

export function updateBudget(id, changes) {
  const existingBudget = getBudgetById(id)

  if (!existingBudget) {
    return null
  }

  return saveBudget({ ...existingBudget, ...changes, id })
}

export function deleteBudget(id) {
  const nextBudgets = getBudgets().filter((budget) => budget.id !== id)
  writeBudgets(nextBudgets)
  return nextBudgets
}

export function duplicateBudget(id) {
  const budgets = getBudgets()
  const originalBudget = budgets.find((budget) => budget.id === id)

  if (!originalBudget) {
    return null
  }

  const budgetNumber = getNextBudgetNumber(budgets)
  const duplicatedBudget = normalizeStoredBudget({
    ...originalBudget,
    id: createId(),
    budgetNumber,
    status: 'draft',
    createdAt: undefined,
    updatedAt: undefined,
    generalData: {
      ...originalBudget.generalData,
      number: budgetNumber,
    },
  })

  writeBudgets(budgets.concat(duplicatedBudget))
  return duplicatedBudget
}

export function clearBudgets() {
  writeBudgets([])
  return []
}

import {
  BUDGETS_STORAGE_KEY,
  getBudgets as getLocalBudgets,
} from '../budgetStorage'
import {
  COMPANY_SETTINGS_STORAGE_KEY,
  getCompanySettings as getLocalCompanySettings,
} from '../companySettingsStorage'
import * as budgetService from './budgetService'
import * as companyService from './companyService'
import { isUuid } from './budgetMappers'

export function getMigrationKey(userId) {
  return `priteca_supabase_migration_v1_${userId}`
}

function getStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage
}

export function isMigrationCompleted(userId) {
  return getStorage()?.getItem(getMigrationKey(userId)) === 'completed'
}

export function markMigrationCompleted(userId) {
  getStorage()?.setItem(getMigrationKey(userId), 'completed')
}

export function getLocalMigrationSummary(userId) {
  if (!userId || isMigrationCompleted(userId)) {
    return { hasData: false, budgets: [], companySettings: null }
  }

  const budgets = getLocalBudgets()
  const companySettings = getLocalCompanySettings()
  const hasSettings = Boolean(getStorage()?.getItem(COMPANY_SETTINGS_STORAGE_KEY))

  return {
    hasData: budgets.length > 0 || hasSettings,
    budgets,
    companySettings: hasSettings ? companySettings : null,
  }
}

export async function migrateLocalDataToSupabase(userId) {
  const summary = getLocalMigrationSummary(userId)

  if (!summary.hasData) {
    markMigrationCompleted(userId)
    return { importedBudgets: 0, importedSettings: false }
  }

  if (summary.companySettings) {
    await companyService.saveCompanySettings(summary.companySettings)
  }

  const remoteBudgets = await budgetService.listBudgets()
  const remoteNumbers = new Set(remoteBudgets.map((budget) => budget.budgetNumber))
  let importedBudgets = 0

  for (const budget of summary.budgets) {
    if (remoteNumbers.has(budget.budgetNumber)) {
      continue
    }

    await budgetService.createBudget({
      ...budget,
      id: isUuid(budget.id) ? budget.id : undefined,
    })
    importedBudgets += 1
  }

  markMigrationCompleted(userId)
  return { importedBudgets, importedSettings: Boolean(summary.companySettings) }
}

export function omitLocalMigration(userId) {
  markMigrationCompleted(userId)
}

export function clearMigratedLocalBusinessData() {
  const storage = getStorage()

  if (!storage) {
    return
  }

  storage.removeItem(BUDGETS_STORAGE_KEY)
  storage.removeItem(COMPANY_SETTINGS_STORAGE_KEY)
}


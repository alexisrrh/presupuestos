import {
  BUDGETS_STORAGE_KEY,
  getBudgets,
  normalizeStoredBudget,
} from './budgetStorage'
import {
  COMPANY_SETTINGS_STORAGE_KEY,
  getCompanySettings,
  saveCompanySettings,
} from './companySettingsStorage'
import * as supabaseBudgetService from './supabase/budgetService'
import * as supabaseCompanyService from './supabase/companyService'

export const BACKUP_VERSION = 1

function getStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage
}

function todayForFileName() {
  return new Date().toISOString().slice(0, 10)
}

function parseBackup(data) {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      throw new Error('El archivo JSON no es valido.')
    }
  }

  return data
}

function normalizeBudgets(budgets) {
  const seenIds = new Set()

  return budgets.reduce((result, budget) => {
    const normalizedBudget = normalizeStoredBudget(budget)

    if (!normalizedBudget.id || seenIds.has(normalizedBudget.id)) {
      return result
    }

    seenIds.add(normalizedBudget.id)
    result.push(normalizedBudget)
    return result
  }, [])
}

export function createBackupData() {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    companySettings: getCompanySettings(),
    budgets: getBudgets(),
  }
}

async function createRemoteBackupData() {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    companySettings: await supabaseCompanyService.getCompanySettings(),
    budgets: await supabaseBudgetService.listBudgets(),
  }
}

function downloadBackupFile(backup) {
  if (typeof document === 'undefined') {
    return
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `priteca-backup-${todayForFileName()}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export function exportBackup({ download = true, remote = false } = {}) {
  if (remote) {
    return createRemoteBackupData().then((backup) => {
      if (download) {
        downloadBackupFile(backup)
      }

      return backup
    })
  }

  const backup = createBackupData()

  if (download) {
    downloadBackupFile(backup)
  }

  return backup
}

export function validateBackup(data) {
  const parsedBackup = parseBackup(data)

  if (!parsedBackup || typeof parsedBackup !== 'object' || Array.isArray(parsedBackup)) {
    throw new Error('La copia de seguridad no tiene una estructura valida.')
  }

  if (parsedBackup.version !== BACKUP_VERSION) {
    throw new Error('La version de la copia de seguridad no es compatible.')
  }

  const budgets = parsedBackup.budgets
  if (budgets !== undefined && !Array.isArray(budgets)) {
    throw new Error('La lista de presupuestos de la copia no es valida.')
  }

  const companySettings = parsedBackup.companySettings
  if (
    companySettings !== undefined &&
    companySettings !== null &&
    (typeof companySettings !== 'object' || Array.isArray(companySettings))
  ) {
    throw new Error('La configuracion de empresa de la copia no es valida.')
  }

  return {
    version: BACKUP_VERSION,
    exportedAt: parsedBackup.exportedAt || '',
    companySettings: companySettings || null,
    budgets: normalizeBudgets(budgets || []),
  }
}

function writeBudgets(budgets) {
  const storage = getStorage()

  if (storage) {
    storage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(budgets))
  }
}

function mergeBudgets(currentBudgets, importedBudgets) {
  const existingIds = new Set(currentBudgets.map((budget) => budget.id))
  const newBudgets = importedBudgets.filter((budget) => !existingIds.has(budget.id))
  return currentBudgets.concat(newBudgets)
}

export function importBackup(data, mode = 'merge') {
  if (data?.remote) {
    return importRemoteBackup(data.backup, mode)
  }

  const storage = getStorage()
  const validatedBackup = validateBackup(data)
  const previousBudgets = storage?.getItem(BUDGETS_STORAGE_KEY) || null
  const previousSettings = storage?.getItem(COMPANY_SETTINGS_STORAGE_KEY) || null

  try {
    if (validatedBackup.companySettings) {
      saveCompanySettings(validatedBackup.companySettings)
    }

    if (mode === 'replace') {
      writeBudgets(validatedBackup.budgets)
    } else if (mode === 'merge') {
      writeBudgets(mergeBudgets(getBudgets(), validatedBackup.budgets))
    } else {
      throw new Error('El modo de importacion no es valido.')
    }

    return {
      budgets: getBudgets(),
      companySettings: getCompanySettings(),
    }
  } catch (error) {
    if (storage) {
      if (previousBudgets === null) {
        storage.removeItem(BUDGETS_STORAGE_KEY)
      } else {
        storage.setItem(BUDGETS_STORAGE_KEY, previousBudgets)
      }

      if (previousSettings === null) {
        storage.removeItem(COMPANY_SETTINGS_STORAGE_KEY)
      } else {
        storage.setItem(COMPANY_SETTINGS_STORAGE_KEY, previousSettings)
      }
    }

    throw error
  }
}

async function importRemoteBackup(data, mode = 'merge') {
  const validatedBackup = validateBackup(data)

  if (validatedBackup.companySettings) {
    await supabaseCompanyService.saveCompanySettings(validatedBackup.companySettings)
  }

  if (mode === 'replace') {
    await supabaseBudgetService.replaceBudgets(validatedBackup.budgets)
  } else if (mode === 'merge') {
    const currentBudgets = await supabaseBudgetService.listBudgets()
    const currentIds = new Set(currentBudgets.map((budget) => budget.id))
    const budgetsToImport = validatedBackup.budgets.filter(
      (budget) => !currentIds.has(budget.id),
    )

    for (const budget of budgetsToImport) {
      await supabaseBudgetService.createBudget(budget)
    }
  } else {
    throw new Error('El modo de importacion no es valido.')
  }

  return {
    budgets: await supabaseBudgetService.listBudgets(),
    companySettings: await supabaseCompanyService.getCompanySettings(),
  }
}

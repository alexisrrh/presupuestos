import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BUDGETS_STORAGE_KEY } from '../budgetStorage'
import { COMPANY_SETTINGS_STORAGE_KEY } from '../companySettingsStorage'
import {
  clearMigratedLocalBusinessData,
  getLocalMigrationSummary,
  getMigrationKey,
  isMigrationCompleted,
  migrateLocalDataToSupabase,
  omitLocalMigration,
} from './migrationService'
import * as budgetService from './budgetService'
import * as companyService from './companyService'

vi.mock('./budgetService', () => ({
  createBudget: vi.fn(),
  listBudgets: vi.fn(),
}))

vi.mock('./companyService', () => ({
  saveCompanySettings: vi.fn(),
}))

function createStorageMock() {
  let store = {}

  return {
    clear: vi.fn(() => {
      store = {}
    }),
    getItem: vi.fn((key) => store[key] || null),
    removeItem: vi.fn((key) => {
      delete store[key]
    }),
    setItem: vi.fn((key, value) => {
      store[key] = String(value)
    }),
  }
}

describe('migrationService', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock())
    vi.mocked(budgetService.createBudget).mockResolvedValue({})
    vi.mocked(budgetService.listBudgets).mockResolvedValue([])
    vi.mocked(companyService.saveCompanySettings).mockResolvedValue({})
  })

  it('detecta migracion sin datos locales', () => {
    expect(getLocalMigrationSummary('user-1').hasData).toBe(false)
  })

  it('migra datos validos', async () => {
    localStorage.setItem(
      BUDGETS_STORAGE_KEY,
      JSON.stringify([{ id: 'local', budgetNumber: 'PR-2026-0001' }]),
    )
    localStorage.setItem(COMPANY_SETTINGS_STORAGE_KEY, JSON.stringify({ name: 'PRITECA' }))

    const result = await migrateLocalDataToSupabase('user-1')

    expect(result.importedBudgets).toBe(1)
    expect(budgetService.createBudget).toHaveBeenCalledOnce()
    expect(companyService.saveCompanySettings).toHaveBeenCalledOnce()
    expect(isMigrationCompleted('user-1')).toBe(true)
  })

  it('no repite migracion completada', () => {
    omitLocalMigration('user-1')

    expect(getLocalMigrationSummary('user-1').hasData).toBe(false)
  })

  it('maneja datos locales invalidos sin romper', () => {
    localStorage.setItem(BUDGETS_STORAGE_KEY, '{json roto')

    expect(getLocalMigrationSummary('user-1').budgets).toEqual([])
  })

  it('si falla no borra localStorage ni marca completada', async () => {
    localStorage.setItem(
      BUDGETS_STORAGE_KEY,
      JSON.stringify([{ id: 'local', budgetNumber: 'PR-2026-0001' }]),
    )
    vi.mocked(budgetService.createBudget).mockRejectedValue(new Error('fallo'))

    await expect(migrateLocalDataToSupabase('user-1')).rejects.toThrow()
    expect(localStorage.getItem(BUDGETS_STORAGE_KEY)).toBeTruthy()
    expect(localStorage.getItem(getMigrationKey('user-1'))).toBeNull()
  })

  it('elimina copia local despues de migrar si el usuario lo solicita', () => {
    localStorage.setItem(BUDGETS_STORAGE_KEY, '[]')
    localStorage.setItem(COMPANY_SETTINGS_STORAGE_KEY, '{}')

    clearMigratedLocalBusinessData()

    expect(localStorage.getItem(BUDGETS_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(COMPANY_SETTINGS_STORAGE_KEY)).toBeNull()
  })
})


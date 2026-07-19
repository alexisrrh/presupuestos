import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BUDGETS_STORAGE_KEY, saveBudget } from './budgetStorage'
import {
  saveCompanySettings,
} from './companySettingsStorage'
import {
  BACKUP_VERSION,
  createBackupData,
  importBackup,
  validateBackup,
} from './backupService'

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
      if (key === BUDGETS_STORAGE_KEY && value === 'FORZAR_ERROR') {
        throw new Error('storage quota')
      }
      store[key] = String(value)
    }),
  }
}

function createBudget(overrides = {}) {
  return {
    budgetNumber: 'PR-2026-0001',
    chapters: [{ items: [{ quantity: 1, unitPrice: 100 }] }],
    clientData: { name: 'Cliente' },
    conditions: {},
    discountPercentage: '0',
    generalData: { number: 'PR-2026-0001', date: '2026-07-19' },
    status: 'draft',
    vatPercentage: '21',
    ...overrides,
  }
}

describe('backupService', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock())
  })

  it('exporta version y fecha', () => {
    const backup = createBackupData()

    expect(backup.version).toBe(BACKUP_VERSION)
    expect(backup.exportedAt).toBeTruthy()
  })

  it('exporta presupuestos', () => {
    saveBudget(createBudget())

    expect(createBackupData().budgets).toHaveLength(1)
  })

  it('exporta configuracion', () => {
    saveCompanySettings({ name: 'Empresa' })

    expect(createBackupData().companySettings.name).toBe('Empresa')
  })

  it('no exporta informacion sensible', () => {
    const backupText = JSON.stringify(createBackupData()).toLowerCase()

    expect(backupText).not.toContain('password')
    expect(backupText).not.toContain('service_role')
    expect(backupText).not.toContain('access_token')
  })

  it('valida backup correcto', () => {
    const backup = validateBackup({
      version: BACKUP_VERSION,
      exportedAt: '2026-07-19T00:00:00.000Z',
      budgets: [createBudget({ id: '1' })],
      companySettings: { name: 'PRITECA' },
    })

    expect(backup.budgets).toHaveLength(1)
    expect(backup.companySettings.name).toBe('PRITECA')
  })

  it('rechaza JSON corrupto', () => {
    expect(() => validateBackup('{mal json')).toThrow('JSON')
  })

  it('rechaza version incompatible', () => {
    expect(() => validateBackup({ version: 999, budgets: [] })).toThrow('version')
  })

  it('combina sin duplicar IDs', () => {
    saveBudget(createBudget({ id: '1' }))

    importBackup(
      {
        version: BACKUP_VERSION,
        budgets: [createBudget({ id: '1' }), createBudget({ id: '2', budgetNumber: 'PR-2026-0002' })],
      },
      'merge',
    )

    const storedBudgets = JSON.parse(localStorage.getItem(BUDGETS_STORAGE_KEY))
    expect(storedBudgets).toHaveLength(2)
  })

  it('reemplaza datos', () => {
    saveBudget(createBudget({ id: '1' }))

    importBackup(
      {
        version: BACKUP_VERSION,
        budgets: [createBudget({ id: '2', budgetNumber: 'PR-2026-0002' })],
      },
      'replace',
    )

    const storedBudgets = JSON.parse(localStorage.getItem(BUDGETS_STORAGE_KEY))
    expect(storedBudgets).toHaveLength(1)
    expect(storedBudgets[0].id).toBe('2')
  })

  it('restaura en caso de error', () => {
    saveBudget(createBudget({ id: '1' }))
    const previousBudgets = localStorage.getItem(BUDGETS_STORAGE_KEY)

    expect(() =>
      importBackup({ version: BACKUP_VERSION, budgets: [createBudget({ id: '2' })] }, 'invalid'),
    ).toThrow()
    expect(localStorage.getItem(BUDGETS_STORAGE_KEY)).toBe(previousBudgets)
  })

  it('normaliza presupuestos antiguos', () => {
    const backup = validateBackup({
      version: BACKUP_VERSION,
      budgets: [{ id: 'old', budgetNumber: 'PR-2026-0001' }],
    })

    expect(backup.budgets[0].documentType).toBe('quick')
    expect(backup.budgets[0].technicalReport).toBeTruthy()
  })

  it('acepta backup sin presupuestos ni configuracion', () => {
    const backup = validateBackup({ version: BACKUP_VERSION })

    expect(backup.budgets).toEqual([])
    expect(backup.companySettings).toBeNull()
  })
})

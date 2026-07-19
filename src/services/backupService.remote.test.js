import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BACKUP_VERSION, exportBackup, importBackup } from './backupService'
import * as budgetService from './supabase/budgetService'
import * as companyService from './supabase/companyService'

vi.mock('./supabase/budgetService', () => ({
  createBudget: vi.fn(),
  listBudgets: vi.fn(),
  replaceBudgets: vi.fn(),
}))

vi.mock('./supabase/companyService', () => ({
  getCompanySettings: vi.fn(),
  saveCompanySettings: vi.fn(),
}))

describe('backupService remoto', () => {
  beforeEach(() => {
    vi.mocked(budgetService.createBudget).mockResolvedValue({})
    vi.mocked(budgetService.listBudgets).mockResolvedValue([])
    vi.mocked(budgetService.replaceBudgets).mockResolvedValue([])
    vi.mocked(companyService.getCompanySettings).mockResolvedValue({ name: 'PRITECA' })
    vi.mocked(companyService.saveCompanySettings).mockResolvedValue({ name: 'PRITECA' })
  })

  it('exporta backup desde Supabase', async () => {
    vi.mocked(budgetService.listBudgets).mockResolvedValue([
      { id: '1', budgetNumber: 'PR-2026-0001' },
    ])

    const backup = await exportBackup({ download: false, remote: true })

    expect(backup.companySettings.name).toBe('PRITECA')
    expect(backup.budgets).toHaveLength(1)
  })

  it('importa combinando sin duplicar', async () => {
    vi.mocked(budgetService.listBudgets)
      .mockResolvedValueOnce([{ id: '1', budgetNumber: 'PR-2026-0001' }])
      .mockResolvedValueOnce([{ id: '1' }, { id: '2' }])

    await importBackup(
      {
        remote: true,
        backup: {
          version: BACKUP_VERSION,
          budgets: [
            { id: '1', budgetNumber: 'PR-2026-0001' },
            { id: '2', budgetNumber: 'PR-2026-0002' },
          ],
        },
      },
      'merge',
    )

    expect(budgetService.createBudget).toHaveBeenCalledTimes(1)
  })

  it('importa reemplazando datos de la organizacion actual', async () => {
    await importBackup(
      {
        remote: true,
        backup: {
          version: BACKUP_VERSION,
          budgets: [{ id: '2', budgetNumber: 'PR-2026-0002' }],
        },
      },
      'replace',
    )

    expect(budgetService.replaceBudgets).toHaveBeenCalledOnce()
  })
})


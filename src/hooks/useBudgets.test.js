import { describe, expect, it, vi } from 'vitest'
import { updateAndRefreshBudgetStatus } from './useBudgets'

describe('updateAndRefreshBudgetStatus', () => {
  it('usa la operacion especifica y refresca los presupuestos despues de actualizar', async () => {
    const updateStatus = vi.fn().mockResolvedValue({ id: 'budget-1', status: 'accepted' })
    const refreshBudgets = vi.fn().mockResolvedValue([])

    await expect(
      updateAndRefreshBudgetStatus(updateStatus, refreshBudgets, 'budget-1', 'accepted'),
    ).resolves.toEqual({ id: 'budget-1', status: 'accepted' })

    expect(updateStatus).toHaveBeenCalledWith('budget-1', 'accepted')
    expect(refreshBudgets).toHaveBeenCalledOnce()
  })

  it('propaga el error de estado y no refresca ni comunica exito', async () => {
    const updateStatus = vi.fn().mockRejectedValue(new Error('fallo update'))
    const refreshBudgets = vi.fn()

    await expect(
      updateAndRefreshBudgetStatus(updateStatus, refreshBudgets, 'budget-1', 'accepted'),
    ).rejects.toThrow('fallo update')

    expect(refreshBudgets).not.toHaveBeenCalled()
  })
})

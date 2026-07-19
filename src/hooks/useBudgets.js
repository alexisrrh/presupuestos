import { useCallback, useEffect, useState } from 'react'
import * as budgetService from '../services/supabase/budgetService'

function useBudgets(enabled = true) {
  const [budgets, setBudgets] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(enabled))

  const refreshBudgets = useCallback(() => {
    if (!enabled) {
      setBudgets([])
      setLoading(false)
      return Promise.resolve([])
    }

    setLoading(true)
    setError('')
    return budgetService
      .listBudgets()
      .then((nextBudgets) => {
        setBudgets(nextBudgets)
        return nextBudgets
      })
      .catch((nextError) => {
        setError(nextError.message || 'No se pudieron cargar los presupuestos.')
        setBudgets([])
        throw nextError
      })
      .finally(() => setLoading(false))
  }, [enabled])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      refreshBudgets().catch(() => {})
    }, 0)

    return () => window.clearTimeout(timerId)
  }, [refreshBudgets])

  const saveNewBudget = useCallback(
    async (budget) => {
      const savedBudget = await budgetService.createBudget(budget)
      await refreshBudgets()
      return savedBudget
    },
    [refreshBudgets],
  )

  const editBudget = useCallback(
    async (id, changes) => {
      const updatedBudget = await budgetService.updateBudget(id, changes)
      await refreshBudgets()
      return updatedBudget
    },
    [refreshBudgets],
  )

  const removeBudget = useCallback(
    async (id) => {
      await budgetService.deleteBudget(id)
      await refreshBudgets()
    },
    [refreshBudgets],
  )

  const duplicateExistingBudget = useCallback(
    async (id) => {
      const duplicatedBudget = await budgetService.duplicateBudget(id)
      await refreshBudgets()
      return duplicatedBudget
    },
    [refreshBudgets],
  )

  return {
    budgets,
    error,
    duplicateExistingBudget,
    editBudget,
    loading,
    refreshBudgets,
    removeBudget,
    saveNewBudget,
  }
}

export default useBudgets

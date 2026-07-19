const BUDGET_NUMBER_PREFIX = 'PR'

export function getCurrentBudgetYear() {
  return new Date().getFullYear()
}

export function parseBudgetNumber(value) {
  const match = String(value || '').match(/^PR-(\d{4})-(\d{4})$/)

  if (!match) {
    return null
  }

  return {
    year: Number.parseInt(match[1], 10),
    sequence: Number.parseInt(match[2], 10),
  }
}

export function getNextBudgetNumber(budgets = [], year = getCurrentBudgetYear()) {
  const highestSequence = budgets.reduce((highest, budget) => {
    const parsed = parseBudgetNumber(budget.budgetNumber || budget.generalData?.number)

    if (!parsed || parsed.year !== year) {
      return highest
    }

    return Math.max(highest, parsed.sequence)
  }, 0)

  return `${BUDGET_NUMBER_PREFIX}-${year}-${String(highestSequence + 1).padStart(4, '0')}`
}

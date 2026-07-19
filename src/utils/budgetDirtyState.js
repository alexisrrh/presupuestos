import { normalizeDocumentType, normalizeTechnicalReport } from './professionalBudgetHelpers'

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject)
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (['createdAt', 'updatedAt'].includes(key)) {
          return result
        }

        result[key] = sortObject(value[key])
        return result
      }, {})
  }

  return value ?? ''
}

export function createBudgetDirtySnapshot(budget = {}) {
  return JSON.stringify(
    sortObject({
      budgetNumber: budget.budgetNumber || budget.generalData?.number || '',
      chapters: budget.chapters || [],
      clientData: budget.clientData || {},
      conditions: budget.conditions || {},
      discountPercentage:
        budget.discountPercentage ?? budget.summary?.discountPercent ?? '',
      documentType: normalizeDocumentType(budget.documentType),
      generalData: budget.generalData || {},
      status: budget.status || 'draft',
      technicalReport: normalizeTechnicalReport(budget.technicalReport),
      vatPercentage: budget.vatPercentage ?? budget.summary?.ivaPercent ?? '',
    }),
  )
}

export function hasUnsavedChanges(currentBudget, savedSnapshot) {
  if (!currentBudget || !savedSnapshot) {
    return false
  }

  return createBudgetDirtySnapshot(currentBudget) !== savedSnapshot
}


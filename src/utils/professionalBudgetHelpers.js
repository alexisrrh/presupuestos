import { calculateSubtotal } from './budgetCalculations'
import { toNumber } from './budgetCalculations'
import { sanitizeFileName, safeText } from './pdfHelpers'

export const documentTypes = ['quick', 'professional']

export const defaultTechnicalReport = {
  offerObject: '',
  contactPerson: '',
  responsibleTechnician: '',
  executiveSummary: '',
  recommendedSolution: '',
  generalScope: [],
  startingConditions: '',
  estimatedStart: '',
  estimatedDuration: '',
  expectedSchedule: '',
  planningConditions: '',
  economicConditions: [],
  inclusions: [],
  exclusions: [],
  warranty: '',
  closingDocumentation: [],
  customMethodDescription: '',
}

const listFields = [
  'generalScope',
  'economicConditions',
  'inclusions',
  'exclusions',
  'closingDocumentation',
]

export function cleanStringList(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((item) => safeText(item, '').trim()).filter(Boolean)
}

export function normalizeDocumentType(value) {
  return documentTypes.includes(value) ? value : 'quick'
}

export function normalizeTechnicalReport(report = {}, defaults = {}) {
  const merged = {
    ...defaultTechnicalReport,
    ...defaults,
    ...report,
  }

  return Object.keys(defaultTechnicalReport).reduce((normalized, field) => {
    normalized[field] = listFields.includes(field)
      ? cleanStringList(merged[field])
      : safeText(merged[field], '')
    return normalized
  }, {})
}

export function getProfessionalDefaults(settings = {}) {
  return settings.professionalDefaults || {}
}

export function mergeProfessionalDefaults(report, settings) {
  return normalizeTechnicalReport(report, getProfessionalDefaults(settings))
}

export function getItemCode(chapterIndex, itemIndex) {
  return `${String(chapterIndex + 1).padStart(2, '0')}.${String(itemIndex + 1).padStart(2, '0')}`
}

export function buildProfessionalPdfFileName(budgetNumber, clientName) {
  return `${sanitizeFileName(budgetNumber || 'presupuesto')}-${sanitizeFileName(
    clientName || 'cliente',
  )}-profesional.pdf`
}

export function getBudgetDocumentType(budget) {
  return normalizeDocumentType(budget?.documentType)
}

export function getChapterSubtotal(chapter) {
  return calculateSubtotal([chapter])
}

export function combinePartialValues(values, separator = ' / ') {
  const cleanValues = values.map((value) => safeText(value, '').trim()).filter(Boolean)
  return cleanValues.length > 0 ? cleanValues.join(separator) : '-'
}

export function getProfessionalProjectTitle(generalData = {}, report = {}) {
  return safeText(generalData.projectName || report.offerObject, 'Presupuesto de obra')
}

export function formatPercentLabel(label, value) {
  const formattedPercent = toNumber(value).toFixed(2).replace('.', ',')
  return `${label} (${formattedPercent} %)`
}

import { calculateBudgetTotals, calculateItemTotal } from '../../utils/budgetCalculations'
import { LOGO_HORIZONTAL } from '../../config/branding'
import { normalizeStoredBudget } from '../budgetStorage'
import { getChapterSubtotal } from '../../utils/professionalBudgetHelpers'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value) {
  return typeof value === 'string' && uuidPattern.test(value)
}

export function createClientId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`
}

function stripUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefined)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefined(entryValue)]),
    )
  }

  return value
}

function parseNumber(value, fallback = 0) {
  const numberValue = Number.parseFloat(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function parseInteger(value, fallback = 0) {
  const numberValue = Number.parseInt(value, 10)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function normalizeDate(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  const textValue = String(value)
  return textValue.length >= 10 ? textValue.slice(0, 10) : textValue
}

export function mapCompanySettingsFromRow(row = {}) {
  return {
    address: row.address || '',
    defaultDiscount: row.default_discount ?? 0,
    defaultVat: row.default_tax ?? row.default_vat ?? 21,
    defaultValidityDays: row.default_validity_days ?? 30,
    defaultPaymentTerms: row.default_payment_terms || '',
    defaultExecutionTime: row.default_execution_time || '',
    defaultObservations: row.default_observations || '',
    email: row.email || '',
    iban: row.iban || '',
    legalName: row.legal_name || row.business_name || '',
    logo: row.logo_data_url || LOGO_HORIZONTAL,
    logoUrl: row.logo_url || row.logo_path || '',
    name: row.name || row.business_name || 'PRITECA',
    phone: row.phone || '',
    postalCode: row.postal_code || '',
    city: row.city || '',
    province: row.province || '',
    professionalDefaults: row.professional_defaults || {},
    taxId: row.tax_id || '',
    website: row.website || '',
  }
}

export function mapCompanySettingsToRow(settings = {}, organizationId) {
  return stripUndefined({
    address: settings.address || '',
    business_name: settings.name || settings.legalName || 'PRITECA',
    default_discount: parseNumber(settings.defaultDiscount, 0),
    default_execution_time: settings.defaultExecutionTime || '',
    default_observations: settings.defaultObservations || '',
    default_payment_terms: settings.defaultPaymentTerms || '',
    default_tax: parseNumber(settings.defaultVat, 21),
    default_validity_days: parseInteger(settings.defaultValidityDays, 30),
    email: settings.email || '',
    iban: settings.iban || '',
    legal_name: settings.legalName || '',
    logo_data_url: settings.logo?.startsWith?.('data:image/') ? settings.logo : '',
    logo_url: settings.logoUrl || '',
    name: settings.name || 'PRITECA',
    organization_id: organizationId,
    phone: settings.phone || '',
    postal_code: settings.postalCode || '',
    city: settings.city || '',
    province: settings.province || '',
    professional_defaults: settings.professionalDefaults || {},
    tax_id: settings.taxId || '',
    website: settings.website || '',
  })
}

export function mapBudgetToPayload(budget = {}, organizationId) {
  const normalizedBudget = normalizeStoredBudget(budget)
  const totals = calculateBudgetTotals(
    normalizedBudget.chapters,
    normalizedBudget.discountPercentage,
    normalizedBudget.vatPercentage,
  )

  return stripUndefined({
    budget: {
      id: isUuid(normalizedBudget.id) ? normalizedBudget.id : null,
      organization_id: organizationId,
      budget_number: normalizedBudget.budgetNumber,
      title: normalizedBudget.generalData.projectName || '',
      status: normalizedBudget.status,
      document_type: normalizedBudget.documentType,
      client_id: isUuid(normalizedBudget.clientId) ? normalizedBudget.clientId : null,
      client_name: normalizedBudget.clientData.name || '',
      client_tax_id: normalizedBudget.clientData.taxId || '',
      client_email: normalizedBudget.clientData.email || '',
      client_phone: normalizedBudget.clientData.phone || '',
      client_address: normalizedBudget.clientData.address || '',
      project_address: normalizedBudget.generalData.projectAddress || '',
      issue_date: normalizeDate(normalizedBudget.generalData.date),
      validity_days: parseInteger(normalizedBudget.generalData.validityDays, 0),
      notes: normalizedBudget.conditions.notes || '',
      conditions: normalizedBudget.conditions,
      technical_report: normalizedBudget.technicalReport,
      tax_rate: parseNumber(normalizedBudget.vatPercentage, 0),
      discount_rate: parseNumber(normalizedBudget.discountPercentage, 0),
      subtotal: totals.subtotal,
      discount_amount: totals.discountAmount,
      tax_amount: totals.ivaAmount,
      total: totals.total,
    },
    chapters: normalizedBudget.chapters.map((chapter, chapterIndex) => ({
      id: isUuid(chapter.id) ? chapter.id : null,
      title: chapter.name || `Capitulo ${chapterIndex + 1}`,
      description: chapter.description || '',
      position: chapterIndex,
      subtotal: getChapterSubtotal(chapter),
      items: (chapter.items || []).map((item, itemIndex) => ({
        id: isUuid(item.id) ? item.id : null,
        description: item.description || '',
        unit: item.unit || '',
        quantity: parseNumber(item.quantity, 0),
        unit_price: parseNumber(item.unitPrice, 0),
        total: calculateItemTotal(item),
        position: itemIndex,
      })),
    })),
  })
}

export function mapBudgetFromRows(budgetRow = {}, chapterRows = [], itemRows = []) {
  const chapters = chapterRows
    .filter((chapter) => chapter.budget_id === budgetRow.id)
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((chapter) => ({
      id: chapter.id,
      name: chapter.title || chapter.name || '',
      description: chapter.description || '',
      items: itemRows
        .filter((item) => item.chapter_id === chapter.id)
        .sort((a, b) => (a.position || 0) - (b.position || 0))
        .map((item) => ({
          id: item.id,
          description: item.description || '',
          quantity: String(item.quantity ?? ''),
          unit: item.unit || '',
          unitPrice: String(item.unit_price ?? ''),
        })),
    }))

  return normalizeStoredBudget({
    id: budgetRow.id,
    budgetNumber: budgetRow.budget_number,
    clientId: budgetRow.client_id || undefined,
    createdAt: budgetRow.created_at,
    updatedAt: budgetRow.updated_at,
    documentType: budgetRow.document_type,
    status: budgetRow.status,
    generalData: {
      number: budgetRow.budget_number,
      date: budgetRow.issue_date || budgetRow.budget_date || '',
      validityDays: String(budgetRow.validity_days ?? ''),
      projectName: budgetRow.title || budgetRow.project_name || '',
      projectAddress: budgetRow.project_address || '',
    },
    clientData: {
      name: budgetRow.client_name || budgetRow.client_snapshot?.name || '',
      taxId:
        budgetRow.client_tax_id ||
        budgetRow.client_snapshot?.taxId ||
        budgetRow.client_snapshot?.tax_id ||
        '',
      email: budgetRow.client_email || budgetRow.client_snapshot?.email || '',
      phone: budgetRow.client_phone || budgetRow.client_snapshot?.phone || '',
      address: budgetRow.client_address || budgetRow.client_snapshot?.address || '',
    },
    chapters,
    conditions: {
      ...(budgetRow.conditions || {}),
      notes: budgetRow.conditions?.notes ?? budgetRow.notes ?? '',
    },
    discountPercentage: String(
      budgetRow.discount_rate ?? budgetRow.discount_percentage ?? 0,
    ),
    technicalReport: budgetRow.technical_report || {},
    vatPercentage: String(budgetRow.tax_rate ?? budgetRow.vat_percentage ?? 21),
  })
}

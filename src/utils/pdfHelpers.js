import { calculateSubtotal, formatCurrency } from './budgetCalculations'

export function safeText(value, fallback = '-') {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  return String(value)
}

export function filterFilledRows(rows) {
  return rows.filter(([, value]) => safeText(value, '') !== '')
}

export function sanitizeFileName(value) {
  const sanitized = safeText(value, 'cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return sanitized || 'cliente'
}

export function buildBudgetPdfFileName(budgetNumber, clientName) {
  return `${sanitizeFileName(budgetNumber || 'presupuesto')}-${sanitizeFileName(
    clientName || 'cliente',
  )}.pdf`
}

export function formatPdfDate(value) {
  if (!value) {
    return '-'
  }

  const [year, month, day] = String(value).split('-')
  return year && month && day ? `${day}/${month}/${year}` : safeText(value)
}

export function formatPdfCurrency(value) {
  return formatCurrency(value)
}

export function calculateChapterSubtotal(chapter) {
  return calculateSubtotal([chapter])
}

// Format/control-letter validation, not identity verification.
// Source: Ministerio del Interior, Calculo del digito de control del NIF/NIE.
const LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'
export function normalizeSpanishDocument(value) {
  return typeof value === 'string' ? value.toUpperCase().replace(/[\s.-]/g, '') : ''
}
export function validateSpanishDocument(type, value) {
  const document = normalizeSpanishDocument(value)
  if (type !== 'DNI' && type !== 'NIE') return { document, valid: false }
  const match = type === 'DNI'
    ? document.match(/^(\d{8})([A-Z])$/)
    : document.match(/^([XYZ])(\d{7})([A-Z])$/)
  if (!match) return { document, valid: false }
  const number = type === 'DNI' ? match[1] : `${{ X: '0', Y: '1', Z: '2' }[match[1]]}${match[2]}`
  const letter = type === 'DNI' ? match[2] : match[3]
  return { document, valid: LETTERS[Number(number) % 23] === letter }
}

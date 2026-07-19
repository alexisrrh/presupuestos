export function toNumber(value) {
  const numberValue = Number.parseFloat(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

export function calculateItemTotal(item) {
  return toNumber(item.quantity) * toNumber(item.unitPrice)
}

export function calculateSubtotal(chapters) {
  return chapters.reduce((chapterTotal, chapter) => {
    const itemsTotal = chapter.items.reduce(
      (itemsSum, item) => itemsSum + calculateItemTotal(item),
      0,
    )

    return chapterTotal + itemsTotal
  }, 0)
}

export function calculateBudgetTotals(chapters, discountPercent, ivaPercent) {
  const subtotal = calculateSubtotal(chapters)
  const discountAmount = subtotal * (toNumber(discountPercent) / 100)
  const taxableBase = subtotal - discountAmount
  const ivaAmount = taxableBase * (toNumber(ivaPercent) / 100)
  const total = taxableBase + ivaAmount

  return {
    subtotal,
    discountAmount,
    taxableBase,
    ivaAmount,
    total,
  }
}

export function formatCurrency(value) {
  const numberValue = toNumber(value)
  const sign = numberValue < 0 ? '-' : ''
  const [integerPart, decimalPart] = Math.abs(numberValue).toFixed(2).split('.')
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  return `${sign}${groupedInteger},${decimalPart} €`
}

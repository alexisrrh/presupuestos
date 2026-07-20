import { COMPANY_NAME, COMPANY_TAGLINE, LOGO_HORIZONTAL, LOGO_ISOTYPE } from '../config/branding'
import { companyData } from '../data/companyData'
import { filterFilledRows, safeText } from './pdfHelpers'

export const pdfColors = {
  navy: [8, 43, 92],
  navyDark: [6, 31, 66],
  orange: [255, 90, 0],
  orangeSoft: [255, 239, 230],
  blueSoft: [238, 244, 250],
  text: [17, 24, 39],
  muted: [91, 103, 118],
  border: [213, 222, 232],
  lightBorder: [232, 237, 243],
  surface: [248, 250, 252],
  white: [255, 255, 255],
}

export const pdfPage = {
  width: 210,
  height: 297,
  marginX: 16,
  contentTop: 31,
  contentBottom: 268,
  footerLineY: 276,
  footerTextY: 284,
}

export function normalizePdfSettings(companySettings = companyData) {
  return {
    ...companyData,
    ...(companySettings || {}),
    professionalDefaults: {
      ...(companyData.professionalDefaults || {}),
      ...(companySettings?.professionalDefaults || {}),
    },
  }
}

export function getImageFormat(dataUrl) {
  if (dataUrl?.startsWith('data:image/jpeg') || dataUrl?.startsWith('data:image/jpg')) {
    return 'JPEG'
  }

  if (dataUrl?.startsWith('data:image/webp')) {
    return 'WEBP'
  }

  return 'PNG'
}

export function loadImageAsDataUrl(src) {
  if (!src) {
    return Promise.resolve(null)
  }

  if (src.startsWith('data:image/')) {
    return Promise.resolve(src)
  }

  return fetch(src)
    .then((response) => response.blob())
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        }),
    )
    .catch(() => null)
}

function loadImageDimensions(dataUrl) {
  if (!dataUrl || typeof Image === 'undefined') {
    return Promise.resolve({ width: 1, height: 1 })
  }

  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 })
    image.onerror = () => resolve({ width: 1, height: 1 })
    image.src = dataUrl
  })
}

export async function loadPdfImage(src) {
  const dataUrl = await loadImageAsDataUrl(src)
  if (!dataUrl) {
    return null
  }

  const dimensions = await loadImageDimensions(dataUrl)
  return {
    dataUrl,
    format: getImageFormat(dataUrl),
    ...dimensions,
  }
}

export async function loadLogoWithFallback(settings) {
  const logoSources = [
    settings.logo || settings.logoUrl,
    LOGO_HORIZONTAL,
    LOGO_ISOTYPE,
  ].filter(Boolean)

  for (const source of logoSources) {
    const image = await loadPdfImage(source)
    if (image) {
      return image
    }
  }

  return null
}

export function drawImageContained(doc, image, x, y, maxWidth, maxHeight) {
  if (!image?.dataUrl) {
    return
  }

  const scale = Math.min(maxWidth / image.width, maxHeight / image.height)
  const width = image.width * scale
  const height = image.height * scale
  const offsetX = x + (maxWidth - width) / 2
  const offsetY = y + (maxHeight - height) / 2

  doc.addImage(image.dataUrl, image.format, offsetX, offsetY, width, height)
}

export function ensurePdfSpace(doc, y, neededHeight, top = pdfPage.contentTop) {
  if (y + neededHeight <= pdfPage.contentBottom) {
    return y
  }

  doc.addPage()
  return top
}

export function addPdfPage(doc) {
  doc.addPage()
  return pdfPage.contentTop
}

export function drawSectionTitle(doc, number, title, y, options = {}) {
  const nextY = ensurePdfSpace(doc, y, options.neededHeight || 17)
  const label = number ? `${number}. ` : ''

  doc.setFillColor(...pdfColors.white)
  doc.setDrawColor(...pdfColors.lightBorder)
  doc.roundedRect(pdfPage.marginX, nextY - 6, pdfPage.width - pdfPage.marginX * 2, 12, 1.2, 1.2, 'S')
  doc.setFillColor(...pdfColors.orange)
  doc.rect(pdfPage.marginX, nextY - 6, 2.2, 12, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(options.fontSize || 10.5)
  doc.setTextColor(...pdfColors.navy)
  doc.text(`${label}${safeText(title)}`.toUpperCase(), pdfPage.marginX + 5, nextY + 1.8)

  return nextY + 11
}

export function drawKeyValueGrid(doc, rows, y, options = {}) {
  const body = filterFilledRows(rows)
  if (body.length === 0) {
    return y
  }

  const x = options.x || pdfPage.marginX
  const width = options.width || pdfPage.width - pdfPage.marginX * 2
  const labelWidth = options.labelWidth || 39
  const rowHeight = options.rowHeight || 7.2
  let cursorY = ensurePdfSpace(doc, y, body.length * rowHeight + 3)

  body.forEach(([label, value], index) => {
    cursorY = ensurePdfSpace(doc, cursorY, rowHeight)
    if (index % 2 === 0) {
      doc.setFillColor(...pdfColors.surface)
      doc.rect(x, cursorY - 4.8, width, rowHeight, 'F')
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.8)
    doc.setTextColor(...pdfColors.muted)
    doc.text(safeText(label).toUpperCase(), x + 2.2, cursorY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...pdfColors.text)
    doc.text(doc.splitTextToSize(safeText(value), width - labelWidth - 4), x + labelWidth, cursorY)
    cursorY += rowHeight
  })

  return cursorY + 2
}

export function drawParagraph(doc, text, y, options = {}) {
  const cleanText = safeText(text, '').trim()
  if (!cleanText) {
    return y
  }

  const x = options.x || pdfPage.marginX
  const width = options.width || pdfPage.width - pdfPage.marginX * 2
  const lineHeight = options.lineHeight || 4.6
  const lines = doc.splitTextToSize(cleanText, width)
  let cursorY = ensurePdfSpace(doc, y, lines.length * lineHeight + 2)

  doc.setFont('helvetica', options.bold ? 'bold' : 'normal')
  doc.setFontSize(options.fontSize || 8.8)
  doc.setTextColor(...(options.color || pdfColors.text))
  doc.text(lines, x, cursorY)

  return cursorY + lines.length * lineHeight + 3
}

export function drawCorporateHeaderFooter(doc, settings, logoImage, options = {}) {
  const totalPages = doc.getNumberOfPages()
  const reference = safeText(options.reference, '')

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber)
    doc.setFillColor(...pdfColors.white)
    doc.rect(0, 0, pdfPage.width, 20, 'F')
    doc.setFillColor(...pdfColors.navy)
    doc.rect(0, 0, pdfPage.width, 4.2, 'F')
    doc.setFillColor(...pdfColors.orange)
    doc.rect(0, 4.2, pdfPage.width, 0.8, 'F')

    if (logoImage) {
      drawImageContained(doc, logoImage, pdfPage.marginX, 8, 39, 13)
    } else {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...pdfColors.navy)
      doc.text(COMPANY_NAME, pdfPage.marginX, 16)
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...pdfColors.muted)
    doc.text(COMPANY_TAGLINE, pdfPage.width - pdfPage.marginX, 15, { align: 'right' })

    doc.setDrawColor(...pdfColors.lightBorder)
    doc.line(pdfPage.marginX, 23.5, pdfPage.width - pdfPage.marginX, 23.5)

    doc.setDrawColor(...pdfColors.lightBorder)
    doc.line(pdfPage.marginX, pdfPage.footerLineY, pdfPage.width - pdfPage.marginX, pdfPage.footerLineY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...pdfColors.muted)
    doc.text(safeText(settings.legalName || settings.name || COMPANY_NAME), pdfPage.marginX, pdfPage.footerTextY)

    const contact = [settings.website, settings.phone, settings.email].filter(Boolean).join(' | ')
    const pageText = `Pagina ${pageNumber} de ${totalPages}`
    doc.text(
      [reference, contact, pageText].filter(Boolean).join('  |  '),
      pdfPage.width - pdfPage.marginX,
      pdfPage.footerTextY,
      { align: 'right' },
    )
  }
}

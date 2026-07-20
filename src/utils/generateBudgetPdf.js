import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  drawCorporateHeaderFooter,
  drawImageContained,
  drawKeyValueGrid,
  drawParagraph,
  drawSectionTitle,
  ensurePdfSpace,
  loadLogoWithFallback,
  normalizePdfSettings,
  pdfColors,
  pdfPage,
} from './pdfBranding'
import {
  calculateItemTotal,
  formatCurrency,
  toNumber,
} from './budgetCalculations'
import {
  buildBudgetPdfFileName,
  calculateChapterSubtotal,
  filterFilledRows,
  formatPdfDate,
  safeText,
} from './pdfHelpers'

function addDocumentIntro(doc, budget, settings, logoImage) {
  const generalData = budget.generalData || {}
  const clientData = budget.clientData || {}
  let y = pdfPage.contentTop

  doc.setFillColor(...pdfColors.surface)
  doc.roundedRect(pdfPage.marginX, y, pdfPage.width - pdfPage.marginX * 2, 34, 1.6, 1.6, 'F')
  doc.setFillColor(...pdfColors.orange)
  doc.rect(pdfPage.marginX, y, 2.4, 34, 'F')

  if (logoImage) {
    drawImageContained(doc, logoImage, pdfPage.marginX + 7, y + 6, 43, 16)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...pdfColors.navy)
  doc.text('PRESUPUESTO TECNICO', pdfPage.width - pdfPage.marginX - 4, y + 11, {
    align: 'right',
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...pdfColors.muted)
  doc.text(
    `Referencia ${safeText(generalData.number)} | Emision ${formatPdfDate(generalData.date)}`,
    pdfPage.width - pdfPage.marginX - 4,
    y + 18,
    { align: 'right' },
  )
  doc.text(
    `Validez ${safeText(generalData.validityDays)} dias`,
    pdfPage.width - pdfPage.marginX - 4,
    y + 24,
    { align: 'right' },
  )

  y += 43
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...pdfColors.text)
  doc.text(safeText(generalData.projectName, 'Presupuesto de obra'), pdfPage.marginX, y)

  y = drawParagraph(doc, generalData.projectAddress, y + 7, {
    color: pdfColors.muted,
    fontSize: 8.5,
  })

  const leftRows = filterFilledRows([
    ['Cliente', clientData.name],
    ['NIF/CIF', clientData.taxId],
    ['Contacto', [clientData.phone, clientData.email].filter(Boolean).join(' | ')],
    ['Direccion', clientData.address],
  ])
  const rightRows = filterFilledRows([
    ['Empresa', settings.legalName || settings.name],
    ['CIF', settings.taxId],
    ['Contacto', [settings.phone, settings.email].filter(Boolean).join(' | ')],
    ['Web', settings.website],
  ])

  y = ensurePdfSpace(doc, y + 2, 42)
  const gridTop = y
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...pdfColors.navy)
  doc.text('DATOS DEL CLIENTE', pdfPage.marginX, gridTop)
  doc.text('DATOS CORPORATIVOS', 112, gridTop)
  drawKeyValueGrid(doc, leftRows, gridTop + 7, { width: 82, labelWidth: 27 })
  drawKeyValueGrid(doc, rightRows, gridTop + 7, { x: 112, width: 82, labelWidth: 27 })

  return gridTop + Math.max(leftRows.length, rightRows.length) * 7.2 + 18
}

function addChapterTitle(doc, chapter, chapterIndex, y) {
  const cursorY = ensurePdfSpace(doc, y, 14)
  doc.setFillColor(...pdfColors.blueSoft)
  doc.roundedRect(pdfPage.marginX, cursorY - 4, pdfPage.width - pdfPage.marginX * 2, 10, 1.3, 1.3, 'F')
  doc.setFillColor(...pdfColors.orange)
  doc.rect(pdfPage.marginX, cursorY - 4, 2.2, 10, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...pdfColors.navy)
  doc.text(
    `${String(chapterIndex + 1).padStart(2, '0')}  ${safeText(chapter.name)}`.toUpperCase(),
    pdfPage.marginX + 5,
    cursorY + 2,
  )

  return cursorY + 8
}

function estimateChapterHeight(chapter) {
  const rows = Math.max(1, chapter.items?.length || 0)
  return 21 + rows * 8
}

function addPartidasTable(doc, chapter, y) {
  const body =
    chapter.items?.length > 0
      ? chapter.items.map((item) => [
          safeText(item.description),
          toNumber(item.quantity).toFixed(2).replace('.', ','),
          safeText(item.unit),
          formatCurrency(item.unitPrice),
          formatCurrency(calculateItemTotal(item)),
        ])
      : [['Sin partidas definidas', '0,00', '-', formatCurrency(0), formatCurrency(0)]]

  autoTable(doc, {
    head: [['Descripcion', 'Cant.', 'Ud.', 'Precio', 'Importe']],
    body,
    startY: y,
    theme: 'grid',
    margin: {
      left: pdfPage.marginX,
      right: pdfPage.marginX,
      top: pdfPage.contentTop,
      bottom: pdfPage.height - pdfPage.contentBottom,
    },
    showHead: 'everyPage',
    pageBreak: estimateChapterHeight(chapter) < 205 ? 'avoid' : 'auto',
    rowPageBreak: 'avoid',
    headStyles: {
      fillColor: pdfColors.navy,
      textColor: pdfColors.white,
      fontStyle: 'bold',
      fontSize: 7.8,
      halign: 'center',
      lineWidth: 0,
    },
    bodyStyles: {
      textColor: pdfColors.text,
      lineColor: pdfColors.lightBorder,
      lineWidth: 0.1,
    },
    styles: {
      cellPadding: { top: 2.1, right: 2.2, bottom: 2.1, left: 2.2 },
      font: 'helvetica',
      fontSize: 8,
      overflow: 'linebreak',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 82, valign: 'top' },
      1: { cellWidth: 20, halign: 'right' },
      2: { cellWidth: 16 },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 32, halign: 'right', fontStyle: 'bold', textColor: pdfColors.navy },
    },
    alternateRowStyles: {
      fillColor: pdfColors.surface,
    },
  })

  let nextY = ensurePdfSpace(doc, doc.lastAutoTable.finalY + 5, 9)
  doc.setFillColor(...pdfColors.white)
  doc.setDrawColor(...pdfColors.lightBorder)
  doc.roundedRect(119, nextY - 5, 75, 9, 1, 1, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...pdfColors.navy)
  doc.text('Subtotal capitulo', 123, nextY + 0.8)
  doc.text(formatCurrency(calculateChapterSubtotal(chapter)), 190, nextY + 0.8, {
    align: 'right',
  })

  return nextY + 10
}

function addEconomicSummary(doc, totals, discountPercent, ivaPercent, y) {
  let cursorY = drawSectionTitle(doc, '03', 'Resumen economico', y, { neededHeight: 54 })
  const x = 104
  const width = 90
  const rows = [
    ['Subtotal', formatCurrency(totals.subtotal)],
    [`Descuento (${toNumber(discountPercent).toFixed(2).replace('.', ',')} %)`, formatCurrency(totals.discountAmount)],
    ['Base imponible', formatCurrency(totals.taxableBase)],
    [`IVA (${toNumber(ivaPercent).toFixed(2).replace('.', ',')} %)`, formatCurrency(totals.ivaAmount)],
  ]

  cursorY = ensurePdfSpace(doc, cursorY, 50)
  doc.setDrawColor(...pdfColors.lightBorder)
  doc.setFillColor(...pdfColors.white)
  doc.roundedRect(x, cursorY - 4, width, 45, 1.5, 1.5, 'S')
  rows.forEach(([label, value], index) => {
    const rowY = cursorY + index * 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.2)
    doc.setTextColor(...pdfColors.muted)
    doc.text(label, x + 4, rowY)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...pdfColors.text)
    doc.text(value, x + width - 4, rowY, { align: 'right' })
  })

  doc.setFillColor(...pdfColors.navy)
  doc.roundedRect(x, cursorY + 27, width, 12, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...pdfColors.white)
  doc.text('TOTAL PRESUPUESTO', x + 4, cursorY + 35)
  doc.setFontSize(11)
  doc.text(formatCurrency(totals.total), x + width - 4, cursorY + 35, { align: 'right' })
  doc.setFillColor(...pdfColors.orange)
  doc.rect(x, cursorY + 39.5, width, 1.2, 'F')

  return cursorY + 50
}

function addConditions(doc, conditions, y) {
  let cursorY = drawSectionTitle(doc, '04', 'Condiciones de la oferta', y, { neededHeight: 34 })
  cursorY = drawKeyValueGrid(
    doc,
    filterFilledRows([
      ['Forma de pago', conditions.paymentTerms],
      ['Plazo de ejecucion', conditions.executionTime],
      ['Observaciones', conditions.notes],
    ]),
    cursorY,
    { labelWidth: 38 },
  )

  return cursorY
}

function addSignatures(doc, y, clientData, settings) {
  const cursorY = ensurePdfSpace(doc, y, 38)
  const leftX = pdfPage.marginX
  const rightX = 112
  const lineY = cursorY + 18

  doc.setDrawColor(...pdfColors.border)
  doc.line(leftX, lineY, leftX + 72, lineY)
  doc.line(rightX, lineY, pdfPage.width - pdfPage.marginX, lineY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...pdfColors.navy)
  doc.text('ACEPTACION DEL CLIENTE', leftX, lineY + 7)
  doc.text('POR PRITECA', rightX, lineY + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...pdfColors.muted)
  doc.text(`Nombre: ${safeText(clientData.name)}`, leftX, lineY + 14)
  doc.text(`DNI/NIF: ${safeText(clientData.taxId)}`, leftX, lineY + 20)
  doc.text(`Nombre: ${safeText(settings.legalName || settings.name)}`, rightX, lineY + 14)
  doc.text(`CIF: ${safeText(settings.taxId)}`, rightX, lineY + 20)
}

export async function generateBudgetPdf(budget, totals, companySettings) {
  const settings = normalizePdfSettings(companySettings)
  const logoImage = await loadLogoWithFallback(settings)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const generalData = budget.generalData || {}
  const clientData = budget.clientData || {}
  const chapters = budget.chapters || []
  const conditions = budget.conditions || {}
  const summary = budget.summary || {}

  let cursorY = addDocumentIntro(doc, budget, settings, logoImage)
  cursorY = drawSectionTitle(doc, '01', 'Alcance de la oferta', cursorY)
  cursorY = drawParagraph(
    doc,
    generalData.projectName || generalData.projectAddress
      ? 'El presente documento recoge la medicion, valoracion economica y condiciones principales de la actuacion solicitada.'
      : 'El presente documento recoge la medicion y valoracion economica de la actuacion solicitada.',
    cursorY,
  )

  cursorY = drawSectionTitle(doc, '02', 'Medicion y valoracion', cursorY + 2)
  chapters.forEach((chapter, index) => {
    cursorY = ensurePdfSpace(doc, cursorY, Math.min(estimateChapterHeight(chapter), 70))
    cursorY = addChapterTitle(doc, chapter, index, cursorY)
    cursorY = addPartidasTable(doc, chapter, cursorY)
  })

  cursorY = addEconomicSummary(
    doc,
    totals,
    summary.discountPercent ?? budget.discountPercentage,
    summary.ivaPercent ?? budget.vatPercentage,
    cursorY + 2,
  )
  cursorY = addConditions(doc, conditions, cursorY)
  addSignatures(doc, cursorY + 2, clientData, settings)
  drawCorporateHeaderFooter(doc, settings, logoImage, { reference: generalData.number })

  doc.save(buildBudgetPdfFileName(generalData.number, clientData.name))
}

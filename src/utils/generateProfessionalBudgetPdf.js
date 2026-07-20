import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { COMPANY_NAME } from '../config/branding'
import { pritecaMethod } from '../data/pritecaMethod'
import {
  calculateItemTotal,
  formatCurrency,
  toNumber,
} from './budgetCalculations'
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
import { formatPdfDate, safeText } from './pdfHelpers'
import {
  buildProfessionalPdfFileName,
  combinePartialValues,
  formatPercentLabel,
  getChapterSubtotal,
  getItemCode,
  getProfessionalProjectTitle,
  mergeProfessionalDefaults,
} from './professionalBudgetHelpers'

function addCover(doc, budget, settings, report, logoImage) {
  const general = budget.generalData || {}
  const client = budget.clientData || {}
  let y = pdfPage.contentTop + 6

  doc.setFillColor(...pdfColors.surface)
  doc.roundedRect(pdfPage.marginX, y, pdfPage.width - pdfPage.marginX * 2, 66, 2, 2, 'F')
  doc.setFillColor(...pdfColors.orange)
  doc.rect(pdfPage.marginX, y, 2.5, 66, 'F')

  if (logoImage) {
    drawImageContained(doc, logoImage, pdfPage.marginX + 8, y + 9, 62, 24)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...pdfColors.navy)
  doc.text('OFERTA TECNICA Y ECONOMICA', pdfPage.marginX + 8, y + 45)
  doc.setFontSize(10)
  doc.setTextColor(...pdfColors.orange)
  doc.text('DOCUMENTO CORPORATIVO DE INGENIERIA', pdfPage.marginX + 8, y + 54)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...pdfColors.muted)
  doc.text('REFERENCIA', pdfPage.width - pdfPage.marginX - 6, y + 14, { align: 'right' })
  doc.setFontSize(13)
  doc.setTextColor(...pdfColors.navy)
  doc.text(safeText(budget.budgetNumber || general.number), pdfPage.width - pdfPage.marginX - 6, y + 23, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...pdfColors.muted)
  doc.text(formatPdfDate(general.date), pdfPage.width - pdfPage.marginX - 6, y + 31, { align: 'right' })

  y += 82
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...pdfColors.text)
  doc.text(
    doc.splitTextToSize(getProfessionalProjectTitle(general, report), pdfPage.width - pdfPage.marginX * 2),
    pdfPage.marginX,
    y,
  )

  y += 20
  y = drawKeyValueGrid(
    doc,
    [
      ['Cliente', client.name],
      ['Emplazamiento', general.projectAddress],
      ['Vigencia', `${safeText(general.validityDays)} dias`],
      ['Empresa', settings.legalName || settings.name],
      ['Contacto', combinePartialValues([settings.phone, settings.email])],
    ],
    y,
    { labelWidth: 34 },
  )

  y = ensurePdfSpace(doc, y + 10, 22)
  doc.setDrawColor(...pdfColors.orange)
  doc.setLineWidth(0.6)
  doc.line(pdfPage.marginX, y, pdfPage.width - pdfPage.marginX, y)
  y = drawParagraph(doc, settings.professionalDefaults?.tagline, y + 9, {
    color: pdfColors.muted,
    fontSize: 10,
    width: 150,
  })

  return y
}

function addTechnicalInfo(doc, budget, report, startY) {
  let y = drawSectionTitle(doc, '01', 'Identificacion de la oferta', startY + 2)
  const general = budget.generalData || {}
  const client = budget.clientData || {}
  y = drawKeyValueGrid(doc, [
    ['Objeto', report.offerObject || general.projectName || '-'],
    ['Cliente y documento', combinePartialValues([client.name, client.taxId])],
    ['Contacto', report.contactPerson],
    ['Emplazamiento', general.projectAddress],
    ['Tecnico responsable', report.responsibleTechnician],
  ], y)

  if (report.executiveSummary) {
    y = drawSectionTitle(doc, '02', 'Resumen ejecutivo', y + 3)
    y = drawParagraph(doc, report.executiveSummary, y)
  }

  if (report.recommendedSolution) {
    y = drawSectionTitle(doc, '03', 'Solucion recomendada', y + 3)
    y = drawParagraph(doc, report.recommendedSolution, y)
  }

  if (report.generalScope.length > 0) {
    y = drawSectionTitle(doc, '04', 'Alcance general', y + 3)
    y = addBulletList(doc, report.generalScope, y)
  }

  if (report.startingConditions) {
    y = drawSectionTitle(doc, '05', 'Condicionantes de partida', y + 3)
    y = drawParagraph(doc, report.startingConditions, y)
  }

  return y
}

function addBulletList(doc, items, y) {
  let cursorY = y
  const cleanItems = Array.isArray(items)
    ? items.filter((item) => safeText(item, '').trim())
    : []

  cleanItems.forEach((item) => {
    cursorY = ensurePdfSpace(doc, cursorY, 9)
    doc.setFillColor(...pdfColors.orange)
    doc.circle(pdfPage.marginX + 1.4, cursorY - 1.4, 0.9, 'F')
    cursorY = drawParagraph(doc, item, cursorY, {
      x: pdfPage.marginX + 5,
      width: pdfPage.width - pdfPage.marginX * 2 - 5,
      fontSize: 8.6,
      lineHeight: 4.4,
    })
  })

  return cursorY
}

function estimateChapterHeight(chapter) {
  const rows = Math.max(1, chapter.items?.length || 0)
  return 21 + rows * 7.4
}

function addMeasurement(doc, budget, totals, startY) {
  let y = drawSectionTitle(doc, '06', 'Medicion y valoracion', startY + 4)
  y = drawParagraph(
    doc,
    'La medicion se estructura por capitulos para facilitar la revision tecnica, el control de alcance y la trazabilidad economica de cada partida.',
    y,
    { color: pdfColors.muted },
  )

  ;(budget.chapters || []).forEach((chapter, chapterIndex) => {
    y = ensurePdfSpace(doc, y, Math.min(estimateChapterHeight(chapter), 70))
    doc.setFillColor(...pdfColors.blueSoft)
    doc.roundedRect(pdfPage.marginX, y - 4, pdfPage.width - pdfPage.marginX * 2, 9.5, 1.3, 1.3, 'F')
    doc.setFillColor(...pdfColors.orange)
    doc.rect(pdfPage.marginX, y - 4, 2.2, 9.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...pdfColors.navy)
    doc.text(
      `${String(chapterIndex + 1).padStart(2, '0')}  ${safeText(chapter.name)}`.toUpperCase(),
      pdfPage.marginX + 5,
      y + 1.8,
    )
    y += 8

    autoTable(doc, {
      head: [['COD.', 'DESCRIPCION', 'UD.', 'CANT.', 'P. UNIT.', 'IMPORTE']],
      body: (chapter.items?.length ? chapter.items : [{}]).map((item, itemIndex) => [
        getItemCode(chapterIndex, itemIndex),
        safeText(item.description),
        safeText(item.unit),
        toNumber(item.quantity).toFixed(2).replace('.', ','),
        formatCurrency(item.unitPrice),
        formatCurrency(calculateItemTotal(item)),
      ]),
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
        fontSize: 7.4,
        lineWidth: 0,
      },
      styles: {
        font: 'helvetica',
        fontSize: 7.7,
        cellPadding: { top: 1.9, right: 2, bottom: 1.9, left: 2 },
        overflow: 'linebreak',
        valign: 'middle',
        lineColor: pdfColors.lightBorder,
        lineWidth: 0.1,
      },
      alternateRowStyles: {
        fillColor: pdfColors.surface,
      },
      columnStyles: {
        0: { cellWidth: 14, textColor: pdfColors.muted },
        1: { cellWidth: 78, valign: 'top' },
        2: { cellWidth: 14 },
        3: { cellWidth: 19, halign: 'right' },
        4: { cellWidth: 27, halign: 'right' },
        5: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: pdfColors.navy },
      },
    })

    y = ensurePdfSpace(doc, doc.lastAutoTable.finalY + 5, 9)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.3)
    doc.setTextColor(...pdfColors.navy)
    doc.text(
      `Subtotal capitulo: ${formatCurrency(getChapterSubtotal(chapter))}`,
      pdfPage.width - pdfPage.marginX,
      y,
      { align: 'right' },
    )
    y += 10
  })

  return addEconomicSummary(doc, budget, totals, y)
}

function addEconomicSummary(doc, budget, totals, startY) {
  let y = ensurePdfSpace(doc, startY, 58)
  const summary = budget.summary || {}
  const x = 98
  const width = 96

  doc.setFillColor(...pdfColors.surface)
  doc.roundedRect(pdfPage.marginX, y - 4, 78, 47, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...pdfColors.navy)
  doc.text('Resumen economico', pdfPage.marginX + 4, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.3)
  doc.setTextColor(...pdfColors.muted)
  doc.text(
    doc.splitTextToSize('Importes expresados en euros. Impuestos desglosados segun normativa aplicable.', 67),
    pdfPage.marginX + 4,
    y + 13,
  )

  const rows = [
    ['Subtotal', formatCurrency(totals.subtotal)],
    ['Descuento / ajuste', formatCurrency(totals.discountAmount)],
    ['Base imponible', formatCurrency(totals.taxableBase)],
    [formatPercentLabel('IVA', summary.ivaPercent ?? budget.vatPercentage), formatCurrency(totals.ivaAmount)],
  ]

  doc.setDrawColor(...pdfColors.lightBorder)
  doc.roundedRect(x, y - 4, width, 47, 1.5, 1.5, 'S')
  rows.forEach(([label, value], index) => {
    const rowY = y + index * 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.2)
    doc.setTextColor(...pdfColors.muted)
    doc.text(label, x + 4, rowY)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...pdfColors.text)
    doc.text(value, x + width - 4, rowY, { align: 'right' })
  })

  doc.setFillColor(...pdfColors.navy)
  doc.roundedRect(x, y + 28, width, 13, 1.5, 1.5, 'F')
  doc.setFillColor(...pdfColors.orange)
  doc.rect(x, y + 40, width, 1.2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...pdfColors.white)
  doc.text('TOTAL PRESUPUESTO', x + 4, y + 36)
  doc.setFontSize(11.5)
  doc.text(formatCurrency(totals.total), x + width - 4, y + 36, { align: 'right' })

  return y + 54
}

function addPlanningAndConditions(doc, budget, report, startY) {
  let y = drawSectionTitle(doc, '07', 'Plazo y planificacion', startY + 3)
  y = drawKeyValueGrid(doc, [
    ['Inicio estimado', report.estimatedStart],
    ['Duracion estimada', report.estimatedDuration],
    ['Horario previsto', report.expectedSchedule],
    ['Condicionantes', report.planningConditions],
  ], y)

  const economicConditions = [
    budget.conditions?.paymentTerms,
    ...report.economicConditions,
  ].filter((item) => safeText(item, '').trim())

  if (economicConditions.length) {
    y = drawSectionTitle(doc, '08', 'Condiciones economicas', y + 3)
    y = addBulletList(doc, economicConditions, y)
  }

  if (report.inclusions.length) {
    y = drawSectionTitle(doc, '09', 'Inclusiones', y + 3)
    y = addBulletList(doc, report.inclusions, y)
  }

  if (report.exclusions.length) {
    y = drawSectionTitle(doc, '10', 'Exclusiones', y + 3)
    y = addBulletList(doc, report.exclusions, y)
  }

  if (report.warranty) {
    y = drawSectionTitle(doc, '11', 'Garantia', y + 3)
    y = drawParagraph(doc, report.warranty, y)
  }

  return y
}

function addMethodAndAcceptance(doc, budget, settings, report, startY) {
  let y = drawSectionTitle(doc, '12', `Metodo ${COMPANY_NAME}`, startY + 3)
  y = drawParagraph(doc, report.customMethodDescription, y, { color: pdfColors.muted })

  pritecaMethod.forEach((step) => {
    y = ensurePdfSpace(doc, y, 16)
    doc.setFillColor(...pdfColors.orangeSoft)
    doc.roundedRect(pdfPage.marginX, y - 5, pdfPage.width - pdfPage.marginX * 2, 13, 1.3, 1.3, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...pdfColors.orange)
    doc.text(step.number, pdfPage.marginX + 4, y)
    doc.setTextColor(...pdfColors.navy)
    doc.text(step.title, pdfPage.marginX + 17, y)
    y = drawParagraph(doc, step.description, y + 5, {
      x: pdfPage.marginX + 17,
      width: pdfPage.width - pdfPage.marginX * 2 - 20,
      color: pdfColors.muted,
      fontSize: 8,
      lineHeight: 4,
    })
  })

  if (report.closingDocumentation.length) {
    y = drawSectionTitle(doc, '13', 'Documentacion de cierre', y + 3)
    y = addBulletList(doc, report.closingDocumentation, y)
  }

  y = drawSectionTitle(doc, '14', 'Aceptacion del presupuesto', y + 3, { neededHeight: 78 })
  y = drawParagraph(
    doc,
    'Mediante la firma de este documento, el cliente declara haber revisado y aceptado el alcance, los importes, las exclusiones, las condiciones economicas y la planificacion descritos en la presente oferta.',
    y,
  )

  y = ensurePdfSpace(doc, y + 4, 48)
  const leftX = pdfPage.marginX
  const rightX = 112
  const lineY = y + 22
  doc.setDrawColor(...pdfColors.border)
  doc.line(leftX, lineY, leftX + 72, lineY)
  doc.line(rightX, lineY, pdfPage.width - pdfPage.marginX, lineY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...pdfColors.navy)
  doc.text(`POR ${COMPANY_NAME}`, leftX, lineY + 8)
  doc.text('POR EL CLIENTE', rightX, lineY + 8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...pdfColors.muted)
  doc.text(`Nombre: ${safeText(settings.legalName || settings.name)}`, leftX, lineY + 16)
  doc.text(`Nombre: ${safeText(budget.clientData?.name)}`, rightX, lineY + 16)
  doc.text(`DNI/NIF: ${safeText(budget.clientData?.taxId)}`, rightX, lineY + 23)

  y = lineY + 34
  y = drawSectionTitle(doc, '15', 'Datos corporativos', y + 3)
  drawKeyValueGrid(doc, [
    ['Razon social', settings.legalName],
    ['NIF/CIF', settings.taxId],
    ['Domicilio', settings.address],
    ['Contacto', combinePartialValues([settings.phone, settings.email])],
    ['Web', settings.website],
    ['IBAN', settings.iban],
  ], y)
}

export async function generateProfessionalBudgetPdf(budget, totals, companySettings) {
  const settings = normalizePdfSettings(companySettings)
  const report = mergeProfessionalDefaults(budget.technicalReport, settings)
  const logoImage = await loadLogoWithFallback(settings)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  let y = addCover(doc, budget, settings, report, logoImage)
  y = addTechnicalInfo(doc, budget, report, y)
  y = addMeasurement(doc, budget, totals, y)
  y = addPlanningAndConditions(doc, budget, report, y)
  addMethodAndAcceptance(doc, budget, settings, report, y)
  drawCorporateHeaderFooter(doc, settings, logoImage, {
    reference: budget.budgetNumber || budget.generalData?.number,
  })

  doc.save(buildProfessionalPdfFileName(budget.budgetNumber || budget.generalData?.number, budget.clientData?.name))
}

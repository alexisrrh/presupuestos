import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import pritecaLogo from '../assets/priteca-logo.png'
import { companyData } from '../data/companyData'
import { pritecaMethod } from '../data/pritecaMethod'
import {
  calculateItemTotal,
  formatCurrency,
  toNumber,
} from './budgetCalculations'
import {
  buildProfessionalPdfFileName,
  combinePartialValues,
  formatPercentLabel,
  getChapterSubtotal,
  getItemCode,
  getProfessionalProjectTitle,
  mergeProfessionalDefaults,
} from './professionalBudgetHelpers'
import { filterFilledRows, formatPdfDate, safeText } from './pdfHelpers'

const colors = {
  blue: [23, 63, 107],
  orange: [243, 108, 33],
  darkGray: [95, 104, 115],
  lightGray: [243, 245, 247],
  text: [17, 24, 39],
  border: [221, 226, 232],
}

const page = { width: 210, height: 297, marginX: 16, marginBottom: 24 }
const footerY = 287
const footerLineY = 281

function ensureSpace(doc, y, needed) {
  if (y + needed <= page.height - page.marginBottom) return y
  doc.addPage()
  return 28
}

function hasSpace(y, needed) {
  return y + needed <= page.height - page.marginBottom
}

function ensureSectionStart(doc, y, needed = 24) {
  return hasSpace(y, needed) ? y : ensureSpace(doc, y, needed)
}

function loadImageAsDataUrl(src) {
  if (!src) return Promise.resolve(null)
  if (src.startsWith('data:image/')) return Promise.resolve(src)
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

function getImageFormat(dataUrl) {
  if (dataUrl?.startsWith('data:image/jpeg') || dataUrl?.startsWith('data:image/jpg')) return 'JPEG'
  if (dataUrl?.startsWith('data:image/webp')) return 'WEBP'
  return 'PNG'
}

function addPageTitle(doc, number, title, y) {
  y = ensureSectionStart(doc, y, 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...colors.orange)
  doc.text(number, page.marginX, y)
  doc.setTextColor(...colors.blue)
  doc.text(title, page.marginX + (number ? 12 : 0), y)
  doc.setDrawColor(...colors.border)
  doc.line(page.marginX, y + 4, page.width - page.marginX, y + 4)
  return y + 12
}

function addParagraph(doc, text, y, options = {}) {
  const cleanText = safeText(text, '').trim()
  if (!cleanText) return y
  const width = options.width || page.width - page.marginX * 2
  const lines = doc.splitTextToSize(cleanText, width)
  y = ensureSpace(doc, y, lines.length * 5 + 4)
  doc.setFont('helvetica', options.bold ? 'bold' : 'normal')
  doc.setFontSize(options.fontSize || 9.5)
  doc.setTextColor(...(options.color || colors.text))
  doc.text(lines, options.x || page.marginX, y)
  return y + lines.length * 5 + 4
}

function addList(doc, items, y) {
  const cleanItems = Array.isArray(items) ? items.filter((item) => safeText(item, '').trim()) : []
  cleanItems.forEach((item) => {
    y = ensureSpace(doc, y, 10)
    doc.setTextColor(...colors.orange)
    doc.text('-', page.marginX, y)
    y = addParagraph(doc, item, y, { x: page.marginX + 5, width: page.width - page.marginX * 2 - 5 })
  })
  return y
}

function addInfoTable(doc, rows, y) {
  const body = filterFilledRows(rows)
  if (body.length === 0) return y
  autoTable(doc, {
    body,
    startY: y,
    theme: 'grid',
    margin: { left: page.marginX, right: page.marginX },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.4, lineColor: colors.border, lineWidth: 0.1 },
    columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold', textColor: colors.blue }, 1: { cellWidth: 136 } },
  })
  return doc.lastAutoTable.finalY + 8
}

function optionalRow(label, value) {
  const cleanValue = safeText(value, '').trim()
  return cleanValue ? [label, cleanValue] : null
}

function requiredRow(label, value) {
  return [label, safeText(value)]
}

function addCover(doc, budget, settings, report, logoDataUrl) {
  const general = budget.generalData || {}
  const client = budget.clientData || {}
  doc.setFillColor(...colors.lightGray)
  doc.rect(0, 0, page.width, page.height, 'F')
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, getImageFormat(logoDataUrl), 72, 24, 66, 28)
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(30)
  doc.setTextColor(...colors.blue)
  doc.text('PRESUPUESTO', page.width / 2, 82, { align: 'center' })
  doc.setDrawColor(...colors.orange)
  doc.setLineWidth(1.2)
  doc.line(54, 90, 156, 90)
  doc.setFontSize(16)
  doc.setTextColor(...colors.text)
  doc.text(getProfessionalProjectTitle(general, report), page.width / 2, 106, { align: 'center' })
  addInfoTable(doc, [
    requiredRow('Cliente', client.name),
    requiredRow('Emplazamiento', general.projectAddress),
    requiredRow('Referencia', budget.budgetNumber || general.number),
    requiredRow('Fecha', formatPdfDate(general.date)),
    requiredRow('Vigencia', `${safeText(general.validityDays)} dias`),
  ], 124)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(11)
  doc.setTextColor(...colors.darkGray)
  doc.text(safeText(settings.professionalDefaults?.tagline), page.width / 2, 232, { align: 'center' })
}

function addTechnicalInfo(doc, budget, report) {
  doc.addPage()
  let y = 30
  const general = budget.generalData || {}
  const client = budget.clientData || {}
  y = addPageTitle(doc, '01', 'IDENTIFICACION DE LA OFERTA', y)
  y = addInfoTable(doc, [
    ['Objeto', report.offerObject || general.projectName || '-'],
    ['Cliente y documento', combinePartialValues([client.name, client.taxId])],
    ['Contacto', report.contactPerson],
    ['Emplazamiento', general.projectAddress],
    ['Tecnico responsable', report.responsibleTechnician],
  ], y)
  if (report.executiveSummary) {
    y = addPageTitle(doc, '02', 'RESUMEN EJECUTIVO', y)
    y = addParagraph(doc, report.executiveSummary, y)
  }
  if (report.recommendedSolution) {
    y = addPageTitle(doc, '', 'SOLUCION RECOMENDADA', y)
    y = addParagraph(doc, report.recommendedSolution, y)
  }
  if (report.generalScope.length > 0) {
    y = addPageTitle(doc, '03', 'ALCANCE GENERAL', y)
    y = addList(doc, report.generalScope, y)
  }
  if (report.startingConditions) {
    y = addPageTitle(doc, '04', 'CONDICIONANTES DE PARTIDA', y)
    addParagraph(doc, report.startingConditions, y)
  }
}

function addMeasurement(doc, budget, totals) {
  doc.addPage()
  let y = addPageTitle(doc, '05', 'MEDICION Y VALORACION', 30)
  y = addParagraph(doc, 'Las partidas se organizan por capitulos para facilitar la lectura, el control de alcance y la trazabilidad economica.', y)
  ;(budget.chapters || []).forEach((chapter, chapterIndex) => {
    y = ensureSpace(doc, y, 18)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...colors.blue)
    doc.text(`${String(chapterIndex + 1).padStart(2, '0')}. ${safeText(chapter.name)}`, page.marginX, y)
    y += 5
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
      margin: { left: page.marginX, right: page.marginX },
      headStyles: { fillColor: colors.blue, textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: 74 }, 2: { cellWidth: 14 }, 3: { cellWidth: 20, halign: 'right' }, 4: { cellWidth: 28, halign: 'right' }, 5: { cellWidth: 28, halign: 'right' } },
      rowPageBreak: 'avoid',
    })
    y = doc.lastAutoTable.finalY + 7
    y = ensureSpace(doc, y, 8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...colors.text)
    doc.text(`Subtotal capitulo: ${formatCurrency(getChapterSubtotal(chapter))}`, page.width - page.marginX, y, { align: 'right' })
    y += 10
  })
  y = ensureSpace(doc, y, 48)
  autoTable(doc, {
    body: [
      ['Subtotal', formatCurrency(totals.subtotal)],
      ['Descuento / ajuste', formatCurrency(totals.discountAmount)],
      ['Base imponible', formatCurrency(totals.taxableBase)],
      [formatPercentLabel('IVA', budget.summary?.ivaPercent ?? budget.vatPercentage), formatCurrency(totals.ivaAmount)],
      ['TOTAL PRESUPUESTO', formatCurrency(totals.total)],
    ],
    startY: y,
    theme: 'grid',
    margin: { left: 105, right: page.marginX },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5 },
    didParseCell: (data) => {
      if (data.row.index === 4) {
        data.cell.styles.fillColor = data.column.index === 0 ? colors.blue : colors.orange
        data.cell.styles.textColor = [255, 255, 255]
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  y = doc.lastAutoTable.finalY + 8
  y = addParagraph(doc, 'Importes expresados en euros. Impuestos desglosados segun normativa aplicable.', y, { color: colors.darkGray, fontSize: 8 })
  return y
}

function addPlanningAndConditions(doc, budget, report, startY) {
  let y = ensureSectionStart(doc, startY + 6, 40)
  y = addPageTitle(doc, '06', 'PLAZO Y PLANIFICACION', y)
  y = addInfoTable(doc, [
    ['Inicio estimado', report.estimatedStart],
    ['Duracion estimada', report.estimatedDuration],
    ['Horario previsto', report.expectedSchedule],
    ['Condicionantes', report.planningConditions],
  ], y)
  const economicConditions = [budget.conditions?.paymentTerms, ...report.economicConditions].filter((item) => safeText(item, '').trim())
  if (economicConditions.length) {
    y = addPageTitle(doc, '07', 'CONDICIONES ECONOMICAS', y)
    y = addList(doc, economicConditions, y)
  }
  if (report.inclusions.length) {
    y = addPageTitle(doc, '08', 'INCLUSIONES', y)
    y = addList(doc, report.inclusions, y)
  }
  if (report.exclusions.length) {
    y = addPageTitle(doc, '09', 'EXCLUSIONES', y)
    y = addList(doc, report.exclusions, y)
  }
  if (report.warranty) {
    y = addPageTitle(doc, '10', 'GARANTIA', y)
    addParagraph(doc, report.warranty, y)
  }
}

function addMethodAndAcceptance(doc, budget, settings, report) {
  doc.addPage()
  let y = addPageTitle(doc, '11', 'METODO PRITECA', 30)
  y = addParagraph(doc, report.customMethodDescription, y)
  pritecaMethod.forEach((step) => {
    y = ensureSpace(doc, y, 15)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...colors.orange)
    doc.text(step.number, page.marginX, y)
    doc.setTextColor(...colors.blue)
    doc.text(step.title, page.marginX + 13, y)
    y = addParagraph(doc, step.description, y + 5, { color: colors.darkGray })
  })
  if (report.closingDocumentation.length) {
    y = addPageTitle(doc, '12', 'DOCUMENTACION DE CIERRE', y)
    y = addList(doc, report.closingDocumentation, y)
  }
  addParagraph(doc, 'Cada decision tecnica tiene un impacto. Nuestra responsabilidad es tomar la correcta.', y, { bold: true, color: colors.blue })

  doc.addPage()
  y = addPageTitle(doc, '13', 'ACEPTACION DEL PRESUPUESTO', 30)
  y = addParagraph(doc, 'Mediante la firma de este documento, el cliente declara haber revisado y aceptado el alcance, los importes, las exclusiones, las condiciones economicas y la planificacion descritos en la presente oferta.', y)
  y = ensureSpace(doc, y, 70)
  const leftX = page.marginX
  const rightX = 112
  const signatureLineY = y + 34
  doc.setDrawColor(...colors.darkGray)
  doc.line(leftX, signatureLineY, leftX + 72, signatureLineY)
  doc.line(rightX, signatureLineY, page.width - page.marginX, signatureLineY)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...colors.blue)
  doc.text('POR PRITECA', leftX, signatureLineY + 8)
  doc.text('POR EL CLIENTE', rightX, signatureLineY + 8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...colors.text)
  doc.text(`Nombre: ${safeText(settings.legalName || settings.name)}`, leftX, signatureLineY + 16)
  doc.text('Cargo: ', leftX, signatureLineY + 23)
  doc.text('Fecha: ', leftX, signatureLineY + 30)
  doc.text(`Nombre: ${safeText(budget.clientData?.name)}`, rightX, signatureLineY + 16)
  doc.text(`DNI/NIF: ${safeText(budget.clientData?.taxId)}`, rightX, signatureLineY + 23)
  doc.text('Fecha: ', rightX, signatureLineY + 30)
  y = signatureLineY + 42
  y = addPageTitle(doc, '14', 'DATOS CORPORATIVOS', y)
  addInfoTable(doc, [
    optionalRow('Razon social', settings.legalName),
    optionalRow('NIF/CIF', settings.taxId),
    optionalRow('Domicilio', settings.address),
    optionalRow(
      'Contacto',
      combinePartialValues([settings.phone, settings.email]) === '-'
        ? ''
        : combinePartialValues([settings.phone, settings.email]),
    ),
    optionalRow('Web', settings.website),
    optionalRow('IBAN', settings.iban),
  ].filter(Boolean), y)
}

function addFooters(doc, settings) {
  const totalPages = doc.getNumberOfPages()
  for (let index = 1; index <= totalPages; index += 1) {
    doc.setPage(index)
    doc.setDrawColor(...colors.border)
    doc.line(page.marginX, footerLineY, page.width - page.marginX, footerLineY)
    doc.setFontSize(8)
    doc.setTextColor(...colors.darkGray)
    doc.text(safeText(settings.name), page.marginX, footerY)
    const contact = [settings.website, settings.phone].filter(Boolean).join(' | ')
    doc.text(
      `${contact ? `${contact} | ` : ''}Pagina ${index} de ${totalPages}`,
      page.width - page.marginX,
      footerY,
      { align: 'right' },
    )
  }
}

export async function generateProfessionalBudgetPdf(budget, totals, companySettings = companyData) {
  const settings = { ...companyData, ...(companySettings || {}) }
  const report = mergeProfessionalDefaults(budget.technicalReport, settings)
  const logoDataUrl = await loadImageAsDataUrl(settings.logo || pritecaLogo)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  addCover(doc, budget, settings, report, logoDataUrl)
  addTechnicalInfo(doc, budget, report)
  const measurementEndY = addMeasurement(doc, budget, totals)
  addPlanningAndConditions(doc, budget, report, measurementEndY)
  addMethodAndAcceptance(doc, budget, settings, report)
  addFooters(doc, settings)
  doc.save(buildProfessionalPdfFileName(budget.budgetNumber || budget.generalData?.number, budget.clientData?.name))
}

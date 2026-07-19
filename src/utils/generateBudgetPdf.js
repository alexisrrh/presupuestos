import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import pritecaLogo from '../assets/priteca-logo.png'
import { companyData } from '../data/companyData'
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

const colors = {
  red: [198, 40, 40],
  darkRed: [183, 28, 28],
  softRed: [252, 241, 241],
  text: [17, 24, 39],
  muted: [107, 114, 128],
  border: [229, 231, 235],
  white: [255, 255, 255],
}

const page = {
  marginX: 16,
  marginBottom: 26,
  width: 210,
  height: 297,
}

function ensureSpace(doc, cursorY, neededHeight) {
  if (cursorY + neededHeight <= page.height - page.marginBottom) {
    return cursorY
  }

  doc.addPage()
  return 18
}

function loadImageAsDataUrl(src) {
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

function getImageFormat(dataUrl) {
  if (dataUrl?.startsWith('data:image/jpeg') || dataUrl?.startsWith('data:image/jpg')) {
    return 'JPEG'
  }

  if (dataUrl?.startsWith('data:image/webp')) {
    return 'WEBP'
  }

  return 'PNG'
}

function sectionTitle(doc, title, cursorY) {
  const y = ensureSpace(doc, cursorY, 14)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...colors.red)
  doc.text(title, page.marginX, y)
  doc.setDrawColor(...colors.border)
  doc.line(page.marginX, y + 3, page.width - page.marginX, y + 3)
  return y + 10
}

function addInfoRows(doc, rows, cursorY) {
  if (rows.length === 0) {
    return cursorY
  }

  autoTable(doc, {
    body: rows,
    startY: cursorY,
    theme: 'plain',
    margin: { left: page.marginX, right: page.marginX },
    styles: {
      cellPadding: { top: 1.8, right: 2, bottom: 1.8, left: 0 },
      font: 'helvetica',
      fontSize: 9,
      textColor: colors.text,
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold', textColor: colors.muted },
      1: { cellWidth: 136 },
    },
  })

  return doc.lastAutoTable.finalY + 8
}

function addHeader(doc, generalData, settings, logoDataUrl) {
  doc.setFillColor(...colors.red)
  doc.rect(0, 0, page.width, 7, 'F')

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, getImageFormat(logoDataUrl), page.marginX, 14, 44, 18)
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(...colors.text)
    doc.text(settings.name, page.marginX, 25)
  }

  doc.setTextColor(...colors.text)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Presupuestos de construccion', page.marginX, 38)

  const companyRows = filterFilledRows([
    ['CIF', settings.taxId],
    ['Telefono', settings.phone],
    ['Email', settings.email],
    ['Web', settings.website],
    ['Direccion', settings.address],
    ['IBAN', settings.iban],
  ])

  let companyY = 44
  doc.setTextColor(...colors.muted)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  companyRows.forEach(([label, value]) => {
    doc.text(`${label}: ${safeText(value)}`, page.marginX, companyY)
    companyY += 4
  })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...colors.red)
  doc.text('PRESUPUESTO', page.width - page.marginX, 18, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...colors.text)
  doc.text(`Numero: ${safeText(generalData.number)}`, page.width - page.marginX, 27, {
    align: 'right',
  })
  doc.text(`Fecha: ${formatPdfDate(generalData.date)}`, page.width - page.marginX, 33, {
    align: 'right',
  })
  doc.text(
    `Validez: ${safeText(generalData.validityDays)} dias`,
    page.width - page.marginX,
    39,
    { align: 'right' },
  )

  doc.setDrawColor(...colors.border)
  doc.line(page.marginX, 58, page.width - page.marginX, 58)

  return 68
}

function addPartidasTable(doc, chapter, cursorY) {
  const body =
    chapter.items.length > 0
      ? chapter.items.map((item) => [
          safeText(item.description),
          toNumber(item.quantity).toFixed(2).replace('.', ','),
          safeText(item.unit),
          formatCurrency(item.unitPrice),
          formatCurrency(calculateItemTotal(item)),
        ])
      : [['-', '0,00', '-', formatCurrency(0), formatCurrency(0)]]

  autoTable(doc, {
    head: [['Descripcion', 'Cantidad', 'Unidad', 'Precio unitario', 'Total']],
    body,
    startY: cursorY,
    theme: 'grid',
    margin: { left: page.marginX, right: page.marginX },
    headStyles: {
      fillColor: colors.softRed,
      textColor: colors.red,
      fontStyle: 'bold',
      lineColor: colors.border,
      lineWidth: 0.1,
    },
    bodyStyles: {
      textColor: colors.text,
      lineColor: colors.border,
      lineWidth: 0.1,
    },
    styles: {
      cellPadding: 2.5,
      font: 'helvetica',
      fontSize: 8.5,
      overflow: 'linebreak',
      valign: 'top',
    },
    columnStyles: {
      0: { cellWidth: 76 },
      1: { cellWidth: 22, halign: 'right' },
      2: { cellWidth: 18 },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
  })

  let nextY = ensureSpace(doc, doc.lastAutoTable.finalY + 7, 10)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...colors.text)
  doc.text(
    `Subtotal capitulo: ${formatCurrency(calculateChapterSubtotal(chapter))}`,
    page.width - page.marginX,
    nextY,
    { align: 'right' },
  )

  return nextY + 8
}

function addSummary(doc, totals, discountPercent, ivaPercent, cursorY) {
  let y = ensureSpace(doc, cursorY, 52)
  y = sectionTitle(doc, 'Resumen economico', y)

  autoTable(doc, {
    body: [
      ['Subtotal', formatCurrency(totals.subtotal)],
      [
        `Descuento (${toNumber(discountPercent).toFixed(2).replace('.', ',')} %)`,
        formatCurrency(totals.discountAmount),
      ],
      ['Base imponible', formatCurrency(totals.taxableBase)],
      [
        `IVA (${toNumber(ivaPercent).toFixed(2).replace('.', ',')} %)`,
        formatCurrency(totals.ivaAmount),
      ],
      ['TOTAL FINAL', formatCurrency(totals.total)],
    ],
    startY: y,
    theme: 'grid',
    margin: { left: 105, right: page.marginX },
    styles: {
      cellPadding: 2.8,
      font: 'helvetica',
      fontSize: 9,
      lineColor: colors.border,
      lineWidth: 0.1,
      textColor: colors.text,
    },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: 'bold' },
      1: { cellWidth: 41, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.row.index === 4) {
        data.cell.styles.fillColor = colors.red
        data.cell.styles.textColor = colors.white
        data.cell.styles.fontSize = 11
      }
    },
  })

  return doc.lastAutoTable.finalY + 10
}

function addSignatures(doc, cursorY, clientData, settings) {
  const y = ensureSpace(doc, cursorY, 54)
  const leftX = page.marginX
  const rightX = 118

  doc.setDrawColor(...colors.muted)
  doc.line(leftX, y + 26, leftX + 64, y + 26)
  doc.line(rightX, y + 26, rightX + 64, y + 26)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...colors.muted)
  doc.text('Firma del cliente', leftX, y + 32)
  doc.text(`Nombre: ${safeText(clientData.name)}`, leftX, y + 38)
  doc.text(`DNI/NIE/CIF: ${safeText(clientData.taxId)}`, leftX, y + 44)
  doc.text('Fecha: ', leftX, y + 50)

  doc.text('Firma de PRITECA', rightX, y + 32)
  doc.text(`Nombre: ${safeText(settings.legalName || settings.name)}`, rightX, y + 38)
  doc.text(`DNI/NIE/CIF: ${safeText(settings.taxId)}`, rightX, y + 44)
  doc.text('Fecha: ', rightX, y + 50)
}

function addFooter(doc, generalData, settings) {
  const totalPages = doc.getNumberOfPages()

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber)
    doc.setDrawColor(...colors.border)
    doc.line(page.marginX, 281, page.width - page.marginX, 281)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...colors.muted)
    doc.text(safeText(settings.legalName || settings.name), page.marginX, 287)
    doc.text(
      `Presupuesto ${safeText(generalData.number)} | Pagina ${pageNumber} de ${totalPages}`,
      page.width - page.marginX,
      287,
      { align: 'right' },
    )
  }
}

export async function generateBudgetPdf(budget, totals, companySettings = companyData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const generalData = budget.generalData || {}
  const clientData = budget.clientData || {}
  const chapters = budget.chapters || []
  const conditions = budget.conditions || {}
  const summary = budget.summary || {}
  const settings = { ...companyData, ...(companySettings || {}) }
  const logoDataUrl = await loadImageAsDataUrl(settings.logo || pritecaLogo)
  let cursorY = addHeader(doc, generalData, settings, logoDataUrl)

  cursorY = sectionTitle(doc, 'Datos del cliente', cursorY)
  cursorY = addInfoRows(
    doc,
    filterFilledRows([
      ['Nombre o razon social', safeText(clientData.name)],
      ['DNI, NIE o CIF', safeText(clientData.taxId)],
      ['Telefono', safeText(clientData.phone)],
      ['Correo', safeText(clientData.email)],
      ['Direccion', safeText(clientData.address)],
    ]),
    cursorY,
  )

  cursorY = sectionTitle(doc, 'Datos de la obra', cursorY)
  cursorY = addInfoRows(
    doc,
    filterFilledRows([
      ['Nombre de la obra', safeText(generalData.projectName)],
      ['Direccion de la obra', safeText(generalData.projectAddress)],
    ]),
    cursorY,
  )

  cursorY = sectionTitle(doc, 'Capitulos', cursorY)
  chapters.forEach((chapter, index) => {
    cursorY = ensureSpace(doc, cursorY, 18)
    doc.setFillColor(...colors.softRed)
    doc.roundedRect(
      page.marginX,
      cursorY - 5,
      page.width - page.marginX * 2,
      10,
      1.5,
      1.5,
      'F',
    )
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...colors.red)
    doc.text(
      `${String(index + 1).padStart(2, '0')}. ${safeText(chapter.name)}`,
      page.marginX + 3,
      cursorY + 1.5,
    )
    cursorY += 9
    cursorY = addPartidasTable(doc, chapter, cursorY)
  })

  cursorY = addSummary(
    doc,
    totals,
    summary.discountPercent,
    summary.ivaPercent,
    cursorY,
  )

  cursorY = sectionTitle(doc, 'Condiciones', cursorY)
  cursorY = addInfoRows(
    doc,
    filterFilledRows([
      ['Forma de pago', safeText(conditions.paymentTerms)],
      ['Plazo de ejecucion', safeText(conditions.executionTime)],
      ['Observaciones', safeText(conditions.notes)],
    ]),
    cursorY,
  )

  addSignatures(doc, cursorY, clientData, settings)
  addFooter(doc, generalData, settings)

  doc.save(buildBudgetPdfFileName(generalData.number, clientData.name))
}

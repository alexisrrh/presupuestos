import { useMemo, useState } from 'react'
import {
  normalizeDocumentType,
  normalizeTechnicalReport,
} from '../utils/professionalBudgetHelpers'

const createId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`

const getCurrentDate = () => {
  const now = new Date()
  const timezoneOffset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

const createBudgetItem = () => ({
  id: createId(),
  description: '',
  quantity: '1',
  unit: 'ud.',
  unitPrice: '',
})

const createChapter = (chapterNumber = 1) => ({
  id: createId(),
  name: `Capitulo ${chapterNumber}`,
  items: [createBudgetItem()],
})

function createInitialFormState(
  initialBudget,
  initialBudgetNumber,
  initialDate,
  defaultValues = {},
) {
  const documentType = normalizeDocumentType(initialBudget?.documentType)
  return {
    documentType,
    generalData: {
      number:
        initialBudget?.budgetNumber ||
        initialBudget?.generalData?.number ||
        initialBudgetNumber ||
        'PR-2026-0001',
      date: initialBudget?.generalData?.date || initialDate,
      validityDays:
        initialBudget?.generalData?.validityDays ||
        String(defaultValues.defaultValidityDays ?? 30),
      projectName: initialBudget?.generalData?.projectName || '',
      projectAddress: initialBudget?.generalData?.projectAddress || '',
    },
    clientData: {
      name: initialBudget?.clientData?.name || '',
      taxId: initialBudget?.clientData?.taxId || '',
      phone: initialBudget?.clientData?.phone || '',
      email: initialBudget?.clientData?.email || '',
      address: initialBudget?.clientData?.address || '',
    },
    chapters:
      initialBudget?.chapters && initialBudget.chapters.length > 0
        ? initialBudget.chapters
        : [createChapter()],
    summary: {
      discountPercent:
        initialBudget?.discountPercentage ??
        initialBudget?.summary?.discountPercent ??
        '0',
      ivaPercent:
        initialBudget?.vatPercentage ??
        initialBudget?.summary?.ivaPercent ??
        String(defaultValues.defaultVat ?? 21),
    },
    conditions: {
      paymentTerms:
        initialBudget?.conditions?.paymentTerms ||
        defaultValues.defaultPaymentTerms ||
        '',
      executionTime:
        initialBudget?.conditions?.executionTime ||
        defaultValues.defaultExecutionTime ||
        '',
      notes:
        initialBudget?.conditions?.notes ||
        defaultValues.defaultObservations ||
        '',
    },
    technicalReport: normalizeTechnicalReport(
      initialBudget?.technicalReport,
      !initialBudget || documentType === 'professional'
        ? defaultValues.professionalDefaults
        : {},
    ),
    status: initialBudget?.status || 'draft',
  }
}

function useBudgetForm(
  initialBudget = null,
  initialBudgetNumber = 'PR-2026-0001',
  defaultValues = {},
) {
  const initialDate = useMemo(() => getCurrentDate(), [])
  const initialFormState = useMemo(
    () =>
      createInitialFormState(
        initialBudget,
        initialBudgetNumber,
        initialDate,
        defaultValues,
      ),
    [defaultValues, initialBudget, initialBudgetNumber, initialDate],
  )
  const [generalData, setGeneralData] = useState(initialFormState.generalData)
  const [clientData, setClientData] = useState(initialFormState.clientData)
  const [chapters, setChapters] = useState(initialFormState.chapters)
  const [summary, setSummary] = useState(initialFormState.summary)
  const [conditions, setConditions] = useState(initialFormState.conditions)
  const [documentType, setDocumentType] = useState(initialFormState.documentType)
  const [status, setStatus] = useState(initialFormState.status)
  const [technicalReport, setTechnicalReport] = useState(
    initialFormState.technicalReport,
  )

  const updateGeneralData = (field, value) => {
    setGeneralData((current) => ({ ...current, [field]: value }))
  }

  const updateClientData = (field, value) => {
    setClientData((current) => ({ ...current, [field]: value }))
  }

  const updateSummary = (field, value) => {
    setSummary((current) => ({ ...current, [field]: value }))
  }

  const updateConditions = (field, value) => {
    setConditions((current) => ({ ...current, [field]: value }))
  }

  const updateTechnicalReport = (field, value) => {
    setTechnicalReport((current) => ({ ...current, [field]: value }))
  }

  const addChapter = () => {
    setChapters((current) => [...current, createChapter(current.length + 1)])
  }

  const removeChapter = (chapterId) => {
    setChapters((current) =>
      current.length > 1
        ? current.filter((chapter) => chapter.id !== chapterId)
        : current,
    )
  }

  const updateChapterName = (chapterId, value) => {
    setChapters((current) =>
      current.map((chapter) =>
        chapter.id === chapterId ? { ...chapter, name: value } : chapter,
      ),
    )
  }

  const addItem = (chapterId) => {
    setChapters((current) =>
      current.map((chapter) =>
        chapter.id === chapterId
          ? { ...chapter, items: [...chapter.items, createBudgetItem()] }
          : chapter,
      ),
    )
  }

  const updateItem = (chapterId, itemId, field, value) => {
    setChapters((current) =>
      current.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              items: chapter.items.map((item) =>
                item.id === itemId ? { ...item, [field]: value } : item,
              ),
            }
          : chapter,
      ),
    )
  }

  const duplicateItem = (chapterId, itemId) => {
    setChapters((current) =>
      current.map((chapter) => {
        if (chapter.id !== chapterId) {
          return chapter
        }

        const itemToDuplicate = chapter.items.find((item) => item.id === itemId)
        if (!itemToDuplicate) {
          return chapter
        }

        return {
          ...chapter,
          items: [
            ...chapter.items,
            {
              ...itemToDuplicate,
              id: createId(),
              description: itemToDuplicate.description
                ? `${itemToDuplicate.description} copia`
                : '',
            },
          ],
        }
      }),
    )
  }

  const removeItem = (chapterId, itemId) => {
    setChapters((current) =>
      current.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              items:
                chapter.items.length > 1
                  ? chapter.items.filter((item) => item.id !== itemId)
                  : chapter.items,
            }
          : chapter,
      ),
    )
  }

  return {
    addChapter,
    addItem,
    chapters,
    clientData,
    conditions,
    documentType,
    duplicateItem,
    generalData,
    removeChapter,
    removeItem,
    summary,
    status,
    technicalReport,
    updateChapterName,
    updateClientData,
    updateConditions,
    updateDocumentType: setDocumentType,
    updateGeneralData,
    updateItem,
    updateSummary,
    updateStatus: setStatus,
    updateTechnicalReport,
  }
}

export default useBudgetForm

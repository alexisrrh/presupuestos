import { ArrowLeft, FilePlus2, Plus } from 'lucide-react'
import { useEffect } from 'react'
import BudgetConditions from '../components/budget/BudgetConditions'
import BudgetGeneralData from '../components/budget/BudgetGeneralData'
import BudgetSummary from '../components/budget/BudgetSummary'
import ChapterEditor from '../components/budget/ChapterEditor'
import ClientData from '../components/budget/ClientData'
import TechnicalReportEditor from '../components/budget/TechnicalReportEditor'
import Button from '../components/ui/Button'
import { statusLabels } from '../data/budgetStatus'
import useBudgetForm from '../hooks/useBudgetForm'

function NewBudget({
  defaultValues,
  dirtyStatus = 'clean',
  initialBudget,
  initialBudgetNumber,
  onBack,
  onBudgetChange,
}) {
  const {
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
    updateDocumentType,
    updateGeneralData,
    updateItem,
    updateSummary,
    updateStatus,
    updateTechnicalReport,
  } = useBudgetForm(initialBudget, initialBudgetNumber, defaultValues)
  const dirtyLabels = {
    clean: 'Sin cambios',
    dirty: 'Cambios sin guardar',
    saved: 'Guardado',
    saving: 'Guardando...',
  }
  const dirtyClasses = {
    clean: 'border-[#d1d5db] bg-[#f8faf9] text-[#374151]',
    dirty: 'border-[#f6c08f] bg-[#fff7ed] text-[#9a3412]',
    saved: 'border-[#c7e2d3] bg-[#f3fbf6] text-[#166534]',
    saving: 'border-[#d1d5db] bg-white text-[#374151]',
  }

  useEffect(() => {
    onBudgetChange?.({
      id: initialBudget?.id,
      budgetNumber: generalData.number,
      chapters,
      clientData,
      conditions,
      documentType,
      discountPercentage: summary.discountPercent,
      generalData,
      summary,
      status,
      technicalReport,
      vatPercentage: summary.ivaPercent,
    })
  }, [
    chapters,
    clientData,
    conditions,
    documentType,
    generalData,
    initialBudget?.id,
    onBudgetChange,
    summary,
    status,
    technicalReport,
  ])

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-[#d8dfdb] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#fcf1f1] text-[#C62828]">
              <FilePlus2 size={22} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#60706a]">Nuevo presupuesto</p>
              <h2 className="mt-1 text-xl font-semibold text-[#111827]">
                Presupuesto de obra
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-[#60706a]">
                Completa los datos generales, cliente, capitulos, partidas y
                condiciones del presupuesto.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[#d1d5db] px-3 py-2 text-sm font-semibold text-[#111827] transition hover:bg-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#C62828] focus:ring-offset-2"
            onClick={onBack}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Volver al inicio
          </button>
        </div>
        <div
          className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${dirtyClasses[dirtyStatus]}`}
          aria-live="polite"
        >
          {dirtyLabels[dirtyStatus]}
        </div>
      </section>

      <section className="rounded-md border border-[#d8dfdb] bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#33443d]">
              Estado del presupuesto
            </span>
            <select
              className="w-full rounded-md border border-[#ccd6d1] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#C62828] focus:ring-2 focus:ring-[#C62828]/15"
              value={status}
              onChange={(event) => updateStatus(event.target.value)}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-2 block text-sm font-medium text-[#33443d]">
              Tipo de documento
            </span>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: 'Presupuesto rapido',
                  value: 'quick',
                  description: 'Documento PDF directo con datos economicos y condiciones.',
                },
                {
                  label: 'Presupuesto profesional',
                  value: 'professional',
                  description: 'Documento corporativo con memoria tecnica, metodo y aceptacion.',
                },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`rounded-md border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[#C62828] focus:ring-offset-2 ${
                    documentType === option.value
                      ? 'border-[#C62828] bg-[#fff5f5]'
                      : 'border-[#d1d5db] bg-white hover:bg-[#f8faf9]'
                  }`}
                  onClick={() => updateDocumentType(option.value)}
                >
                  <span className="block text-sm font-semibold text-[#111827]">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-sm text-[#6b7280]">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <BudgetGeneralData data={generalData} onChange={updateGeneralData} />
          <ClientData data={clientData} onChange={updateClientData} />

          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#111827]">
                  Capitulos y partidas
                </h2>
                <p className="mt-1 text-sm text-[#60706a]">
                  Organiza el presupuesto por fases o trabajos.
                </p>
              </div>
              <Button icon={Plus} onClick={addChapter}>
                Añadir capítulo
              </Button>
            </div>

            {chapters.map((chapter) => (
              <ChapterEditor
                key={chapter.id}
                chapter={chapter}
                onAddItem={() => addItem(chapter.id)}
                onChangeName={(value) => updateChapterName(chapter.id, value)}
                onDuplicateItem={(itemId) => duplicateItem(chapter.id, itemId)}
                onRemove={() => removeChapter(chapter.id)}
                onRemoveItem={(itemId) => removeItem(chapter.id, itemId)}
                onUpdateItem={(itemId, field, value) =>
                  updateItem(chapter.id, itemId, field, value)
                }
              />
            ))}
          </div>

          <BudgetConditions data={conditions} onChange={updateConditions} />

          {documentType === 'professional' && (
            <TechnicalReportEditor
              data={technicalReport}
              onChange={updateTechnicalReport}
            />
          )}
        </div>

        <BudgetSummary
          chapters={chapters}
          discountPercent={summary.discountPercent}
          ivaPercent={summary.ivaPercent}
          onChange={updateSummary}
        />
      </div>
    </div>
  )
}

export default NewBudget

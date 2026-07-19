import { FileText, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import BudgetHistoryTable from '../components/dashboard/BudgetHistoryTable'
import DashboardMetrics from '../components/dashboard/DashboardMetrics'
import Button from '../components/ui/Button'
import ConfirmModal from '../components/ui/ConfirmModal'
import Input from '../components/ui/Input'
import { calculateBudgetTotals } from '../utils/budgetCalculations'

const statusFilters = [
  { label: 'Todos', value: 'all' },
  { label: 'Borrador', value: 'draft' },
  { label: 'Enviado', value: 'sent' },
  { label: 'Aceptado', value: 'accepted' },
  { label: 'Rechazado', value: 'rejected' },
]

function getBudgetTotal(budget) {
  return calculateBudgetTotals(
    budget.chapters || [],
    budget.discountPercentage,
    budget.vatPercentage,
  ).total
}

function Dashboard({
  budgets,
  loading,
  onCreateBudget,
  onDeleteBudget,
  onDuplicateBudget,
  onGeneratePdf,
  onGenerateProfessionalPdf,
  onOpenBudget,
  onUpdateBudgetStatus,
  pdfGeneratingId,
}) {
  const [budgetToDelete, setBudgetToDelete] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const metrics = useMemo(
    () => ({
      accepted: budgets.filter((budget) => budget.status === 'accepted').length,
      drafts: budgets.filter((budget) => budget.status === 'draft').length,
      total: budgets.length,
      totalAmount: budgets.reduce((sum, budget) => sum + getBudgetTotal(budget), 0),
    }),
    [budgets],
  )
  const filteredBudgets = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return budgets.filter((budget) => {
      const matchesStatus = statusFilter === 'all' || budget.status === statusFilter
      const searchableText = [
        budget.budgetNumber,
        budget.clientData?.name,
        budget.generalData?.projectName,
      ]
        .join(' ')
        .toLowerCase()

      return matchesStatus && searchableText.includes(normalizedSearch)
    })
  }, [budgets, searchTerm, statusFilter])

  const confirmDelete = () => {
    if (!budgetToDelete) {
      return
    }

    onDeleteBudget(budgetToDelete.id)
    setBudgetToDelete(null)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-[#d8dfdb] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#60706a]">Panel principal</p>
            <h2 className="mt-2 text-xl font-semibold text-[#111827]">
              Gestion de presupuestos de obra
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[#60706a]">
              Crea y organiza presupuestos de construccion desde una base clara,
              preparada para incorporar partidas, clientes y documentos mas adelante.
            </p>
          </div>

          <Button icon={FileText} onClick={onCreateBudget}>
            Crear presupuesto
          </Button>
        </div>
      </section>

      <DashboardMetrics metrics={metrics} />

      <section className="rounded-md border border-[#d8dfdb] bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[#e3e8e5] px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">Historial</h2>
            <p className="mt-1 text-sm text-[#6b7280]">
              Busca, edita y gestiona los presupuestos guardados.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px] lg:w-[520px]">
            <label className="relative block">
              <span className="sr-only">Buscar presupuestos</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]"
                size={17}
                aria-hidden="true"
              />
              <Input
                className="pl-9"
                placeholder="Buscar por numero, cliente u obra"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="sr-only">Filtrar por estado</span>
              <select
                className="w-full rounded-md border border-[#ccd6d1] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#C62828] focus:ring-2 focus:ring-[#C62828]/15"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                {statusFilters.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-sm text-[#6b7280] sm:px-6">Cargando...</div>
        ) : filteredBudgets.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 py-12 text-center sm:px-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#f3f4f6] text-[#C62828]">
              <FileText size={24} aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-[#111827]">
              No hay presupuestos guardados
            </h3>
            <p className="mt-2 max-w-md text-sm text-[#60706a]">
              Guarda un borrador para que aparezca aqui y puedas editarlo mas tarde.
            </p>
            <Button icon={FileText} className="mt-5" onClick={onCreateBudget}>
              Crear presupuesto
            </Button>
          </div>
        ) : (
          <BudgetHistoryTable
            budgets={filteredBudgets}
            getBudgetTotal={getBudgetTotal}
            onDeleteClick={setBudgetToDelete}
            onDuplicateBudget={onDuplicateBudget}
            onGeneratePdf={onGeneratePdf}
            onGenerateProfessionalPdf={onGenerateProfessionalPdf}
            onOpenBudget={onOpenBudget}
            onUpdateBudgetStatus={onUpdateBudgetStatus}
            pdfGeneratingId={pdfGeneratingId}
          />
        )}
      </section>

      {budgetToDelete && (
        <ConfirmModal
          title="Eliminar presupuesto"
          description={`Vas a eliminar ${
            budgetToDelete.generalData?.projectName || budgetToDelete.budgetNumber
          }. Esta accion no se puede deshacer.`}
          onCancel={() => setBudgetToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}

export default Dashboard

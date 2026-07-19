import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from './components/layout/AppLayout'
import ConfirmModal from './components/ui/ConfirmModal'
import LocalMigrationModal from './components/ui/LocalMigrationModal'
import Toast from './components/ui/Toast'
import useBudgets from './hooks/useBudgets'
import useCompanySettings from './hooks/useCompanySettings'
import useAuth from './hooks/useAuth'
import { isSupabaseConfigured } from './lib/supabaseClient'
import Dashboard from './pages/Dashboard'
import ForgotPassword from './pages/ForgotPassword'
import Login from './pages/Login'
import NewBudget from './pages/NewBudget'
import Register from './pages/Register'
import Settings from './pages/Settings'
import SupabaseMissingConfig from './pages/SupabaseMissingConfig'
import {
  clearMigratedLocalBusinessData,
  getLocalMigrationSummary,
  migrateLocalDataToSupabase,
  omitLocalMigration,
} from './services/supabase/migrationService'
import { calculateBudgetTotals } from './utils/budgetCalculations'
import {
  createBudgetDirtySnapshot,
  hasUnsavedChanges,
} from './utils/budgetDirtyState'
import { getNextBudgetNumber } from './utils/budgetNumber'
import { getErrorMessage, logTechnicalError } from './utils/errorMessages'

function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const [authPage, setAuthPage] = useState('login')
  const [budgetSnapshot, setBudgetSnapshot] = useState(null)
  const [selectedBudget, setSelectedBudget] = useState(null)
  const [currentBudgetId, setCurrentBudgetId] = useState(null)
  const [formKey, setFormKey] = useState('new')
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(null)
  const [pendingNavigation, setPendingNavigation] = useState(null)
  const [localMigrationSummary, setLocalMigrationSummary] = useState(null)
  const [migrationStatus, setMigrationStatus] = useState('idle')
  const [pdfStatus, setPdfStatus] = useState('idle')
  const [pdfGeneratingId, setPdfGeneratingId] = useState(null)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [toast, setToast] = useState(null)
  const { loading: authLoading, session, signOut, user } = useAuth()
  const {
    refreshSettings,
    resetSettings,
    saveSettings,
    settings: companySettings,
  } = useCompanySettings(Boolean(session))
  const {
    budgets,
    duplicateExistingBudget,
    editBudget,
    loading,
    removeBudget,
    refreshBudgets,
    saveNewBudget,
  } = useBudgets(Boolean(session))

  const handleShowToast = useCallback((nextToast) => {
    setToast(nextToast)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  const isBudgetDirty = useMemo(
    () => hasUnsavedChanges(budgetSnapshot, lastSavedSnapshot),
    [budgetSnapshot, lastSavedSnapshot],
  )

  useEffect(() => {
    if (!isBudgetDirty) {
      return undefined
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isBudgetDirty])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      if (!user?.id) {
        setLocalMigrationSummary(null)
        return
      }

      const summary = getLocalMigrationSummary(user.id)
      setLocalMigrationSummary(summary.hasData ? summary : null)
    }, 0)

    return () => window.clearTimeout(timerId)
  }, [user?.id])

  const runOrConfirmNavigation = useCallback(
    (callback) => {
      if (activePage === 'new-budget' && isBudgetDirty) {
        setPendingNavigation(() => callback)
        return
      }

      callback()
    },
    [activePage, isBudgetDirty],
  )

  const handleNavigate = (page) => {
    if (page === 'new-budget') {
      runOrConfirmNavigation(handleCreateBudget)
      return
    }

    runOrConfirmNavigation(() => setActivePage(page === 'budgets' ? 'dashboard' : page))
  }

  const handleCreateBudget = () => {
    setSelectedBudget(null)
    setCurrentBudgetId(null)
    setFormKey(`new-${Date.now()}`)
    setBudgetSnapshot(null)
    setLastSavedSnapshot(null)
    setSaveStatus('idle')
    setActivePage('new-budget')
  }

  const handleOpenBudget = (budget) => {
    setSelectedBudget(budget)
    setCurrentBudgetId(budget.id)
    setFormKey(budget.id)
    const snapshotBudget = {
      ...budget,
      summary: {
        discountPercent: budget.discountPercentage,
        ivaPercent: budget.vatPercentage,
      },
    }
    setBudgetSnapshot(snapshotBudget)
    setLastSavedSnapshot(createBudgetDirtySnapshot(snapshotBudget))
    setSaveStatus('idle')
    setActivePage('new-budget')
  }

  const handleBudgetChange = useCallback((budget) => {
    setBudgetSnapshot(budget)
    setLastSavedSnapshot((currentSnapshot) =>
      currentSnapshot || createBudgetDirtySnapshot(budget),
    )
  }, [])

  const buildPdfTotals = (budget) => {
    const discountPercent = budget.summary?.discountPercent ?? budget.discountPercentage ?? '0'
    const ivaPercent = budget.summary?.ivaPercent ?? budget.vatPercentage ?? '21'

    return calculateBudgetTotals(budget.chapters || [], discountPercent, ivaPercent)
  }

  const handleGeneratePdf = async (budget = budgetSnapshot) => {
    if (!budget) {
      return
    }

    setPdfStatus('generating')
    setPdfGeneratingId(budget.id || 'current')

    try {
      const { generateBudgetPdf } = await import('./utils/generateBudgetPdf')
      await generateBudgetPdf(
        {
          ...budget,
          summary: {
            discountPercent:
              budget.summary?.discountPercent ?? budget.discountPercentage ?? '0',
            ivaPercent: budget.summary?.ivaPercent ?? budget.vatPercentage ?? '21',
          },
        },
        buildPdfTotals(budget),
        companySettings,
      )
      handleShowToast({ message: 'PDF generado', type: 'success' })
    } catch (error) {
      logTechnicalError(error, 'Error generando PDF rapido')
      handleShowToast({ message: getErrorMessage(error), type: 'error' })
    } finally {
      setPdfStatus('idle')
      setPdfGeneratingId(null)
    }
  }

  const handleGenerateProfessionalPdf = async (budget = budgetSnapshot) => {
    if (!budget) {
      return
    }

    setPdfStatus('generating')
    setPdfGeneratingId(budget.id || 'current')

    try {
      const { generateProfessionalBudgetPdf } = await import(
        './utils/generateProfessionalBudgetPdf'
      )
      await generateProfessionalBudgetPdf(
        {
          ...budget,
          summary: {
            discountPercent:
              budget.summary?.discountPercent ?? budget.discountPercentage ?? '0',
            ivaPercent: budget.summary?.ivaPercent ?? budget.vatPercentage ?? '21',
          },
        },
        buildPdfTotals(budget),
        companySettings,
      )
      handleShowToast({ message: 'PDF profesional generado', type: 'success' })
    } catch (error) {
      logTechnicalError(error, 'Error generando PDF profesional')
      handleShowToast({ message: getErrorMessage(error), type: 'error' })
    } finally {
      setPdfStatus('idle')
      setPdfGeneratingId(null)
    }
  }

  const handleSaveDraft = async () => {
    if (!budgetSnapshot || saveStatus === 'saving') {
      return
    }

    setSaveStatus('saving')

    try {
      const payload = {
        ...budgetSnapshot,
        id: currentBudgetId || budgetSnapshot.id,
        status: budgetSnapshot.status || 'draft',
      }
      const savedBudget = payload.id
        ? await editBudget(payload.id, payload)
        : await saveNewBudget(payload)

      setCurrentBudgetId(savedBudget.id)
      setSelectedBudget(savedBudget)
      setBudgetSnapshot({
        ...savedBudget,
        summary: {
          discountPercent: savedBudget.discountPercentage,
          ivaPercent: savedBudget.vatPercentage,
        },
      })
      setLastSavedSnapshot(
        createBudgetDirtySnapshot({
          ...savedBudget,
          summary: {
            discountPercent: savedBudget.discountPercentage,
            ivaPercent: savedBudget.vatPercentage,
          },
        }),
      )
      setSaveStatus('saved')
      handleShowToast({ message: 'Guardado', type: 'success' })
      window.setTimeout(() => setSaveStatus('idle'), 1600)
    } catch (error) {
      logTechnicalError(error, 'Error guardando presupuesto')
      setSaveStatus('error')
      handleShowToast({ message: getErrorMessage(error), type: 'error' })
      window.setTimeout(() => setSaveStatus('idle'), 2200)
    }
  }

  const handleDuplicateBudget = async (id) => {
    try {
      const duplicatedBudget = await duplicateExistingBudget(id)
      if (duplicatedBudget) {
        handleShowToast({ message: 'Presupuesto duplicado', type: 'success' })
      }
    } catch (error) {
      logTechnicalError(error, 'Error duplicando presupuesto')
      handleShowToast({ message: getErrorMessage(error), type: 'error' })
    }
  }

  const handleUpdateBudgetStatus = async (id, status) => {
    try {
      await editBudget(id, { status })
    } catch (error) {
      logTechnicalError(error, 'Error actualizando estado')
      handleShowToast({ message: getErrorMessage(error), type: 'error' })
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      logTechnicalError(error, 'Error cerrando sesion')
      handleShowToast({ message: getErrorMessage(error), type: 'error' })
    }
  }

  const handleSaveSettings = async (nextSettings) => {
    if (nextSettings) {
      return saveSettings(nextSettings)
    }

    return resetSettings()
  }

  const handleBackFromBudget = () => {
    runOrConfirmNavigation(() => setActivePage('dashboard'))
  }

  const handleDataImported = async () => {
    await Promise.all([refreshBudgets(), refreshSettings()])
  }

  const handleImportLocalData = async () => {
    if (!user?.id) {
      return
    }

    setMigrationStatus('loading')
    try {
      const result = await migrateLocalDataToSupabase(user.id)
      await refreshBudgets()
      await refreshSettings()
      setMigrationStatus('completed')
      handleShowToast({
        message: `Migracion completada: ${result.importedBudgets} presupuestos importados`,
        type: 'success',
      })
    } catch (error) {
      logTechnicalError(error, 'Error migrando datos locales')
      setMigrationStatus('idle')
      handleShowToast({ message: getErrorMessage(error), type: 'error' })
    }
  }

  const handleOmitLocalMigration = () => {
    if (user?.id) {
      omitLocalMigration(user.id)
    }
    setLocalMigrationSummary(null)
    setMigrationStatus('idle')
  }

  const handleClearLocalCopy = () => {
    clearMigratedLocalBusinessData()
    setLocalMigrationSummary(null)
    setMigrationStatus('idle')
    handleShowToast({ message: 'Copia local eliminada', type: 'success' })
  }

  const handleDeleteBudget = async (id) => {
    try {
      await removeBudget(id)
      handleShowToast({ message: 'Presupuesto eliminado', type: 'success' })
    } catch (error) {
      logTechnicalError(error, 'Error eliminando presupuesto')
      handleShowToast({ message: getErrorMessage(error), type: 'error' })
    }
  }

  const handleConfirmNavigation = () => {
    const navigation = pendingNavigation
    setPendingNavigation(null)
    setLastSavedSnapshot(null)
    navigation?.()
  }

  if (!isSupabaseConfigured) {
    return <SupabaseMissingConfig />
  }

  if (authLoading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#f5f7f6] text-sm font-medium text-[#6b7280]">
        Comprobando sesion...
      </main>
    )
  }

  if (!session) {
    if (authPage === 'register') {
      return <Register onNavigate={setAuthPage} />
    }

    if (authPage === 'forgot-password') {
      return <ForgotPassword onNavigate={setAuthPage} />
    }

    return <Login onNavigate={setAuthPage} />
  }

  return (
    <>
      <AppLayout
        activePage={activePage}
        budgetSnapshot={budgetSnapshot}
        companySettings={companySettings}
        onGeneratePdf={() => handleGeneratePdf()}
        onGenerateProfessionalPdf={() => handleGenerateProfessionalPdf()}
        onNavigate={handleNavigate}
        onSaveDraft={handleSaveDraft}
        onSignOut={handleSignOut}
        pdfStatus={pdfStatus}
        saveStatus={saveStatus}
      >
        {activePage === 'new-budget' ? (
          <NewBudget
            key={formKey}
            initialBudget={selectedBudget}
            initialBudgetNumber={getNextBudgetNumber(budgets)}
            defaultValues={selectedBudget ? {} : companySettings}
            dirtyStatus={
              saveStatus === 'saving'
                ? 'saving'
                : isBudgetDirty
                  ? 'dirty'
                  : saveStatus === 'saved'
                    ? 'saved'
                    : 'clean'
            }
            onBack={handleBackFromBudget}
            onBudgetChange={handleBudgetChange}
          />
        ) : activePage === 'settings' ? (
          <Settings
            onBack={() => setActivePage('dashboard')}
            onDataImported={handleDataImported}
            onSettingsSaved={handleSaveSettings}
            onShowToast={handleShowToast}
            settings={companySettings}
          />
        ) : (
          <Dashboard
            budgets={budgets}
            loading={loading}
            onCreateBudget={handleCreateBudget}
            onDeleteBudget={handleDeleteBudget}
            onDuplicateBudget={handleDuplicateBudget}
            onGeneratePdf={handleGeneratePdf}
            onGenerateProfessionalPdf={handleGenerateProfessionalPdf}
            onOpenBudget={handleOpenBudget}
            onUpdateBudgetStatus={handleUpdateBudgetStatus}
            pdfGeneratingId={pdfGeneratingId}
          />
        )}
      </AppLayout>
      <Toast message={toast?.message} type={toast?.type} />
      {pendingNavigation && (
        <ConfirmModal
          confirmLabel="Salir sin guardar"
          title="Cambios sin guardar"
          description="Este presupuesto tiene cambios sin guardar. Si vuelves al panel, perderas los cambios realizados desde el ultimo guardado."
          onCancel={() => setPendingNavigation(null)}
          onConfirm={handleConfirmNavigation}
        />
      )}
      {localMigrationSummary && (
        <LocalMigrationModal
          isCompleted={migrationStatus === 'completed'}
          isLoading={migrationStatus === 'loading'}
          onClearLocalCopy={handleClearLocalCopy}
          onImport={handleImportLocalData}
          onOmit={handleOmitLocalMigration}
          summary={localMigrationSummary}
        />
      )}
    </>
  )
}

export default App

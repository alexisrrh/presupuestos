import { ArrowLeft, RotateCcw, Save } from 'lucide-react'
import { useState } from 'react'
import BackupImportModal from '../components/settings/BackupImportModal'
import BackupSection from '../components/settings/BackupSection'
import CompanyDataSection from '../components/settings/CompanyDataSection'
import DefaultValuesSection from '../components/settings/DefaultValuesSection'
import LogoSettingsSection from '../components/settings/LogoSettingsSection'
import ProfessionalDefaultsSection from '../components/settings/ProfessionalDefaultsSection'
import ConfirmModal from '../components/ui/ConfirmModal'
import { exportBackup, importBackup, validateBackup } from '../services/backupService'
import { getErrorMessage, logTechnicalError } from '../utils/errorMessages'
import { readLogoFileAsDataUrl, validateLogoFile } from '../utils/logoFile'

function Settings({
  onBack,
  onDataImported,
  onSettingsSaved,
  onShowToast,
  settings,
}) {
  const [backupError, setBackupError] = useState('')
  const [formData, setFormData] = useState(settings)
  const [importBackupData, setImportBackupData] = useState(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle')

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }))
  }

  const handleLogoChange = async (event) => {
    const file = event.target.files?.[0]
    const validationError = validateLogoFile(file)
    event.target.value = ''

    if (validationError) {
      setLogoError(validationError)
      return
    }

    try {
      const logoDataUrl = await readLogoFileAsDataUrl(file)
      updateField('logo', logoDataUrl)
      setLogoError('')
    } catch (error) {
      logTechnicalError(error, 'Error leyendo logo')
      setLogoError(getErrorMessage(error, 'No se pudo leer el archivo.'))
    }
  }

  const handleSave = async () => {
    setSaveStatus('saving')

    try {
      const savedSettings = await onSettingsSaved(formData)
      setFormData(savedSettings)
      setSaveStatus('saved')
      onShowToast({ message: 'Configuracion guardada', type: 'success' })
      window.setTimeout(() => setSaveStatus('idle'), 1600)
    } catch (error) {
      logTechnicalError(error, 'Error guardando configuracion')
      setSaveStatus('error')
      onShowToast({ message: getErrorMessage(error), type: 'error' })
      window.setTimeout(() => setSaveStatus('idle'), 2200)
    }
  }

  const handleReset = async () => {
    try {
      const restoredSettings = await onSettingsSaved(null)
      setFormData(restoredSettings)
      setIsResetModalOpen(false)
      setLogoError('')
      onShowToast({ message: 'Valores predeterminados restaurados', type: 'success' })
    } catch (error) {
      logTechnicalError(error, 'Error restaurando configuracion')
      onShowToast({ message: getErrorMessage(error), type: 'error' })
    }
  }

  const saveLabel = {
    error: 'Error al guardar',
    idle: 'Guardar configuracion',
    saved: 'Configuracion guardada',
    saving: 'Guardando...',
  }[saveStatus]

  const handleExportBackup = async () => {
    try {
      await exportBackup({ remote: true })
      setBackupError('')
      onShowToast({ message: 'Backup exportado', type: 'success' })
    } catch (error) {
      logTechnicalError(error, 'Error exportando backup')
      setBackupError(getErrorMessage(error, 'No se pudo exportar la copia.'))
    }
  }

  const handleImportFile = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (!file.name.toLowerCase().endsWith('.json') || file.type && file.type !== 'application/json') {
      setBackupError('Selecciona un archivo JSON valido.')
      return
    }

    setIsImporting(true)
    const reader = new FileReader()

    reader.onload = () => {
      try {
        const validatedBackup = validateBackup(reader.result)
        setImportBackupData(validatedBackup)
        setBackupError('')
      } catch (error) {
        logTechnicalError(error, 'Error validando backup')
        setBackupError(getErrorMessage(error, 'La copia de seguridad no es valida.'))
      } finally {
        setIsImporting(false)
      }
    }

    reader.onerror = () => {
      setIsImporting(false)
      setBackupError('No se pudo leer el archivo seleccionado.')
    }

    reader.readAsText(file)
  }

  const handleConfirmImport = async (mode) => {
    try {
      const result = await importBackup({ backup: importBackupData, remote: true }, mode)
      setImportBackupData(null)
      setFormData(result.companySettings)
      await onDataImported?.()
      onShowToast({ message: 'Backup importado', type: 'success' })
    } catch (error) {
      logTechnicalError(error, 'Error importando backup')
      setBackupError(getErrorMessage(error, 'No se pudo importar la copia.'))
      setImportBackupData(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-[#d8dfdb] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#6b7280]">Configuracion</p>
            <h2 className="mt-1 text-xl font-semibold text-[#111827]">
              Datos de empresa
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[#6b7280]">
              Define los datos corporativos, valores por defecto y logo usados en
              la aplicacion y en los documentos PDF.
            </p>
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
      </section>

      <CompanyDataSection data={formData} onChange={updateField} />
      <DefaultValuesSection data={formData} onChange={updateField} />
      <ProfessionalDefaultsSection data={formData} onChange={updateField} />
      <LogoSettingsSection
        data={formData}
        error={logoError}
        onChange={updateField}
        onLogoChange={handleLogoChange}
      />
      <BackupSection
        error={backupError}
        isImporting={isImporting}
        onExport={handleExportBackup}
        onImportFile={handleImportFile}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-[#d1d5db] px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#C62828] focus:ring-offset-2"
          onClick={() => setIsResetModalOpen(true)}
        >
          <RotateCcw size={16} aria-hidden="true" />
          Restaurar valores predeterminados
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[#C62828] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#B71C1C] focus:outline-none focus:ring-2 focus:ring-[#C62828] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={saveStatus === 'saving'}
          onClick={handleSave}
        >
          <Save size={16} aria-hidden="true" />
          {saveLabel}
        </button>
      </div>

      {isResetModalOpen && (
        <ConfirmModal
          confirmLabel="Restaurar"
          title="Restaurar configuracion"
          description="Vas a restaurar los datos de empresa y valores predeterminados. Esta accion sustituira la configuracion guardada."
          onCancel={() => setIsResetModalOpen(false)}
          onConfirm={handleReset}
        />
      )}
      {importBackupData && (
        <BackupImportModal
          backup={importBackupData}
          onCancel={() => setImportBackupData(null)}
          onConfirm={handleConfirmImport}
        />
      )}
    </div>
  )
}

export default Settings

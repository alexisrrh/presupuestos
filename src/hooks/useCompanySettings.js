import { useCallback, useEffect, useState } from 'react'
import { companyData } from '../data/companyData'
import * as companyService from '../services/supabase/companyService'

function useCompanySettings(enabled = true) {
  const [error, setError] = useState('')
  const [settings, setSettings] = useState(companyData)
  const [loading, setLoading] = useState(Boolean(enabled))

  const refreshSettings = useCallback(() => {
    if (!enabled) {
      setSettings(companyData)
      setLoading(false)
      return Promise.resolve(companyData)
    }

    setLoading(true)
    setError('')
    return companyService
      .getCompanySettings()
      .then((nextSettings) => {
        setSettings(nextSettings)
        return nextSettings
      })
      .catch((nextError) => {
        setError(nextError.message || 'No se pudo cargar la configuracion.')
        throw nextError
      })
      .finally(() => setLoading(false))
  }, [enabled])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      refreshSettings().catch(() => {})
    }, 0)

    return () => window.clearTimeout(timerId)
  }, [refreshSettings])

  const saveSettings = useCallback(async (nextSettings) => {
    const savedSettings = await companyService.saveCompanySettings(nextSettings)
    setSettings(savedSettings)
    return savedSettings
  }, [])

  const resetSettings = useCallback(async () => {
    const restoredSettings = await companyService.saveCompanySettings(companyData)
    setSettings(restoredSettings)
    return restoredSettings
  }, [])

  return {
    error,
    loading,
    refreshSettings,
    resetSettings,
    saveSettings,
    settings,
  }
}

export default useCompanySettings

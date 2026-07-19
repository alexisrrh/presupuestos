import { companyData } from '../data/companyData'

// Almacenamiento local temporal: se mantiene como respaldo durante la migracion
// progresiva a Supabase. No sincroniza ni sube datos remotos automaticamente.
export const COMPANY_SETTINGS_STORAGE_KEY = 'priteca_company_settings'

export const defaultCompanySettings = { ...companyData }

function getStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage
}

function normalizeNumber(value, fallback) {
  const numberValue = Number.parseFloat(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function normalizeSettings(settings = {}) {
  const mergedSettings = {
    ...defaultCompanySettings,
    ...settings,
    professionalDefaults: {
      ...defaultCompanySettings.professionalDefaults,
      ...(settings.professionalDefaults || {}),
    },
  }

  return {
    ...mergedSettings,
    defaultVat: normalizeNumber(
      mergedSettings.defaultVat,
      defaultCompanySettings.defaultVat,
    ),
    defaultValidityDays: normalizeNumber(
      mergedSettings.defaultValidityDays,
      defaultCompanySettings.defaultValidityDays,
    ),
  }
}

export function getCompanySettings() {
  const storage = getStorage()

  if (!storage) {
    return normalizeSettings()
  }

  try {
    const parsedSettings = JSON.parse(
      storage.getItem(COMPANY_SETTINGS_STORAGE_KEY) || '{}',
    )

    return normalizeSettings(
      parsedSettings && typeof parsedSettings === 'object' ? parsedSettings : {},
    )
  } catch {
    return normalizeSettings()
  }
}

export function saveCompanySettings(settings) {
  const storage = getStorage()
  const nextSettings = normalizeSettings(settings)

  if (storage) {
    storage.setItem(COMPANY_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings))
  }

  return nextSettings
}

export function resetCompanySettings() {
  const storage = getStorage()
  const nextSettings = normalizeSettings()

  if (storage) {
    storage.setItem(COMPANY_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings))
  }

  return nextSettings
}

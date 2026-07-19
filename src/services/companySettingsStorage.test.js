import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COMPANY_SETTINGS_STORAGE_KEY,
  defaultCompanySettings,
  getCompanySettings,
  resetCompanySettings,
  saveCompanySettings,
} from './companySettingsStorage'

function createStorageMock() {
  let store = {}

  return {
    clear: vi.fn(() => {
      store = {}
    }),
    getItem: vi.fn((key) => store[key] || null),
    removeItem: vi.fn((key) => {
      delete store[key]
    }),
    setItem: vi.fn((key, value) => {
      store[key] = String(value)
    }),
  }
}

describe('companySettingsStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock())
  })

  it('devuelve valores predeterminados sin datos guardados', () => {
    expect(getCompanySettings()).toEqual(defaultCompanySettings)
  })

  it('guarda configuracion', () => {
    const savedSettings = saveCompanySettings({
      ...defaultCompanySettings,
      email: 'info@priteca.test',
      phone: '600000000',
    })

    expect(savedSettings.email).toBe('info@priteca.test')
    expect(getCompanySettings().phone).toBe('600000000')
  })

  it('combina datos parciales con los predeterminados', () => {
    saveCompanySettings({ name: 'PRITECA Obras' })

    expect(getCompanySettings()).toMatchObject({
      ...defaultCompanySettings,
      name: 'PRITECA Obras',
    })
  })

  it('maneja JSON corrupto', () => {
    localStorage.setItem(COMPANY_SETTINGS_STORAGE_KEY, '{json roto')

    expect(getCompanySettings()).toEqual(defaultCompanySettings)
  })

  it('normaliza IVA como numero', () => {
    saveCompanySettings({ defaultVat: '10.5' })

    expect(getCompanySettings().defaultVat).toBe(10.5)
  })

  it('normaliza validez como numero', () => {
    saveCompanySettings({ defaultValidityDays: '45' })

    expect(getCompanySettings().defaultValidityDays).toBe(45)
  })

  it('restaura valores predeterminados', () => {
    saveCompanySettings({ name: 'Otra empresa', defaultVat: 10 })
    resetCompanySettings()

    expect(getCompanySettings()).toEqual(defaultCompanySettings)
  })

  it('conserva el logo data URL', () => {
    const logo = 'data:image/png;base64,AAA'
    saveCompanySettings({ logo })

    expect(getCompanySettings().logo).toBe(logo)
  })

  it('los campos desconocidos no rompen el servicio', () => {
    saveCompanySettings({ campoDesconocido: 'valor', name: 'PRITECA' })

    expect(getCompanySettings().name).toBe('PRITECA')
    expect(getCompanySettings().defaultVat).toBe(21)
  })
})

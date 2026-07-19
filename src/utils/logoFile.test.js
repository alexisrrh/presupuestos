import { describe, expect, it } from 'vitest'
import {
  isAllowedLogoMimeType,
  isLogoFileSizeValid,
  LOGO_MAX_SIZE_BYTES,
  validateLogoFile,
} from './logoFile'

describe('logoFile', () => {
  it('acepta PNG, JPG y WebP', () => {
    expect(isAllowedLogoMimeType('image/png')).toBe(true)
    expect(isAllowedLogoMimeType('image/jpeg')).toBe(true)
    expect(isAllowedLogoMimeType('image/webp')).toBe(true)
  })

  it('rechaza otros formatos', () => {
    expect(isAllowedLogoMimeType('image/svg+xml')).toBe(false)
  })

  it('valida el tamaño maximo del logo', () => {
    expect(isLogoFileSizeValid(LOGO_MAX_SIZE_BYTES)).toBe(true)
    expect(isLogoFileSizeValid(LOGO_MAX_SIZE_BYTES + 1)).toBe(false)
  })

  it('devuelve error si no hay archivo', () => {
    expect(validateLogoFile(null)).toBe('Selecciona una imagen valida.')
  })

  it('devuelve error para formato no permitido', () => {
    expect(validateLogoFile({ size: 100, type: 'image/gif' })).toBe(
      'El logo debe ser PNG, JPG o WebP.',
    )
  })

  it('devuelve error si supera 2 MB', () => {
    expect(validateLogoFile({ size: LOGO_MAX_SIZE_BYTES + 1, type: 'image/png' })).toBe(
      'El logo no puede superar 2 MB.',
    )
  })

  it('no devuelve error para un logo valido', () => {
    expect(validateLogoFile({ size: 1000, type: 'image/png' })).toBe('')
  })
})

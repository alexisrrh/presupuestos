import { describe, expect, it } from 'vitest'
import { normalizeAuthError } from './authService'

describe('authService', () => {
  it('normaliza errores de Supabase con mensaje', () => {
    expect(normalizeAuthError({ message: 'Credenciales invalidas' })).toBe(
      'Credenciales invalidas',
    )
  })

  it('normaliza errores vacios con mensaje generico', () => {
    expect(normalizeAuthError({})).toBe(
      'No se pudo completar la operacion de autenticacion.',
    )
  })

  it('devuelve texto vacio si no hay error', () => {
    expect(normalizeAuthError(null)).toBe('')
  })
})

import { describe, expect, it } from 'vitest'
import { getErrorMessage } from './errorMessages'

describe('errorMessages', () => {
  it('normaliza errores conocidos de red', () => {
    expect(getErrorMessage(new Error('Failed to fetch'))).toBe(
      'No se pudo conectar con el servicio. Revisa la conexion e intentalo de nuevo.',
    )
  })

  it('devuelve mensaje generico seguro', () => {
    expect(getErrorMessage(new Error('TypeError: fallo interno'))).toBe(
      'Ha ocurrido un error. Intentalo de nuevo.',
    )
  })

  it('no expone stack trace', () => {
    const message = getErrorMessage({
      message: 'Error interno',
      stack: 'at secreto.js:1',
    })

    expect(message).not.toContain('secreto.js')
  })

  it('normaliza sesion expirada', () => {
    expect(getErrorMessage(new Error('JWT expired'))).toBe(
      'La sesion ha caducado. Inicia sesion de nuevo.',
    )
  })
})

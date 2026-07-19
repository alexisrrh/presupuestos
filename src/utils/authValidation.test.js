import { describe, expect, it } from 'vitest'
import {
  hasValidationErrors,
  validateLoginForm,
  validateRegisterForm,
} from './authValidation'

describe('authValidation', () => {
  it('valida login correcto', () => {
    expect(
      validateLoginForm({ email: 'usuario@priteca.test', password: 'password' }),
    ).toEqual({})
  })

  it('detecta correo invalido en login', () => {
    expect(validateLoginForm({ email: 'mal', password: 'password' }).email).toBe(
      'Introduce un correo valido.',
    )
  })

  it('detecta contraseña vacia en login', () => {
    expect(validateLoginForm({ email: 'usuario@priteca.test', password: '' }).password).toBe(
      'La contraseña es obligatoria.',
    )
  })

  it('valida registro correcto', () => {
    expect(
      validateRegisterForm({
        confirmPassword: 'password123',
        email: 'usuario@priteca.test',
        fullName: 'Usuario',
        password: 'password123',
      }),
    ).toEqual({})
  })

  it('detecta nombre obligatorio en registro', () => {
    expect(
      validateRegisterForm({
        confirmPassword: 'password123',
        email: 'usuario@priteca.test',
        fullName: '',
        password: 'password123',
      }).fullName,
    ).toBe('El nombre es obligatorio.')
  })

  it('detecta contraseña corta en registro', () => {
    expect(
      validateRegisterForm({
        confirmPassword: '123',
        email: 'usuario@priteca.test',
        fullName: 'Usuario',
        password: '123',
      }).password,
    ).toBe('La contraseña debe tener al menos 8 caracteres.')
  })

  it('detecta contraseñas diferentes en registro', () => {
    expect(
      validateRegisterForm({
        confirmPassword: 'password456',
        email: 'usuario@priteca.test',
        fullName: 'Usuario',
        password: 'password123',
      }).confirmPassword,
    ).toBe('Las contraseñas no coinciden.')
  })

  it('detecta si hay errores de validacion', () => {
    expect(hasValidationErrors({ email: 'error' })).toBe(true)
    expect(hasValidationErrors({})).toBe(false)
  })
})

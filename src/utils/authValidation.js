export function validateEmail(email) {
  if (!email) {
    return 'El correo es obligatorio.'
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Introduce un correo valido.'
  }

  return ''
}

export function validateLoginForm({ email, password }) {
  const errors = {}
  const emailError = validateEmail(email)

  if (emailError) {
    errors.email = emailError
  }

  if (!password) {
    errors.password = 'La contraseña es obligatoria.'
  }

  return errors
}

export function validateRegisterForm({ confirmPassword, email, fullName, password }) {
  const errors = validateLoginForm({ email, password })

  if (!fullName) {
    errors.fullName = 'El nombre es obligatorio.'
  }

  if (password && password.length < 8) {
    errors.password = 'La contraseña debe tener al menos 8 caracteres.'
  }

  if (password !== confirmPassword) {
    errors.confirmPassword = 'Las contraseñas no coinciden.'
  }

  return errors
}

export function hasValidationErrors(errors) {
  return Object.keys(errors).length > 0
}

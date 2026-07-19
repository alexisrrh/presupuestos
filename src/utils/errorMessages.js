const fallbackMessage = 'Ha ocurrido un error. Intentalo de nuevo.'

const knownErrorMessages = [
  {
    match: /supabase|fetch|network|failed to fetch|auth/i,
    message: 'No se pudo conectar con el servicio. Revisa la conexion e intentalo de nuevo.',
  },
  {
    match: /sesion|session|jwt|token/i,
    message: 'La sesion ha caducado. Inicia sesion de nuevo.',
  },
  {
    match: /localstorage|quota|storage/i,
    message: 'No se pudieron guardar los datos locales. Revisa el espacio disponible del navegador.',
  },
  {
    match: /json|parse|unexpected token/i,
    message: 'El archivo o los datos guardados no tienen un formato valido.',
  },
  {
    match: /pdf|jspdf|autotable/i,
    message: 'No se pudo generar el PDF. Revisa los datos e intentalo de nuevo.',
  },
]

export function logTechnicalError(error, context = '') {
  if (import.meta.env?.DEV) {
    console.error(context || 'Error tecnico', error)
  }
}

export function getErrorMessage(error, fallback = fallbackMessage) {
  const source =
    typeof error === 'string'
      ? error
      : error?.message || error?.error_description || error?.details || ''

  const knownError = knownErrorMessages.find(({ match }) => match.test(source))

  return knownError?.message || fallback
}

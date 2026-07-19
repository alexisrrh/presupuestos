export const LOGO_MAX_SIZE_BYTES = 2 * 1024 * 1024
export const LOGO_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function isAllowedLogoMimeType(type) {
  return LOGO_ALLOWED_TYPES.includes(type)
}

export function isLogoFileSizeValid(size) {
  return Number.isFinite(size) && size <= LOGO_MAX_SIZE_BYTES
}

export function validateLogoFile(file) {
  if (!file) {
    return 'Selecciona una imagen valida.'
  }

  if (!isAllowedLogoMimeType(file.type)) {
    return 'El logo debe ser PNG, JPG o WebP.'
  }

  if (!isLogoFileSizeValid(file.size)) {
    return 'El logo no puede superar 2 MB.'
  }

  return ''
}

export function readLogoFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const validationError = validateLogoFile(file)

    if (validationError) {
      reject(new Error(validationError))
      return
    }

    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsDataURL(file)
  })
}

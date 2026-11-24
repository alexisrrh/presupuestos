import logoHorizontal from '../assets/branding/PRITECA_logo_OEPM.png'
import logoIsotype from '../assets/branding/priteca-isotipo-transparent.png'

export const APP_NAME = 'PRITECA Presupuestos'
export const COMPANY_NAME = 'PRITECA'
export const COMPANY_LEGAL_NAME = 'Proyectos de Ingeniería Técnica y Construcción Avanzada, S. L.'
export const COMPANY_TAGLINE =
  'Proyectos de Ingeniería Técnica y Construcción Avanzada'

export const BRAND_COLORS = {
  navy: '#082B5C',
  navyDark: '#061F42',
  orange: '#FF5A00',
  orangeHover: '#E64F00',
  muted: '#EEF4FA',
  white: '#FFFFFF',
}

export const LOGO_HORIZONTAL = logoHorizontal
export const LOGO_ISOTYPE = logoIsotype

export function getDefaultCompanyLogo() {
  return LOGO_HORIZONTAL
}

export function getLogoWithFallback(settings = {}) {
  return settings.logo || settings.logoUrl || LOGO_HORIZONTAL || LOGO_ISOTYPE
}

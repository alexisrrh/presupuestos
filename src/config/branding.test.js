import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { companyData } from '../data/companyData'
import {
  APP_NAME,
  BRAND_COLORS,
  COMPANY_NAME,
  COMPANY_TAGLINE,
  LOGO_HORIZONTAL,
  LOGO_ISOTYPE,
  getLogoWithFallback,
} from './branding'

function assetExists(assetUrl) {
  const relativePath = String(assetUrl).replace(/^\//, '')
  return existsSync(new URL(`../../${relativePath}`, import.meta.url))
}

describe('branding', () => {
  it('expone la identidad visual por defecto', () => {
    expect(APP_NAME).toBe('PRITECA Presupuestos')
    expect(COMPANY_NAME).toBe('PRITECA')
    expect(COMPANY_TAGLINE).toBe(
      'Proyectos de Ingeniería Técnica y Construcción Avanzada',
    )
    expect(BRAND_COLORS.navy).toBe('#082B5C')
    expect(BRAND_COLORS.orange).toBe('#FF5A00')
  })

  it('importa logos validos del proyecto', () => {
    expect(LOGO_HORIZONTAL).toContain('PRITECA_logo_OEPM')
    expect(LOGO_ISOTYPE).toContain('priteca-isotipo')
    expect(assetExists(LOGO_HORIZONTAL)).toBe(true)
    expect(assetExists(LOGO_ISOTYPE)).toBe(true)
  })

  it('usa el logo horizontal como logo de empresa predeterminado', () => {
    expect(companyData.logo).toBe(LOGO_HORIZONTAL)
    expect(getLogoWithFallback({})).toBe(LOGO_HORIZONTAL)
  })

  it('prioriza logo personalizado frente al predeterminado', () => {
    expect(getLogoWithFallback({ logo: 'data:image/png;base64,AAA' })).toBe(
      'data:image/png;base64,AAA',
    )
    expect(getLogoWithFallback({ logoUrl: 'organizations/1/logo.png' })).toBe(
      'organizations/1/logo.png',
    )
  })

  it('los generadores PDF tienen fallback al isotipo', () => {
    const pdfBranding = readFileSync(
      new URL('../utils/pdfBranding.js', import.meta.url),
      'utf8',
    )
    const quickPdf = readFileSync(
      new URL('../utils/generateBudgetPdf.js', import.meta.url),
      'utf8',
    )
    const professionalPdf = readFileSync(
      new URL('../utils/generateProfessionalBudgetPdf.js', import.meta.url),
      'utf8',
    )

    expect(pdfBranding).toContain('LOGO_HORIZONTAL')
    expect(pdfBranding).toContain('LOGO_ISOTYPE')
    expect(pdfBranding).toContain('drawCorporateHeaderFooter')
    expect(quickPdf).toContain('loadLogoWithFallback')
    expect(professionalPdf).toContain('loadLogoWithFallback')
  })
})

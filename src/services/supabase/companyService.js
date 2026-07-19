import { companyData } from '../../data/companyData'
import {
  mapCompanySettingsFromRow,
  mapCompanySettingsToRow,
} from './budgetMappers'
import { ensureCurrentOrganization } from './organizationService'
import { requireSupabase } from './supabaseServiceUtils'

function getDataUrlMimeType(dataUrl = '') {
  return dataUrl.match(/^data:([^;]+);base64,/)?.[1] || 'image/png'
}

function getLogoExtension(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  return 'png'
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl)
  return response.blob()
}

async function getLogoForInterface(client, settings) {
  if (!settings.logoUrl) {
    return settings
  }

  const { data } = await client.storage
    .from('company-assets')
    .createSignedUrl(settings.logoUrl, 60 * 60)

  return {
    ...settings,
    logo: data?.signedUrl || settings.logo,
  }
}

async function uploadLogoIfNeeded(client, organizationId, settings) {
  if (!settings.logo?.startsWith?.('data:image/')) {
    return settings
  }

  const mimeType = getDataUrlMimeType(settings.logo)
  const path = `organizations/${organizationId}/logo.${getLogoExtension(mimeType)}`
  const blob = await dataUrlToBlob(settings.logo)
  const { error } = await client.storage
    .from('company-assets')
    .upload(path, blob, {
      contentType: mimeType,
      upsert: true,
    })

  if (error) {
    throw error
  }

  return {
    ...settings,
    logo: '',
    logoUrl: path,
  }
}

export async function getCompanySettings() {
  const client = requireSupabase()
  const organization = await ensureCurrentOrganization()
  const { data, error } = await client
    .from('company_settings')
    .select('*')
    .eq('organization_id', organization.id)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    const { data: insertedSettings, error: insertError } = await client
      .from('company_settings')
      .insert({ organization_id: organization.id })
      .select('*')
      .single()

    if (insertError) {
      throw insertError
    }

    return getLogoForInterface(client, {
      ...companyData,
      ...mapCompanySettingsFromRow(insertedSettings),
    })
  }

  return getLogoForInterface(client, { ...companyData, ...mapCompanySettingsFromRow(data) })
}

export async function saveCompanySettings(settings) {
  const client = requireSupabase()
  const organization = await ensureCurrentOrganization()
  const settingsWithLogo = await uploadLogoIfNeeded(client, organization.id, settings)
  const row = mapCompanySettingsToRow(settingsWithLogo, organization.id)
  const { data, error } = await client
    .from('company_settings')
    .upsert(row, { onConflict: 'organization_id' })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return getLogoForInterface(client, { ...companyData, ...mapCompanySettingsFromRow(data) })
}

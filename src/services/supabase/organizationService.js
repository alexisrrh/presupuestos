import { requireSupabase, getCurrentUserId } from './supabaseServiceUtils'

export async function getCurrentMembership() {
  const client = requireSupabase()
  const userId = await getCurrentUserId(client)
  const { data, error } = await client
    .from('organization_members')
    .select('organization_id, role, organizations(id, name)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export async function getCurrentOrganization() {
  const membership = await getCurrentMembership()
  return membership?.organizations || null
}

export async function ensureCurrentOrganization() {
  const existingOrganization = await getCurrentOrganization()

  if (existingOrganization) {
    return existingOrganization
  }

  const client = requireSupabase()
  const userId = await getCurrentUserId(client)
  const { data: organization, error: organizationError } = await client
    .from('organizations')
    .insert({ name: 'Mi empresa', created_by: userId })
    .select('id, name')
    .single()

  if (organizationError) {
    throw organizationError
  }

  const { error: memberError } = await client
    .from('organization_members')
    .insert({ organization_id: organization.id, user_id: userId, role: 'owner' })

  if (memberError) {
    throw memberError
  }

  const { error: settingsError } = await client
    .from('company_settings')
    .insert({ organization_id: organization.id })

  if (settingsError) {
    throw settingsError
  }

  return organization
}


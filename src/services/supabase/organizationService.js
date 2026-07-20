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

  const { data: organization, error } = await client.rpc(
    'bootstrap_current_organization'
  )

  if (error) {
    throw error
  }

  if (!organization?.id) {
    throw new Error('No se pudo crear la organización del usuario.')
  }

  return organization
}


import { getCurrentUserId, requireSupabase } from './supabaseServiceUtils'

export const BUSINESS_ROLES = ['owner', 'admin']
export const MEMBER_ROLES = ['owner', 'admin', 'employee']

export function resolveMembership(memberships = []) {
  if (memberships.length === 0) return { status: 'unassigned', membership: null }
  if (memberships.length > 1) return { status: 'organization-selection-required', membership: null }

  const membership = memberships[0]
  if (!membership.is_active || !MEMBER_ROLES.includes(membership.role)) {
    return { status: 'denied', membership: null }
  }

  return { status: 'active', membership }
}

export async function getResolvedMembership() {
  const client = requireSupabase()
  const userId = await getCurrentUserId(client)
  const { data, error } = await client
    .from('organization_members')
    .select('organization_id, role, is_active, organizations(id, name)')
    .eq('user_id', userId)

  if (error) throw error
  return resolveMembership(data || [])
}

import { describe, expect, it } from 'vitest'
import { resolveMembership } from './membershipService'

const active = (role, organizationId = 'org-1') => ({ is_active: true, organization_id: organizationId, role })

describe('resolveMembership', () => {
  it.each(['owner', 'admin', 'employee'])('acepta el rol protegido %s', (role) => {
    expect(resolveMembership([active(role)])).toMatchObject({ status: 'active', membership: { role } })
  })

  it.each(['member', 'unknown'])('deniega por defecto el rol %s', (role) => {
    expect(resolveMembership([active(role)])).toEqual({ status: 'denied', membership: null })
  })

  it('deniega membresias inactivas y cuentas sin membresia', () => {
    expect(resolveMembership([{ ...active('admin'), is_active: false }])).toEqual({ status: 'denied', membership: null })
    expect(resolveMembership([])).toEqual({ status: 'unassigned', membership: null })
  })

  it('no elige una organizacion arbitrariamente', () => {
    expect(resolveMembership([active('owner', 'org-1'), active('admin', 'org-2')])).toEqual({
      status: 'organization-selection-required', membership: null,
    })
  })
})

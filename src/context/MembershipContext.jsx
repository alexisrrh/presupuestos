import { useEffect, useMemo, useState } from 'react'
import { MembershipContext } from './membershipContextValue'
import useAuth from '../hooks/useAuth'
import { getResolvedMembership } from '../services/supabase/membershipService'

export function MembershipProvider({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState({ membership: null, status: 'unassigned', userId: null })

  useEffect(() => {
    let active = true
    if (!user?.id) {
      return () => { active = false }
    }

    getResolvedMembership()
      .then((result) => { if (active) setState({ ...result, userId: user.id }) })
      .catch(() => { if (active) setState({ membership: null, status: 'denied', userId: user.id }) })

    return () => { active = false }
  }, [user?.id])

  const value = useMemo(() => {
    const isCurrentUser = state.userId === (user?.id || null)
    const status = isCurrentUser ? state.status : 'unassigned'
    const membership = isCurrentUser ? state.membership : null
    return {
      canManageBusiness: status === 'active' && ['owner', 'admin'].includes(membership?.role),
      loading: Boolean(user?.id) && !isCurrentUser,
      membership,
      status,
    }
  }, [state, user?.id])
  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>
}

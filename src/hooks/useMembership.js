import { useContext } from 'react'
import { MembershipContext } from '../context/membershipContextValue'

function useMembership() {
  const context = useContext(MembershipContext)
  if (!context) throw new Error('useMembership debe usarse dentro de MembershipProvider.')
  return context
}

export default useMembership

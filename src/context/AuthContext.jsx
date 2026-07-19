import { useEffect, useMemo, useState } from 'react'
import { AuthContext } from './authContextValue'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import * as authService from '../services/supabase/authService'

export function AuthProvider({ children }) {
  const [authError, setAuthError] = useState('')
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return undefined
    }

    let isMounted = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return
      }

      if (error) {
        setAuthError(authService.normalizeAuthError(error))
      }

      setSession(data.session)
      setUser(data.session?.user || null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return
      }

      setSession(nextSession)
      setUser(nextSession?.user || null)
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      authError,
      loading,
      resetPassword: authService.resetPassword,
      session,
      signIn: authService.signIn,
      signOut: authService.signOut,
      signUp: authService.signUp,
      user,
    }),
    [authError, loading, session, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient'

export function normalizeAuthError(error) {
  if (!error) {
    return ''
  }

  return error.message || 'No se pudo completar la operacion de autenticacion.'
}

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase no esta configurado.')
  }

  return supabase
}

export async function signUp({ email, fullName, password }) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (error) {
    throw new Error(normalizeAuthError(error))
  }

  return data
}

export async function signIn({ email, password }) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({ email, password })

  if (error) {
    throw new Error(normalizeAuthError(error))
  }

  return data
}

export async function signOut() {
  const client = requireSupabase()
  const { error } = await client.auth.signOut()

  if (error) {
    throw new Error(normalizeAuthError(error))
  }
}

export async function resetPassword(email, redirectTo) {
  const client = requireSupabase()
  const { data, error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo,
  })

  if (error) {
    throw new Error(normalizeAuthError(error))
  }

  return data
}

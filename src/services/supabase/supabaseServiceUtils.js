import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient'

export function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase no esta configurado.')
  }

  return supabase
}

export async function getCurrentUserId(client = requireSupabase()) {
  const { data, error } = await client.auth.getUser()

  if (error) {
    throw error
  }

  if (!data.user?.id) {
    throw new Error('La sesion ha caducado.')
  }

  return data.user.id
}


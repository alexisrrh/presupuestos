import { createClient } from '@supabase/supabase-js'
import { getMissingSupabaseEnv, getSupabaseEnv } from './supabaseEnv'

const { isConfigured, publishableKey, supabaseUrl } = getSupabaseEnv()

export const isSupabaseConfigured = isConfigured
export const missingSupabaseEnv = getMissingSupabaseEnv()

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.error(
    `Supabase no esta configurado. Faltan variables: ${missingSupabaseEnv.join(
      ', ',
    )}`,
  )
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, publishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    })
  : null

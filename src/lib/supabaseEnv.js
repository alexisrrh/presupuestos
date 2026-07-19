export function getSupabaseEnv(env = import.meta.env) {
  const supabaseUrl = env.VITE_SUPABASE_URL || ''
  const publishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || ''

  return {
    enableLocalFallback: env.VITE_ENABLE_LOCAL_FALLBACK === 'true',
    isConfigured: Boolean(supabaseUrl && publishableKey),
    publishableKey,
    supabaseUrl,
  }
}

export function getMissingSupabaseEnv(env = import.meta.env) {
  const { publishableKey, supabaseUrl } = getSupabaseEnv(env)
  const missing = []

  if (!supabaseUrl) {
    missing.push('VITE_SUPABASE_URL')
  }

  if (!publishableKey) {
    missing.push('VITE_SUPABASE_PUBLISHABLE_KEY')
  }

  return missing
}

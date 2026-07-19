import { describe, expect, it } from 'vitest'
import { getMissingSupabaseEnv, getSupabaseEnv } from './supabaseEnv'

describe('supabaseEnv', () => {
  it('detecta variables faltantes', () => {
    expect(getSupabaseEnv({}).isConfigured).toBe(false)
    expect(getMissingSupabaseEnv({})).toEqual([
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_PUBLISHABLE_KEY',
    ])
  })

  it('detecta configuracion completa con publishable key', () => {
    const env = {
      VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
    }

    expect(getSupabaseEnv(env)).toMatchObject({
      isConfigured: true,
      publishableKey: 'publishable',
    })
  })

  it('permite fallback temporal con anon key', () => {
    const env = {
      VITE_SUPABASE_ANON_KEY: 'anon',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
    }

    expect(getSupabaseEnv(env).publishableKey).toBe('anon')
  })

  it('mantiene fallback local desactivado por defecto', () => {
    expect(getSupabaseEnv({}).enableLocalFallback).toBe(false)
    expect(
      getSupabaseEnv({ VITE_ENABLE_LOCAL_FALLBACK: 'true' }).enableLocalFallback,
    ).toBe(true)
  })
})

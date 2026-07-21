import { createClient } from '@supabase/supabase-js'

import { getEnv } from './env'

import type { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient<Database> | null = null

export function supabasePublicUrl(): string {
  // El navegador nunca debe consumir SUPABASE_URL: en Edge/Docker esa
  // variable apunta legítimamente al hostname interno `kong`, inaccesible
  // desde el equipo del usuario.
  return getEnv('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL').replace(
    /\/+$/,
    '',
  )
}

export function supabaseBrowser(): SupabaseClient<Database> {
  if (_client) return _client

  const url = supabasePublicUrl()

  const anonKey = getEnv(
    'VITE_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  )

  _client = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return _client
}

export function supabaseBrowserWithHeaders(
  headers: Record<string, string>,
): SupabaseClient<Database> {
  const url = supabasePublicUrl()

  const anonKey = getEnv(
    'VITE_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  )

  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: { headers },
  })
}

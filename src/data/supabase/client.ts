import { createClient } from '@supabase/supabase-js'

import { getEnv } from './env'

import type { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient<Database> | null = null

export function supabaseBrowser(): SupabaseClient<Database> {
  if (_client) return _client

  const url = getEnv(
    'VITE_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_URL',
  )

  const anonKey = getEnv(
    'VITE_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
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

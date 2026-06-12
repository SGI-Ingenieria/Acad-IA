import { createClient } from 'jsr:@supabase/supabase-js'
import { mustGetEnv } from './env.ts'
import { HttpError } from './errors.ts'

export function getSupabaseServiceClient() {
  const url = mustGetEnv('SUPABASE_URL')
  const key = mustGetEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

export function getSupabaseAnonClient(authHeader?: string) {
  const url = mustGetEnv('SUPABASE_URL')
  const key = mustGetEnv('SUPABASE_ANON_KEY')
  return createClient(url, key, {
    auth: { persistSession: false },
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  })
}

export async function requireUser(authHeader?: string) {
  if (!authHeader) {
    throw new HttpError(401, 'missing_auth', 'Missing Authorization header')
  }
  const anon = getSupabaseAnonClient(authHeader)
  const { data, error } = await anon.auth.getUser()
  if (error || !data?.user) {
    throw new HttpError(401, 'invalid_auth', 'Invalid or expired token', error)
  }
  return data.user
}

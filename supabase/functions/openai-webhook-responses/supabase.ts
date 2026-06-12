import { createClient } from '@supabase/supabase-js'
import type { Database } from '../_shared/database.types.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || (!SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_ANON_KEY)) {
  console.warn('Missing Supabase environment variables')
}

const supabaseKey = (SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY) as string

const supabase = createClient<Database>(SUPABASE_URL as string, supabaseKey)

export { supabase }

import { createClient } from '@supabase/supabase-js'

import { encabezadosAgente } from './agenteHeaders'
import { getEnv } from './env'

import type { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient<Database> | null = null

// Clientes con cabeceras propias, reutilizados por firma. Cada `createClient`
// levanta su propio GoTrueClient, que vuelve a leer y refrescar la sesión, así
// que conviene que existan los menos posibles y que ninguno se cree por
// escritura.
const _clientesConCabeceras = new Map<string, SupabaseClient<Database>>()

/**
 * `fetch` que añade las cabeceras ambientales del modo agente a las peticiones
 * a PostgREST.
 *
 * Va aquí y no en `global.headers` porque las cabeceras del agente cambian
 * durante la vida del cliente —empiezan a existir al iniciar el modo, cambian
 * de contexto y de interacción, y desaparecen al detenerlo—, mientras que
 * `global.headers` se congela al construir el cliente. Resolverlo creando un
 * cliente por combinación multiplicaba los GoTrueClient y metía la sesión de
 * autenticación en la ecuación; leerlas por petición no.
 *
 * Se limita a `/rest/v1/` a propósito: auth, storage y functions no tienen nada
 * que hacer con la auditoría del historial.
 *
 * La conversión final es necesaria: supabase-js pide `typeof fetch`, y en este
 * proyecto ese tipo arrastra los estáticos del runtime de Bun (`fetch.preconnect`,
 * que entra por los tipos globales de `bun:test`) que ningún envoltorio tiene.
 * Es segura porque supabase-js sólo usa la firma de llamada — la propia
 * documentación de la librería sugiere `fetch.bind(globalThis)`, que tampoco los
 * conserva.
 */
const fetchConCabecerasDeAgente = ((
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const extra = encabezadosAgente()
  if (!extra) return fetch(input, init)

  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url

  if (!url.includes('/rest/v1/')) return fetch(input, init)

  // `init.headers` ya trae `Authorization` y `apikey`, puestas por el
  // `fetchWithAuth` interno de supabase-js: sólo se añaden las del agente.
  const headers = new Headers(init?.headers)
  for (const [nombre, valor] of Object.entries(extra))
    headers.set(nombre, valor)

  return fetch(input, { ...init, headers })
}) as typeof fetch

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
    global: { fetch: fetchConCabecerasDeAgente },
  })

  return _client
}

export function supabaseBrowserWithHeaders(
  headers: Record<string, string>,
): SupabaseClient<Database> {
  const firma = JSON.stringify(
    Object.entries(headers).sort(([a], [b]) => a.localeCompare(b)),
  )

  const cacheado = _clientesConCabeceras.get(firma)
  if (cacheado) return cacheado

  const url = supabasePublicUrl()

  const anonKey = getEnv(
    'VITE_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  )

  const cliente = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: { headers, fetch: fetchConCabecerasDeAgente },
  })

  _clientesConCabeceras.set(firma, cliente)
  return cliente
}

/**
 * Cliente para una escritura auditable.
 *
 * El motivo de override de administrador se pasa por parámetro y es fijo
 * mientras dura la escritura, así que va en `global.headers` de un cliente
 * aparte —caso raro—. Las cabeceras del modo agente, en cambio, son ambientales
 * (ver `agenteHeaders.ts`) y las inyecta `fetchConCabecerasDeAgente` en cada
 * petición, así que el caso normal sigue siendo el singleton: el modo agente no
 * multiplica clientes ni toca la sesión de autenticación.
 */
export function supabaseBrowserParaEscritura(
  adminOverrideReason?: string | null,
): SupabaseClient<Database> {
  const motivo = adminOverrideReason?.trim()

  return motivo
    ? supabaseBrowserWithHeaders({ 'x-admin-override-reason': motivo })
    : supabaseBrowser()
}

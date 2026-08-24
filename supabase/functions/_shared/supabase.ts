import { createClient, type User } from '@supabase/supabase-js'

import { requireEnv, requireFirstEnv } from './env.ts'
import { getBearerToken } from './request.ts'
import { HttpError } from './utils.ts'

export type ServiceRoleClient = ReturnType<typeof createClient<any>>

export type SupabaseClientOptions = {
  supabaseUrl?: string
  anonKey?: string
  serviceRoleKey?: string
}

export type RequireUserOptions = SupabaseClientOptions & {
  missingAuthorizationMessage?: string
  missingAuthorizationCode?: string
  invalidAuthorizationMessage?: string
  invalidAuthorizationCode?: string
}

export type AuthenticatedSupabaseContext = {
  authorization: string
  user: User
  userClient: ServiceRoleClient
  serviceClient: ServiceRoleClient
}

export type AuthenticatedUserContext = Omit<
  AuthenticatedSupabaseContext,
  'serviceClient'
>

export type AuthenticatedServiceContext = Pick<
  AuthenticatedSupabaseContext,
  'user' | 'serviceClient'
>

let defaultServiceRoleClient: ServiceRoleClient | undefined

export function getAuthorizationHeader(request: Request): string | null {
  return request.headers.get('authorization')
}

export function getSupabaseUrl(): string {
  return requireEnv('SUPABASE_URL')
}

export function getSupabaseAnonKey(): string {
  return requireFirstEnv(['SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY'])
}

export function getSupabaseServiceRoleKey(): string {
  return requireFirstEnv(['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'])
}

export function createServiceRoleClient(
  options: SupabaseClientOptions = {},
): ServiceRoleClient {
  return createClient<any>(
    options.supabaseUrl ?? getSupabaseUrl(),
    options.serviceRoleKey ?? getSupabaseServiceRoleKey(),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export function getServiceRoleClient(): ServiceRoleClient {
  defaultServiceRoleClient ??= createServiceRoleClient()
  return defaultServiceRoleClient
}

export function createAnonClient(
  authorization?: string,
  options: SupabaseClientOptions = {},
): ServiceRoleClient {
  return createClient<any>(
    options.supabaseUrl ?? getSupabaseUrl(),
    options.anonKey ?? getSupabaseAnonKey(),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: authorization
        ? { headers: { Authorization: authorization } }
        : undefined,
    },
  )
}

export async function requireAuthenticatedUser(
  request: Request,
  options: RequireUserOptions = {},
) {
  return (await createAuthenticatedUserContext(request, options)).user
}

export async function getAuthenticatedUserWithClient(
  request: Request,
  client: ServiceRoleClient,
): Promise<User | null> {
  const token = getBearerToken(request)
  if (!token) return null
  const { data, error } = await client.auth.getUser(token)
  return error ? null : (data.user ?? null)
}

export async function requireAuthenticatedUserWithClient(
  request: Request,
  client: ServiceRoleClient,
  options: RequireUserOptions = {},
): Promise<User> {
  const token = getBearerToken(request)
  if (!token) {
    throw new HttpError(
      401,
      options.missingAuthorizationMessage ?? 'Debes iniciar sesión.',
      options.missingAuthorizationCode ?? 'UNAUTHORIZED',
    )
  }

  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) {
    throw new HttpError(
      401,
      options.invalidAuthorizationMessage ?? 'La sesión no es válida.',
      options.invalidAuthorizationCode ?? 'UNAUTHORIZED',
      { reason: error?.message ?? 'invalid_token' },
    )
  }
  return data.user
}

export async function createAuthenticatedUserContext(
  request: Request,
  options: RequireUserOptions = {},
): Promise<AuthenticatedUserContext> {
  const authorization = getAuthorizationHeader(request)
  if (!authorization) {
    throw new HttpError(
      401,
      options.missingAuthorizationMessage ?? 'Debes iniciar sesión.',
      options.missingAuthorizationCode ?? 'UNAUTHORIZED',
    )
  }

  const userClient = createAnonClient(authorization, options)
  const user = await requireAuthenticatedUserWithClient(
    request,
    userClient,
    options,
  )

  return { authorization, user, userClient }
}

export async function createAuthenticatedContext(
  request: Request,
  options: RequireUserOptions = {},
): Promise<AuthenticatedSupabaseContext> {
  const userContext = await createAuthenticatedUserContext(request, options)

  return {
    ...userContext,
    serviceClient:
      options.supabaseUrl || options.serviceRoleKey
        ? createServiceRoleClient(options)
        : getServiceRoleClient(),
  }
}

export async function createAuthenticatedServiceContext(
  request: Request,
  options: RequireUserOptions = {},
): Promise<AuthenticatedServiceContext> {
  const serviceClient =
    options.supabaseUrl || options.serviceRoleKey
      ? createServiceRoleClient(options)
      : getServiceRoleClient()
  const user = await requireAuthenticatedUserWithClient(
    request,
    serviceClient,
    options,
  )
  return { user, serviceClient }
}

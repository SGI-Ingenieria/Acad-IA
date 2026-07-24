import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import type { Session } from '@supabase/supabase-js'

import { runSessionGate } from '@/data/api/observability.api'
import { setLastAccount } from '@/data/auth/lastAccount'
import { qk } from '@/data/query/keys'
import { supabaseBrowser } from '@/data/supabase/client'
import {
  getEdgeFunctionErrorCode,
  invokeEdge,
} from '@/data/supabase/invokeEdge'

export const connectivityLoginError =
  'La plataforma está teniendo problemas de conectividad. Intenta de nuevo más tarde o avisa a un administrador.'

interface InternalCreds {
  type: 'internal'
  clave: string
  password: string
}

interface ExternalCreds {
  type: 'external'
  email: string
  password: string
}

export type LoginCreds = InternalCreds | ExternalCreds

export type LoginResult = { ok: true } | { ok: false; error: string }

function mapInternalError(err: unknown): string {
  const code = getEdgeFunctionErrorCode(err)
  if (code === 'INVALID_INTERNAL_CREDENTIALS') {
    return 'Clave La Salle o contraseña institucional incorrectos.'
  }
  if (code === 'NTLM_SERVICE_UNAVAILABLE') {
    return 'El servidor institucional no está disponible. Intenta más tarde.'
  }
  if (code === 'INTERNAL_USER_NOT_FOUND') {
    return 'No existe una cuenta vinculada a esta Clave La Salle.'
  }
  return (err as Error).message || 'Error al iniciar sesión.'
}

function mapExternalError(err: unknown): string {
  const code = getEdgeFunctionErrorCode(err)
  if (code === 'NOT_EXTERNAL_USER') {
    return 'Esta cuenta usa acceso institucional. Inicia sesión como usuario interno.'
  }
  if (code === 'USER_DISABLED') {
    return 'La cuenta está dada de baja.'
  }
  return 'Correo o contraseña incorrectos.'
}

/**
 * Lógica común de inicio de sesión (interno y externo): invoca la edge function,
 * aplica el gate de observabilidad, establece la sesión, recuerda la cuenta para
 * el reingreso rápido y navega al destino. Centralizarla evita duplicar el flujo
 * de sesión entre los formularios de acceso y la tarjeta de "bienvenido de nuevo".
 *
 * Devuelve un resultado tipado en vez de lanzar: los errores de credenciales /
 * gate / conectividad son presentación efímera del último intento, no
 * excepciones que deban propagarse.
 */
export function useLoginSubmit(redirectTo: string) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return async (creds: LoginCreds): Promise<LoginResult> => {
    try {
      const identifier =
        creds.type === 'internal' ? creds.clave.trim() : creds.email.trim()

      const result = await invokeEdge<{ session: Session }>(
        creds.type === 'internal'
          ? 'internal-auth-login'
          : 'external-auth/login',
        creds.type === 'internal'
          ? { clave: identifier, password: creds.password }
          : { email: identifier, password: creds.password },
      )

      try {
        const gate = await runSessionGate(result.session)
        if (!gate.allowed) {
          return { ok: false, error: gate.message || connectivityLoginError }
        }
      } catch {
        return { ok: false, error: connectivityLoginError }
      }

      await supabaseBrowser().auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      })

      setLastAccount({ type: creds.type, identifier })
      queryClient.setQueryData(qk.session(), result.session)
      navigate({ to: redirectTo as any, replace: true })
      return { ok: true }
    } catch (err) {
      return {
        ok: false,
        error:
          creds.type === 'internal'
            ? mapInternalError(err)
            : mapExternalError(err),
      }
    }
  }
}

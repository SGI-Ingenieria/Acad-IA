import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'

import { LoginField, LoginSubmitButton } from './LoginField'

import type { Session } from '@supabase/supabase-js'

import { useAppForm } from '@/components/form'
import { runSessionGate } from '@/data/api/observability.api'
import { qk } from '@/data/query/keys'
import { supabaseBrowser } from '@/data/supabase/client'
import {
  getEdgeFunctionErrorCode,
  invokeEdge,
} from '@/data/supabase/invokeEdge'

interface Props {
  redirectTo: string
}

const connectivityLoginError =
  'La plataforma está teniendo problemas de conectividad. Intenta de nuevo más tarde o avisa a un administrador.'

const schema = z.object({
  clave: z.string().trim().min(1, 'Ingresa tu Clave La Salle.'),
  password: z.string().min(1, 'Ingresa tu contraseña.'),
})

const mapLoginError = (err: unknown): string => {
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

export function InternalLoginForm({ redirectTo }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // Error devuelto por el servidor (credenciales, gate, conectividad):
  // presentación efímera del último intento, no estado del formulario.
  const [serverError, setServerError] = useState('')

  const form = useAppForm({
    defaultValues: { clave: '', password: '' },
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      setServerError('')
      try {
        const result = await invokeEdge<{ session: Session }>(
          'internal-auth-login',
          { clave: value.clave.trim(), password: value.password },
        )

        try {
          const gate = await runSessionGate(result.session)
          if (!gate.allowed) {
            setServerError(gate.message || connectivityLoginError)
            return
          }
        } catch {
          setServerError(connectivityLoginError)
          return
        }

        await supabaseBrowser().auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        })

        queryClient.setQueryData(qk.session(), result.session)
        navigate({ to: redirectTo as any, replace: true })
      } catch (err) {
        setServerError(mapLoginError(err))
      }
    },
  })

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.AppField name="clave">
        {() => (
          <LoginField
            label="Clave La Salle"
            hint="Usa tu clave institucional para entrar al sistema."
          />
        )}
      </form.AppField>
      <form.AppField name="password">
        {() => <LoginField label="Contraseña" type="password" />}
      </form.AppField>
      {serverError && <p className="text-destructive text-sm">{serverError}</p>}
      <form.AppForm>
        <LoginSubmitButton />
      </form.AppForm>
    </form>
  )
}

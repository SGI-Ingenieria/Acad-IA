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

type View = 'login' | 'reset' | 'sent'

interface Props {
  redirectTo: string
}

const connectivityLoginError =
  'La plataforma está teniendo problemas de conectividad. Intenta de nuevo más tarde o avisa a un administrador.'

const emailSchema = z
  .string()
  .trim()
  .min(1, 'El correo electrónico es requerido.')
  .pipe(z.email('Ingresa un correo electrónico válido.'))

export function ExternalLoginForm({ redirectTo }: Props) {
  const [view, setView] = useState<View>('login')
  // Error del servidor del último intento: presentación efímera.
  const [serverError, setServerError] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const form = useAppForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setServerError('')
      if (view === 'reset') {
        await sendReset(value.email)
        return
      }
      await signIn(value)
    },
  })

  const signIn = async (value: { email: string; password: string }) => {
    try {
      const result = await invokeEdge<{ session: Session }>(
        'external-auth/login',
        { email: value.email.trim(), password: value.password },
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
      const code = getEdgeFunctionErrorCode(err)
      if (code === 'NOT_EXTERNAL_USER') {
        setServerError(
          'Esta cuenta usa acceso institucional. Inicia sesión como usuario interno.',
        )
      } else if (code === 'USER_DISABLED') {
        setServerError('La cuenta está dada de baja.')
      } else {
        setServerError('Correo o contraseña incorrectos.')
      }
    }
  }

  const sendReset = async (email: string) => {
    try {
      await invokeEdge<{ sent: true }>('external-auth/reset-password', {
        email: email.trim(),
        redirectTo: `${window.location.origin}/update-password`,
      })
      setView('sent')
    } catch (err) {
      const code = getEdgeFunctionErrorCode(err)
      if (code === 'NOT_EXTERNAL_USER') {
        setServerError(
          'Esta cuenta usa acceso institucional y no puede restablecer contraseña aquí.',
        )
      } else if (code === 'USER_DISABLED') {
        setServerError('La cuenta está dada de baja.')
      } else {
        setServerError(
          'No se pudo enviar el correo. Verifica la dirección e intenta de nuevo.',
        )
      }
    }
  }

  const backToLogin = () => {
    setView('login')
    setServerError('')
  }

  if (view === 'sent') {
    return (
      <div className="space-y-5">
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <p className="text-foreground text-sm font-medium">Correo enviado</p>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            Revisa la bandeja de entrada de{' '}
            <span className="font-medium">
              {form.getFieldValue('email').trim()}
            </span>{' '}
            y sigue las instrucciones para restablecer tu contraseña.
          </p>
        </div>
        <button
          type="button"
          onClick={backToLogin}
          className="text-muted-foreground hover:text-foreground w-full text-center text-sm transition-colors"
        >
          ← Volver al inicio de sesión
        </button>
      </div>
    )
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.AppField name="email" validators={{ onChange: emailSchema }}>
        {() => (
          <LoginField
            label="Correo electrónico"
            hint={
              view === 'reset'
                ? 'Te enviaremos un correo con instrucciones para restablecer tu contraseña.'
                : 'Ingresa el correo con el que accedes como usuario externo.'
            }
          />
        )}
      </form.AppField>

      {view === 'login' && (
        <div className="space-y-1">
          <form.AppField
            name="password"
            validators={{
              onChange: ({ value }) =>
                value ? undefined : 'Ingresa tu contraseña.',
            }}
          >
            {() => <LoginField label="Contraseña" type="password" />}
          </form.AppField>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setServerError('')
                setView('reset')
              }}
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </div>
      )}

      {serverError && <p className="text-destructive text-sm">{serverError}</p>}

      <form.AppForm>
        <LoginSubmitButton
          text={view === 'reset' ? 'Enviar instrucciones' : 'Iniciar sesión'}
          loadingText={view === 'reset' ? 'Enviando...' : undefined}
        />
      </form.AppForm>

      {view === 'reset' && (
        <button
          type="button"
          onClick={backToLogin}
          className="text-muted-foreground hover:text-foreground w-full text-center text-sm transition-colors"
        >
          ← Volver al inicio de sesión
        </button>
      )}
    </form>
  )
}

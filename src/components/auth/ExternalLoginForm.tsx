import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { LoginInput } from '../ui/LoginInput'
import { SubmitButton } from '../ui/SubmitButton'

import { qk } from '@/data/query/keys'
import { supabaseBrowser } from '@/data/supabase/client'
import {
  getEdgeFunctionErrorCode,
  invokeEdge,
} from '@/data/supabase/invokeEdge'

import type { Session } from '@supabase/supabase-js'

type View = 'login' | 'reset' | 'sent'

interface Props {
  redirectTo: string
}

export function ExternalLoginForm({ redirectTo }: Props) {
  const [view, setView] = useState<View>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const signIn = async () => {
    if (!email || !password) return
    setLoading(true)
    setError('')

    try {
      const result = await invokeEdge<{ session: Session }>(
        'external-auth/login',
        { email, password },
      )

      await supabaseBrowser().auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      })

      queryClient.setQueryData(qk.session(), result.session)
      navigate({ to: redirectTo as any, replace: true })
    } catch (err) {
      const code = getEdgeFunctionErrorCode(err)
      if (code === 'NOT_EXTERNAL_USER') {
        setError(
          'Esta cuenta usa acceso institucional. Inicia sesión como usuario interno.',
        )
      } else if (code === 'USER_DISABLED') {
        setError('La cuenta está dada de baja.')
      } else {
        setError('Correo o contraseña incorrectos.')
      }
      setLoading(false)
    }
  }

  const sendReset = async () => {
    if (!email) return
    setLoading(true)
    setError('')

    try {
      await invokeEdge<{ sent: true }>('external-auth/reset-password', {
        email,
        redirectTo: `${window.location.origin}/update-password`,
      })

      setLoading(false)
      setView('sent')
    } catch (err) {
      const code = getEdgeFunctionErrorCode(err)
      if (code === 'NOT_EXTERNAL_USER') {
        setError(
          'Esta cuenta usa acceso institucional y no puede restablecer contraseña aquí.',
        )
      } else if (code === 'USER_DISABLED') {
        setError('La cuenta está dada de baja.')
      } else {
        setError(
          'No se pudo enviar el correo. Verifica la dirección e intenta de nuevo.',
        )
      }
      setLoading(false)
    }
  }

  const backToLogin = () => {
    setView('login')
    setError('')
  }

  if (view === 'sent') {
    return (
      <div className="space-y-5">
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <p className="text-foreground text-sm font-medium">Correo enviado</p>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            Revisa la bandeja de entrada de{' '}
            <span className="font-medium">{email}</span> y sigue las
            instrucciones para restablecer tu contraseña.
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

  if (view === 'reset') {
    return (
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          sendReset()
        }}
      >
        <div className="space-y-2">
          <LoginInput
            label="Correo electrónico"
            value={email}
            onChange={setEmail}
          />
          <p className="text-muted-foreground text-xs leading-5">
            Te enviaremos un correo con instrucciones para restablecer tu
            contraseña.
          </p>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <SubmitButton
          text="Enviar instrucciones"
          loadingText="Enviando..."
          loading={loading}
        />
        <button
          type="button"
          onClick={backToLogin}
          className="text-muted-foreground hover:text-foreground w-full text-center text-sm transition-colors"
        >
          ← Volver al inicio de sesión
        </button>
      </form>
    )
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        signIn()
      }}
    >
      <div className="space-y-2">
        <LoginInput
          label="Correo electrónico"
          value={email}
          onChange={setEmail}
        />
        <p className="text-muted-foreground text-xs leading-5">
          Ingresa el correo con el que accedes como usuario externo.
        </p>
      </div>
      <div className="space-y-1">
        <LoginInput
          label="Contraseña"
          type="password"
          value={password}
          onChange={setPassword}
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setError('')
              setView('reset')
            }}
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <SubmitButton loading={loading} />
    </form>
  )
}

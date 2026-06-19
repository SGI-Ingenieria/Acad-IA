import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { LoginInput } from '../ui/LoginInput'
import { SubmitButton } from '../ui/SubmitButton'

import type { Session } from '@supabase/supabase-js'

import { qk } from '@/data/query/keys'
import { supabaseBrowser } from '@/data/supabase/client'
import {
  getEdgeFunctionErrorCode,
  invokeEdge,
} from '@/data/supabase/invokeEdge'

interface Props {
  redirectTo: string
}

export function InternalLoginForm({ redirectTo }: Props) {
  const [clave, setClave] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const signIn = async () => {
    if (!clave || !password) return
    setLoading(true)
    setError('')

    try {
      const result = await invokeEdge<{ session: Session }>(
        'internal-auth-login',
        { clave, password },
      )

      await supabaseBrowser().auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      })

      queryClient.setQueryData(qk.session(), result.session)
      navigate({ to: redirectTo as any, replace: true })
    } catch (err) {
      const code = getEdgeFunctionErrorCode(err)
      if (code === 'INVALID_INTERNAL_CREDENTIALS') {
        setError('Clave La Salle o contraseña institucional incorrectos.')
      } else if (code === 'NTLM_SERVICE_UNAVAILABLE') {
        setError(
          'El servidor institucional no está disponible. Intenta más tarde.',
        )
      } else if (code === 'INTERNAL_USER_NOT_FOUND') {
        setError('No existe una cuenta vinculada a esta Clave La Salle.')
      } else {
        setError((err as Error).message || 'Error al iniciar sesión.')
      }
      setLoading(false)
    }
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
        <LoginInput label="Clave La Salle" value={clave} onChange={setClave} />
        <p className="text-muted-foreground text-xs leading-5">
          Usa tu clave institucional para entrar al sistema.
        </p>
      </div>
      <LoginInput
        label="Contraseña"
        type="password"
        value={password}
        onChange={setPassword}
      />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <SubmitButton loading={loading} />
    </form>
  )
}

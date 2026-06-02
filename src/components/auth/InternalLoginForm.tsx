import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { LoginInput } from '../ui/LoginInput'
import { SubmitButton } from '../ui/SubmitButton'

import { qk } from '@/data/query/keys'
import { supabaseBrowser } from '@/data/supabase/client'

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

  const submit = async () => {
    if (!clave || !password) return
    setLoading(true)
    setError('')

    const { data, error: authError } =
      await supabaseBrowser().auth.signInWithPassword({
        email: `${clave}@ulsa.mx`,
        password,
      })

    if (authError) {
      setError('Clave ULSA o contraseña incorrectos.')
      setLoading(false)
      return
    }

    queryClient.setQueryData(qk.session(), data.session)
    navigate({ to: redirectTo as any, replace: true })
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="space-y-2">
        <LoginInput label="Clave ULSA" value={clave} onChange={setClave} />
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

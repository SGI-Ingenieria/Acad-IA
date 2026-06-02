import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { LoginInput } from '../ui/LoginInput'
import { SubmitButton } from '../ui/SubmitButton'

import { supabaseBrowser } from '@/data/supabase/client'

interface Props {
  redirectTo: string
}

export function ExternalLoginForm({ redirectTo }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const submit = async () => {
    if (!email || !password) return
    setLoading(true)
    setError('')

    const { error: authError } =
      await supabaseBrowser().auth.signInWithPassword({
        email,
        password,
      })

    if (authError) {
      setError('Correo o contraseña incorrectos.')
      setLoading(false)
      return
    }

    navigate({ to: redirectTo as any, replace: true })
    location.reload() // Recarga la página para actualizar el estado de autenticación en toda la app
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
        <LoginInput
          label="Correo electrónico"
          value={email}
          onChange={setEmail}
        />
        <p className="text-muted-foreground text-xs leading-5">
          Ingresa el correo con el que accedes como usuario externo.
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

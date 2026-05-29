import { useState } from 'react'

// import { supabase } from '@/lib/supabase'
import { LoginInput } from '../ui/LoginInput'
import { SubmitButton } from '../ui/SubmitButton'

export function ExternalLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = async () => {
    /* await supabase.auth.signInWithPassword({
      email,
      password,
    })*/
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
      <SubmitButton />
    </form>
  )
}

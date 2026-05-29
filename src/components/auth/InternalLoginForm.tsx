import { useState } from 'react'

// import { supabase } from '@/lib/supabase'
import { LoginInput } from '../ui/LoginInput'
import { SubmitButton } from '../ui/SubmitButton'

export function InternalLoginForm() {
  const [clave, setClave] = useState('')
  const [password, setPassword] = useState('')

  const submit = async () => {
    /* await supabase.auth.signInWithPassword({
      email: `${clave}@ulsa.mx`,
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
      <SubmitButton />
    </form>
  )
}

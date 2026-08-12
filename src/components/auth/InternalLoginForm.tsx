import { useState } from 'react'
import { z } from 'zod'

import { LoginField, LoginSubmitButton } from './LoginField'
import { useLoginSubmit } from './useLoginSubmit'

import { useAppForm } from '@/components/form'

interface Props {
  redirectTo: string
  /** Prellenar la Clave La Salle de la última cuenta usada en este navegador. */
  initialClave?: string
}

const schema = z.object({
  clave: z.string().trim().min(1, 'Ingresa tu Clave La Salle.'),
  password: z.string().min(1, 'Ingresa tu contraseña.'),
})

export function InternalLoginForm({ redirectTo, initialClave = '' }: Props) {
  const login = useLoginSubmit(redirectTo)
  // Error devuelto por el servidor (credenciales, gate, conectividad):
  // presentación efímera del último intento, no estado del formulario.
  const [serverError, setServerError] = useState('')

  const form = useAppForm({
    defaultValues: { clave: initialClave, password: '' },
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      setServerError('')
      const result = await login({
        type: 'internal',
        clave: value.clave,
        password: value.password,
      })
      if (!result.ok) setServerError(result.error)
    },
  })

  return (
    <form
      className="space-y-seccion"
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

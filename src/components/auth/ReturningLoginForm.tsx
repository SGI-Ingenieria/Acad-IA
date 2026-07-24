import { UserRound } from 'lucide-react'
import { useState } from 'react'

import { LoginField, LoginSubmitButton } from './LoginField'
import { useLoginSubmit } from './useLoginSubmit'

import type { LastAccount } from '@/data/auth/lastAccount'

import { useAppForm } from '@/components/form'

interface Props {
  redirectTo: string
  account: LastAccount
  /** Cambiar a un inicio de sesión limpio con otra cuenta. */
  onUseAnotherAccount: () => void
}

/**
 * Reingreso rápido para la última cuenta usada en este navegador: muestra la
 * cuenta recordada y pide únicamente la contraseña (nunca se persiste). El botón
 * "Iniciar con otra cuenta" regresa al formulario completo.
 */
export function ReturningLoginForm({
  redirectTo,
  account,
  onUseAnotherAccount,
}: Props) {
  const login = useLoginSubmit(redirectTo)
  const [serverError, setServerError] = useState('')

  const form = useAppForm({
    defaultValues: { password: '' },
    onSubmit: async ({ value }) => {
      setServerError('')
      const result = await login(
        account.type === 'internal'
          ? {
              type: 'internal',
              clave: account.identifier,
              password: value.password,
            }
          : {
              type: 'external',
              email: account.identifier,
              password: value.password,
            },
      )
      if (!result.ok) setServerError(result.error)
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
      <div className="border-border/70 bg-muted/40 flex items-center gap-3 rounded-2xl border p-3">
        <span
          className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full"
          aria-hidden="true"
        >
          <UserRound className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{account.identifier}</p>
          <p className="text-muted-foreground text-xs">
            {account.type === 'internal'
              ? 'Acceso institucional'
              : 'Acceso externo'}
          </p>
        </div>
      </div>

      <form.AppField
        name="password"
        validators={{
          onChange: ({ value }) =>
            value ? undefined : 'Ingresa tu contraseña.',
        }}
      >
        {() => <LoginField label="Contraseña" type="password" />}
      </form.AppField>

      {serverError && <p className="text-destructive text-sm">{serverError}</p>}

      <form.AppForm>
        <LoginSubmitButton text="Continuar" />
      </form.AppForm>

      <button
        type="button"
        onClick={onUseAnotherAccount}
        className="text-muted-foreground hover:text-foreground w-full text-center text-sm transition-colors"
      >
        Iniciar sesión con otra cuenta
      </button>
    </form>
  )
}

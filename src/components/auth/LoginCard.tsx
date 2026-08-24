import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import { ExternalLoginForm } from './ExternalLoginForm.tsx'
import { InternalLoginForm } from './InternalLoginForm.tsx'
import { LoginTabs } from './LoginTabs.tsx'
import { ReturningLoginForm } from './ReturningLoginForm.tsx'

import { getLastAccount } from '@/data/auth/lastAccount'

interface Props {
  redirectTo: string
}

export function LoginCard({ redirectTo }: Props) {
  // La última cuenta es una preferencia del navegador que solo importa al montar
  // la pantalla; se lee una vez y no necesita reactividad.
  const [lastAccount] = useState(() => getLastAccount())
  // Empezar en el reingreso rápido si hay una cuenta recordada; el usuario puede
  // pasar al formulario completo para entrar con otra cuenta.
  const [useAnother, setUseAnother] = useState(false)
  const [type, setType] = useState<'internal' | 'external'>(
    lastAccount?.type ?? 'internal',
  )

  const showReturning = lastAccount !== null && !useAnother

  return (
    <div className="bg-card/90 text-card-foreground border-border/70 p-region w-full max-w-md rounded-3xl border shadow-2xl backdrop-blur-xl">
      <div className="flex justify-center">
        <img
          src={`${import.meta.env.BASE_URL}lasalle-logo-light.svg`}
          alt="La Salle México"
          className="mb-seccion h-20 w-auto dark:hidden"
        />
        <img
          src={`${import.meta.env.BASE_URL}lasalle-logo.svg`}
          alt="La Salle México"
          className="mb-seccion hidden h-20 w-auto dark:block"
        />
      </div>

      {showReturning ? (
        <ReturningLoginForm
          redirectTo={redirectTo}
          account={lastAccount}
          onUseAnotherAccount={() => setUseAnother(true)}
        />
      ) : (
        <>
          <LoginTabs value={type} onChange={setType} />

          {type === 'internal' ? (
            <InternalLoginForm redirectTo={redirectTo} />
          ) : (
            <ExternalLoginForm redirectTo={redirectTo} />
          )}
        </>
      )}

      <p className="text-muted-foreground mt-seccion text-center text-sm">
        ¿No tienes cuenta?{' '}
        <Link
          to="/registro"
          className="text-foreground font-medium underline underline-offset-2 hover:no-underline"
        >
          Crear cuenta
        </Link>
      </p>
    </div>
  )
}

import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import { ExternalLoginForm } from './ExternalLoginForm.tsx'
import { InternalLoginForm } from './InternalLoginForm.tsx'
import { LoginTabs } from './LoginTabs.tsx'

interface Props {
  redirectTo: string
}

export function LoginCard({ redirectTo }: Props) {
  const [type, setType] = useState<'internal' | 'external'>('internal')

  return (
    <div className="bg-card/90 text-card-foreground border-border/70 w-full max-w-md rounded-3xl border p-8 shadow-2xl backdrop-blur-xl">
      <div className="flex justify-center">
        <img
          src="/lasalle-logo-light.svg"
          alt="La Salle México"
          className="mb-6 h-20 w-auto dark:hidden"
        />
        <img
          src="/lasalle-logo.svg"
          alt="La Salle México"
          className="mb-6 hidden h-20 w-auto dark:block"
        />
      </div>
      <h1 className="mb-1 text-center text-2xl font-semibold tracking-tight">
        Iniciar sesión
      </h1>
      <p className="text-muted-foreground mb-6 text-center text-sm">
        Accede al Sistema de Planes de Estudio
      </p>

      <LoginTabs value={type} onChange={setType} />

      {type === 'internal' ? (
        <InternalLoginForm redirectTo={redirectTo} />
      ) : (
        <ExternalLoginForm redirectTo={redirectTo} />
      )}

      <p className="text-muted-foreground mt-6 text-center text-sm">
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

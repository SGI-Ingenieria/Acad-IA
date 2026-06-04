import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { LoginInput } from '@/components/ui/LoginInput'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { supabaseBrowser } from '@/data/supabase/client'

export const Route = createFileRoute('/update-password')({
  component: UpdatePasswordPage,
})

function UpdatePasswordPage() {
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabaseBrowser().auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const submit = async () => {
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setLoading(true)
    setError('')

    const { error: updateError } = await supabaseBrowser().auth.updateUser({ password })

    if (updateError) {
      setError('No se pudo actualizar la contraseña. El enlace puede haber expirado.')
      setLoading(false)
      return
    }

    setDone(true)
    setTimeout(() => navigate({ to: '/login' }), 2500)
  }

  return (
    <div className="login-bg relative flex min-h-screen items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(15,23,42,0.08),transparent_40%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_40%)]" />
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-card/90 text-card-foreground border-border/70 w-full rounded-3xl border p-8 shadow-2xl backdrop-blur-xl">
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
            Nueva contraseña
          </h1>
          <p className="text-muted-foreground mb-6 text-center text-sm">
            Elige una contraseña segura para tu cuenta
          </p>

          {done ? (
            <div className="space-y-4 text-center">
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-foreground text-sm font-medium">
                  Contraseña actualizada
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Redirigiendo al inicio de sesión…
                </p>
              </div>
            </div>
          ) : !ready ? (
            <div className="space-y-4 text-center">
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-muted-foreground text-sm">
                  Verificando enlace de recuperación…
                </p>
              </div>
              <p className="text-muted-foreground text-xs">
                Si este mensaje no desaparece,{' '}
                <button
                  type="button"
                  onClick={() => navigate({ to: '/login' })}
                  className="text-foreground underline underline-offset-2"
                >
                  solicita un nuevo enlace
                </button>
                .
              </p>
            </div>
          ) : (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              <LoginInput
                label="Nueva contraseña"
                type="password"
                value={password}
                onChange={setPassword}
              />
              <LoginInput
                label="Confirmar contraseña"
                type="password"
                value={confirm}
                onChange={setConfirm}
              />
              {error && <p className="text-destructive text-sm">{error}</p>}
              <SubmitButton
                text="Actualizar contraseña"
                loadingText="Actualizando..."
                loading={loading}
              />
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

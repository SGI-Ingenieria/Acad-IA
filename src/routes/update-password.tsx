import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { LoginField, LoginSubmitButton } from '@/components/auth/LoginField'
import { useAppForm } from '@/components/form'
import { supabaseBrowser } from '@/data/supabase/client'

export const Route = createFileRoute('/update-password')({
  component: UpdatePasswordPage,
})

function UpdatePasswordPage() {
  // Capture hash type synchronously before Supabase async processing clears it
  const [flowType] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.hash.slice(1)).get('type')
  })

  const [ready, setReady] = useState(false)
  // Error del servidor del último intento: presentación efímera.
  const [serverError, setServerError] = useState('')
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  const isInvite = flowType === 'invite'

  const validateExternalPasswordFlow = async () => {
    const supabase = supabaseBrowser()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    const user = userData.user

    if (userError || !user) {
      return 'No se pudo validar la sesión. Solicita un nuevo enlace.'
    }

    const { data: profile, error: profileError } = await supabase
      .from('usuarios_app')
      .select('externo')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      return 'No se pudo validar el tipo de cuenta. Intenta de nuevo.'
    }

    if (!profile) {
      return 'La cuenta no está registrada en la aplicación.'
    }

    if (!profile.externo) {
      await supabase.auth.signOut()
      return 'Las cuentas internas usan la contraseña institucional y no pueden actualizarla aquí.'
    }

    return null
  }

  // Sincronización con un sistema externo (eventos de auth de Supabase).
  useEffect(() => {
    const {
      data: { subscription },
    } = supabaseBrowser().auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
      if (event === 'SIGNED_IN' && isInvite) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [isInvite])

  const form = useAppForm({
    defaultValues: { password: '', confirm: '' },
    onSubmit: async ({ value }) => {
      setServerError('')

      const flowError = await validateExternalPasswordFlow()
      if (flowError) {
        setServerError(flowError)
        return
      }

      const { error: updateError } = await supabaseBrowser().auth.updateUser({
        password: value.password,
      })

      if (updateError) {
        setServerError(
          'No se pudo establecer la contraseña. El enlace puede haber expirado.',
        )
        return
      }

      setDone(true)
      setTimeout(() => navigate({ to: isInvite ? '/' : '/login' }), 2500)
    },
  })

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
            {isInvite ? 'Establece tu contraseña' : 'Nueva contraseña'}
          </h1>
          <p className="text-muted-foreground mb-6 text-center text-sm">
            {isInvite
              ? 'Crea una contraseña para acceder al sistema'
              : 'Elige una contraseña segura para tu cuenta'}
          </p>

          {done ? (
            <div className="space-y-4 text-center">
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-foreground text-sm font-medium">
                  Contraseña {isInvite ? 'establecida' : 'actualizada'}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {isInvite
                    ? 'Redirigiendo al inicio…'
                    : 'Redirigiendo al inicio de sesión…'}
                </p>
              </div>
            </div>
          ) : !ready ? (
            <div className="space-y-4 text-center">
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-muted-foreground text-sm">
                  {isInvite
                    ? 'Verificando invitación…'
                    : 'Verificando enlace de recuperación…'}
                </p>
              </div>
              <p className="text-muted-foreground text-xs">
                Si este mensaje no desaparece,{' '}
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: '/login',
                      search: { redirect: window.location.href },
                    })
                  }
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
                void form.handleSubmit()
              }}
            >
              <form.AppField
                name="password"
                validators={{
                  onChange: ({ value }) =>
                    value.length < 6
                      ? 'La contraseña debe tener al menos 6 caracteres.'
                      : undefined,
                }}
              >
                {() => <LoginField label="Nueva contraseña" type="password" />}
              </form.AppField>
              <form.AppField
                name="confirm"
                validators={{
                  onChangeListenTo: ['password'],
                  onChange: ({ value, fieldApi }) =>
                    value !== fieldApi.form.getFieldValue('password')
                      ? 'Las contraseñas no coinciden.'
                      : undefined,
                }}
              >
                {() => (
                  <LoginField label="Confirmar contraseña" type="password" />
                )}
              </form.AppField>
              {serverError && (
                <p className="text-destructive text-sm">{serverError}</p>
              )}
              <form.AppForm>
                <LoginSubmitButton
                  text={
                    isInvite ? 'Establecer contraseña' : 'Actualizar contraseña'
                  }
                  loadingText={isInvite ? 'Guardando...' : 'Actualizando...'}
                />
              </form.AppForm>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

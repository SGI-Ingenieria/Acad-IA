import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { LoginInput } from '../ui/LoginInput'
import { SubmitButton } from '../ui/SubmitButton'
import { LoginTabs } from './LoginTabs'

import { useCreateUsuarioDirecto } from '@/data/hooks/useUsuarios'


type View = 'form' | 'success'

export function RegistroCard() {
  const [type, setType] = useState<'internal' | 'external'>('external')
  const [view, setView] = useState<View>('form')

  const [nombreCompleto, setNombreCompleto] = useState('')
  const [clave, setClave] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [masterPassword, setMasterPassword] = useState('')
  const [error, setError] = useState('')

  const { mutate: crearUsuario, isPending } = useCreateUsuarioDirecto()
  const navigate = useNavigate()

  const emailFinal =
    type === 'internal' ? `${clave.trim()}@ulsa.mx` : email.trim()

  const handleSubmit = () => {
    setError('')

    if (!nombreCompleto.trim()) {
      setError('El nombre completo es requerido.')
      return
    }
    if (type === 'internal' && !clave.trim()) {
      setError('La clave ULSA es requerida.')
      return
    }
    if (type === 'external' && !email.trim()) {
      setError('El correo electrónico es requerido.')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (!masterPassword) {
      setError('La contraseña maestra es requerida.')
      return
    }

    crearUsuario(
      {
        nombre_completo: nombreCompleto.trim(),
        email: emailFinal,
        password,
        externo: type === 'external',
        masterPassword,
      },
      {
        onSuccess: () => {
          setPassword('')
          setConfirmPassword('')
          setMasterPassword('')
          setView('success')
        },
        onError: (err) => {
          setError(err.message || 'No se pudo crear la cuenta. Intenta de nuevo.')
        },
      },
    )
  }

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
        Crear cuenta
      </h1>
      <p className="text-muted-foreground mb-6 text-center text-sm">
        Acceso al Sistema de Planes de Estudio
      </p>

      {view === 'success' ? (
        <div className="space-y-5">
          <div className="bg-muted/50 rounded-xl p-4 text-center">
            <p className="text-foreground text-sm font-medium">
              Cuenta creada exitosamente
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              Ya puedes iniciar sesión con{' '}
              <span className="font-medium">{emailFinal}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: '/login', search: { redirect: '/' } })}
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-xl py-2 text-sm font-medium shadow-sm transition-colors"
          >
            Ir al inicio de sesión
          </button>
        </div>
      ) : (
        <>
          <LoginTabs value={type} onChange={setType} />

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmit()
            }}
          >
            {type === 'internal' ? (
              <div className="space-y-2">
                <div className="relative">
                  <LoginInput
                    label="Clave ULSA"
                    value={clave}
                    onChange={setClave}
                    disabled
                    placeholder="Próximamente disponible"
                  />
                </div>
                <p className="text-muted-foreground text-xs leading-5">
                  El registro con clave institucional estará disponible próximamente.
                </p>
              </div>
            ) : (
              <LoginInput
                label="Correo electrónico"
                value={email}
                onChange={setEmail}
              />
            )}

            <LoginInput
              label="Nombre completo"
              value={nombreCompleto}
              onChange={setNombreCompleto}
            />

            <LoginInput
              label="Contraseña"
              type="password"
              value={password}
              onChange={setPassword}
            />

            <LoginInput
              label="Confirmar contraseña"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />

            <div className="space-y-1">
              <LoginInput
                label="Contraseña maestra"
                type="password"
                value={masterPassword}
                onChange={setMasterPassword}
              />
              <p className="text-muted-foreground text-xs leading-5">
                Requerida para crear nuevas cuentas. Solicítala al administrador.
              </p>
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <SubmitButton
              text="Crear cuenta"
              loadingText="Creando cuenta..."
              loading={isPending}
              disabled={type === 'internal'}
            />
          </form>

          <p className="text-muted-foreground mt-6 text-center text-sm">
            ¿Ya tienes cuenta?{' '}
            <Link
              to="/login"
              search={{ redirect: '/' }}
              className="text-foreground font-medium underline underline-offset-2 hover:no-underline"
            >
              Iniciar sesión
            </Link>
          </p>
        </>
      )}
    </div>
  )
}

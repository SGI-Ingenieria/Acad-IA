import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'

import { LoginField, LoginSubmitButton } from './LoginField'
import { LoginTabs } from './LoginTabs'

import type { CreateUsuarioDirectoInput } from '@/data/api/usuarios.api'

import { useAppForm } from '@/components/form'
import { useCreateUsuarioDirecto } from '@/data/hooks/useUsuarios'

type UserType = 'external' | 'internal'
type View = 'form' | 'success'

const CLAVE_REGEX = /^(ad|do)\d{6}$/
const INTERNAL_EMAIL_REGEX = /@(lasalle\.mx|lasallistas\.org\.mx)$/i

const nombreSchema = z
  .string()
  .trim()
  .min(1, 'El nombre completo es requerido.')

const emailSchema = z
  .string()
  .trim()
  .min(1, 'El correo electrónico es requerido.')
  .pipe(z.email('Ingresa un correo electrónico válido.'))

export function RegistroCard() {
  const [view, setView] = useState<View>('form')
  const [type, setType] = useState<UserType>('external')
  // Error del servidor del último intento: presentación efímera.
  const [serverError, setServerError] = useState('')

  const crearUsuario = useCreateUsuarioDirecto()
  const navigate = useNavigate()

  const form = useAppForm({
    defaultValues: {
      nombreCompleto: '',
      email: '',
      clave: '',
      password: '',
      confirmPassword: '',
      masterPassword: '',
    },
    onSubmit: async ({ value, formApi }) => {
      setServerError('')

      const payload: CreateUsuarioDirectoInput =
        type === 'internal'
          ? {
              type: 'internal',
              nombre_completo: value.nombreCompleto.trim(),
              email: value.email.trim(),
              clave: value.clave.trim().toLowerCase(),
              masterPassword: value.masterPassword,
            }
          : {
              type: 'external',
              nombre_completo: value.nombreCompleto.trim(),
              email: value.email.trim(),
              password: value.password,
              masterPassword: value.masterPassword,
            }

      try {
        await crearUsuario.mutateAsync(payload)
        formApi.setFieldValue('password', '')
        formApi.setFieldValue('confirmPassword', '')
        formApi.setFieldValue('masterPassword', '')
        setView('success')
      } catch (err) {
        setServerError(
          (err as Error).message ||
            'No se pudo crear la cuenta. Intenta de nuevo.',
        )
      }
    },
  })

  const handleTypeChange = (v: UserType) => {
    setType(v)
    setServerError('')
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
              {type === 'internal'
                ? 'Ya puedes iniciar sesión con tu Clave La Salle.'
                : 'Ya puedes iniciar sesión con '}
              {type === 'external' && (
                <span className="font-medium">
                  {form.getFieldValue('email').trim()}
                </span>
              )}
              {type === 'external' && '.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              navigate({ to: '/login', search: { redirect: '/' } })
            }
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-xl py-2 text-sm font-medium shadow-sm transition-colors"
          >
            Ir al inicio de sesión
          </button>
        </div>
      ) : (
        <>
          <LoginTabs value={type} onChange={handleTypeChange} />

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
          >
            <form.AppField
              name="nombreCompleto"
              validators={{ onChange: nombreSchema }}
            >
              {() => <LoginField label="Nombre completo" />}
            </form.AppField>

            <form.AppField
              name="email"
              validators={{
                onChange: ({ value }) => {
                  const base = emailSchema.safeParse(value)
                  if (!base.success) {
                    return base.error.issues[0]?.message
                  }
                  if (
                    type === 'internal' &&
                    !INTERNAL_EMAIL_REGEX.test(value.trim())
                  ) {
                    return 'Los usuarios internos deben usar correo @lasalle.mx o @lasallistas.org.mx.'
                  }
                  return undefined
                },
              }}
            >
              {() => <LoginField label="Correo electrónico" />}
            </form.AppField>

            {type === 'internal' && (
              <form.AppField
                name="clave"
                validators={{
                  onChange: ({ value }) => {
                    if (!value.trim()) return 'La Clave La Salle es requerida.'
                    if (!CLAVE_REGEX.test(value.trim().toLowerCase())) {
                      return 'Formato de clave inválido. Debe ser ad o do seguido de 6 dígitos (ejemplo: ad123456).'
                    }
                    return undefined
                  },
                }}
              >
                {() => (
                  <LoginField
                    label="Clave La Salle"
                    hint="Ejemplo: ad123456 (administrativo) o do123456 (docente)."
                  />
                )}
              </form.AppField>
            )}

            {type === 'external' && (
              <>
                <form.AppField
                  name="password"
                  validators={{
                    onChange: ({ value }) =>
                      value.length < 6
                        ? 'La contraseña debe tener al menos 6 caracteres.'
                        : undefined,
                  }}
                >
                  {() => <LoginField label="Contraseña" type="password" />}
                </form.AppField>

                <form.AppField
                  name="confirmPassword"
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
              </>
            )}

            <form.AppField
              name="masterPassword"
              validators={{
                onChange: ({ value }) =>
                  value ? undefined : 'La contraseña maestra es requerida.',
              }}
            >
              {() => (
                <LoginField
                  label="Contraseña maestra"
                  type="password"
                  hint="Requerida para crear nuevas cuentas. Solicítala al administrador."
                />
              )}
            </form.AppField>

            {serverError && (
              <p className="text-destructive text-sm">{serverError}</p>
            )}

            <form.AppForm>
              <LoginSubmitButton
                text="Crear cuenta"
                loadingText="Creando cuenta..."
              />
            </form.AppForm>
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

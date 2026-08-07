import { useFieldContext, useFormContext } from '@/components/form'
import { LoginInput } from '@/components/ui/LoginInput'

/**
 * Campo de texto con la estética de las pantallas de acceso, ligado al form
 * activo (se usa dentro de `form.AppField`). Muestra el error del campo tras
 * blur o submit, con `aria-describedby` hacia el mensaje.
 */
export function LoginField({
  label,
  type,
  hint,
  placeholder,
  disabled,
}: {
  label: string
  type?: string
  hint?: string
  placeholder?: string
  disabled?: boolean
}) {
  const field = useFieldContext<string>()
  const invalid = field.state.meta.isTouched && !field.state.meta.isValid
  const error = field.state.meta.errors
    .map((e: unknown) =>
      typeof e === 'string' ? e : ((e as { message?: string }).message ?? ''),
    )
    .filter(Boolean)
    .join(', ')

  return (
    <div className="space-y-micro">
      <LoginInput
        id={field.name}
        label={label}
        type={type}
        value={field.state.value}
        onChange={field.handleChange}
        onBlur={field.handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${field.name}-error` : undefined}
      />
      {invalid ? (
        <p id={`${field.name}-error`} className="text-destructive text-sm">
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs leading-5">{hint}</p>
      ) : null}
    </div>
  )
}

/**
 * Botón de envío de las pantallas de acceso, ligado al form activo (se usa
 * dentro de `form.AppForm`): se deshabilita y cambia el texto durante el
 * submit, evitando el doble envío.
 */
export function LoginSubmitButton({
  text = 'Iniciar sesión',
  loadingText,
}: {
  text?: string
  loadingText?: string
}) {
  const form = useFormContext()
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/50 py-control w-full cursor-pointer rounded-xl text-sm font-semibold shadow-md transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (loadingText ?? `${text}...`) : text}
        </button>
      )}
    </form.Subscribe>
  )
}

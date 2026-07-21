import { Loader2 } from 'lucide-react'

import { useFormContext } from './contexts'

import { Button } from '@/components/ui/button'

/**
 * Botón de envío suscrito al estado del form: se deshabilita mientras el form
 * no puede enviarse y muestra spinner durante el submit (evita el doble envío
 * sin ocultar el label).
 */
export function FormSubmitButton({
  children,
  disabled,
  ...buttonProps
}: React.ComponentProps<typeof Button>) {
  const form = useFormContext()
  return (
    <form.Subscribe
      selector={(state) => [state.canSubmit, state.isSubmitting] as const}
    >
      {([canSubmit, isSubmitting]) => (
        <Button
          type="submit"
          disabled={disabled || !canSubmit || isSubmitting}
          {...buttonProps}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {children}
        </Button>
      )}
    </form.Subscribe>
  )
}

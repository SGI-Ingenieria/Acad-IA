import type { AnyFieldMeta } from '@tanstack/react-form'

import { cn } from '@/lib/utils'

/**
 * Un campo se pinta como inválido sólo después de tocarlo: los asistentes
 * validan al continuar, no mientras se escribe, y marcar en rojo lo que nadie
 * ha llegado a rellenar convierte un formulario recién abierto en una lista de
 * reproches.
 */
export const fieldInvalid = (meta: AnyFieldMeta): boolean =>
  meta.isTouched && !meta.isValid

/**
 * Mensaje de error de un campo de TanStack Form, asociado al control por
 * `aria-describedby` mediante `id`.
 */
export function FieldErrorText({
  meta,
  id,
  className,
}: {
  meta: AnyFieldMeta
  id: string
  className?: string
}) {
  if (!fieldInvalid(meta)) return null
  const message = meta.errors
    .map((e: unknown) =>
      typeof e === 'string' ? e : ((e as { message?: string }).message ?? ''),
    )
    .filter(Boolean)
    .join(', ')
  return (
    <p id={id} className={cn('text-destructive text-sm', className)}>
      {message}
    </p>
  )
}

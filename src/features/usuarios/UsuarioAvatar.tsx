import { Camera, Loader2 } from 'lucide-react'
import { useId, useRef } from 'react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  useUploadUsuarioAvatar,
  useUsuarioAvatarUrl,
} from '@/data/hooks/useUsuarios'
import { getInitials } from '@/lib/initials'
import { cn } from '@/lib/utils'

const MAX_AVATAR_BYTES = 4 * 1024 * 1024 // 4 MB

/**
 * Foto de perfil de un usuario con fallback a iniciales. La imagen vive en
 * Storage en una ruta determinista por id (sin columna en BD); si no existe, el
 * `<Avatar>` muestra las iniciales automáticamente.
 *
 * Cuando `editable`, superpone un control para subir/reemplazar la foto al
 * momento. Debe usarse fuera de cualquier `<button>` ancestro (el control de
 * subida es interactivo).
 */
export function UsuarioAvatar({
  userId,
  nombre,
  editable = false,
  className,
  fallbackClassName,
  status,
}: {
  userId: string
  nombre: string | null | undefined
  editable?: boolean
  /** Clases para el contenedor `Avatar` (tamaño, ring, etc.). */
  className?: string
  /** Clases para el fallback de iniciales (tinte por acento). */
  fallbackClassName?: string
  /** Punto de estado en la esquina inferior derecha. */
  status?: { dotClass: string; pulse?: boolean }
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const url = useUsuarioAvatarUrl(userId)
  const upload = useUploadUsuarioAvatar()

  const handleFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('La imagen no debe superar los 4 MB')
      return
    }
    upload.mutate(
      { userId, file },
      {
        onSuccess: () => toast.success('Foto de perfil actualizada'),
        onError: () => toast.error('No se pudo subir la foto de perfil'),
      },
    )
  }

  return (
    <div className="relative shrink-0">
      <Avatar className={cn('h-10 w-10', className)}>
        {url && <AvatarImage src={url} alt={nombre ?? 'Usuario'} />}
        <AvatarFallback
          className={cn('text-sm font-bold', fallbackClassName)}
        >
          {getInitials(nombre)}
        </AvatarFallback>
      </Avatar>

      {editable && (
        <>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              handleFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
            aria-label={
              url ? 'Cambiar foto de perfil' : 'Agregar foto de perfil'
            }
            className={cn(
              'absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity outline-none focus-visible:opacity-100',
              'hover:opacity-100',
              upload.isPending && 'opacity-100',
            )}
          >
            {upload.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </button>
        </>
      )}

      {status && (
        <span className="ring-card absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2">
          <span
            className={cn(
              'block h-2.5 w-2.5 rounded-full',
              status.dotClass,
              status.pulse && 'status-pulse',
            )}
          />
        </span>
      )}
    </div>
  )
}

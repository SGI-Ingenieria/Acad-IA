import { FileText, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { ComentarioAdjunto } from '@/data/types/domain'

import { files_get_signed_url } from '@/data/api/files.api'
import { notify } from '@/lib/toast'

function isImageAttachment(a: ComentarioAdjunto): boolean {
  if (a.mime?.startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(a.path)
}

export function CommentAttachments({
  adjuntos,
}: {
  adjuntos: Array<ComentarioAdjunto>
}) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [opening, setOpening] = useState<string | null>(null)

  const images = adjuntos.filter(isImageAttachment)
  const docs = adjuntos.filter((a) => !isImageAttachment(a))

  // Firmar URLs de imágenes para mostrar miniaturas.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const entries = await Promise.all(
        images.map(async (a) => {
          try {
            const { signedUrl } = await files_get_signed_url({
              path: a.path,
              bucket: a.bucket,
            })
            return [a.id, signedUrl] as const
          } catch {
            return [a.id, ''] as const
          }
        }),
      )
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!cancelled) {
        setThumbs(
          Object.fromEntries(entries.filter(([, url]) => url.length > 0)),
        )
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjuntos])

  const openAttachment = async (a: ComentarioAdjunto) => {
    setOpening(a.id)
    try {
      const { finalUrl } = await files_get_signed_url({
        path: a.path,
        bucket: a.bucket,
        preview: true,
      })
      window.open(finalUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      notify.error(err, { description: 'No se pudo abrir el archivo.' })
    } finally {
      setOpening(null)
    }
  }

  if (adjuntos.length === 0) return null

  return (
    <div className="mt-relacionado gap-relacionado flex flex-col">
      {images.length > 0 && (
        <div className="gap-relacionado flex flex-wrap">
          {images.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => void openAttachment(a)}
              className="border-border bg-muted focus-visible:ring-ring/40 relative h-24 w-24 overflow-hidden rounded-lg border transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
              aria-label={`Abrir imagen ${a.nombre ?? ''}`}
            >
              {thumbs[a.id] ? (
                <img
                  src={thumbs[a.id]}
                  alt={a.nombre ?? 'Imagen adjunta'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-muted-foreground flex h-full w-full items-center justify-center">
                  <Loader2 size={16} className="animate-spin" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {docs.length > 0 && (
        <div className="gap-relacionado flex flex-col">
          {docs.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => void openAttachment(a)}
              disabled={opening === a.id}
              className="border-border bg-muted/50 hover:bg-muted gap-relacionado px-control py-relacionado flex items-center rounded-lg border text-left text-xs transition-colors"
            >
              <span className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded">
                {opening === a.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileText size={16} />
                )}
              </span>
              <span className="min-w-0 truncate">
                {a.nombre ?? 'Documento adjunto'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

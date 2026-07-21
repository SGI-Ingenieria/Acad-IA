import { FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { useRef } from 'react'

import { Button } from '@/components/ui/button'
import { documentos_url_firmada } from '@/data/api/documentos.api'
import {
  useDocumentos,
  useEliminarDocumento,
  useSubirDocumento,
} from '@/data/hooks/useDocumentos'

const ACCEPT =
  '.pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp'

export function DocumentTable() {
  const inputRef = useRef<HTMLInputElement>(null)
  const documentos = useDocumentos()
  const subir = useSubirDocumento()
  const eliminar = useEliminarDocumento()

  const openDocument = async (id: string) => {
    const url = await documentos_url_firmada(id)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="space-y-5">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Documentos de referencia</h1>
          <p className="text-muted-foreground text-sm">
            Contenido privado, procesado e indexado dentro de Acad-IA.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void subir.mutateAsync(file)
          }}
        />
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={subir.isPending}
        >
          {subir.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
          Subir documento
        </Button>
      </header>
      <div className="divide-border divide-y rounded-lg border">
        {documentos.isLoading ? (
          <p className="text-muted-foreground p-4 text-sm">
            Cargando documentos…
          </p>
        ) : null}
        {(documentos.data ?? []).map((documento) => (
          <article key={documento.id} className="flex items-center gap-3 p-4">
            <FileText className="text-muted-foreground h-5 w-5" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {documento.display_name}
              </p>
              <p className="text-muted-foreground text-xs">
                {documento.status === 'ready'
                  ? 'Listo para IA'
                  : documento.status === 'processing'
                    ? 'Procesando e indexando…'
                    : documento.status}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={documento.status !== 'ready'}
              onClick={() => void openDocument(documento.id)}
            >
              Abrir
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Eliminar documento"
              disabled={eliminar.isPending}
              onClick={() => eliminar.mutate(documento.id)}
            >
              <Trash2 className="text-destructive h-4 w-4" />
            </Button>
          </article>
        ))}
        {!documentos.isLoading && !(documentos.data ?? []).length ? (
          <p className="text-muted-foreground p-4 text-sm">
            Sube un documento para utilizarlo como referencia en las
            generaciones de IA.
          </p>
        ) : null}
      </div>
    </section>
  )
}

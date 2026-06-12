import { FileText, FolderOpen, Link as LinkIcon, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import BarraBusqueda from '../../BarraBusqueda'

import { FileDropzone } from './FileDropZone'

import type { UploadedFile } from './FileDropZone'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TabsContents,
} from '@/components/ui/motion-tabs'
import { supabaseBrowser } from '@/data'
import { useRepositorios } from '@/data/hooks/useFiles'
import { formatFileSize } from '@/features/planes/utils/format-file-size'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'

type ArchivoConOpenAI = {
  id: string
  path: string
  size: number | null
  openai_file_id: string
  created_at: string | null
}

type SignedUrlCacheEntry = {
  url: string
  expiresAt: number
}

const SIGNED_URL_EXPIRES_IN_SECONDS = 600

// Base pública (devtunnel) hacia Kong para pruebas locales.
const LOCAL_KONG_BASE_URL = 'https://mrx7013v-54321.usw3.devtunnels.ms/'

const isLocalApp = () => {
  try {
    const host = window.location.hostname
    return host === 'localhost' || host === '127.0.0.1'
  } catch {
    return false
  }
}

const rewriteSignedUrlForLocalKong = (signedUrl: string) => {
  if (!isLocalApp()) return signedUrl

  try {
    const src = new URL(signedUrl)
    const isLocalOrigin =
      src.hostname === 'localhost' || src.hostname === '127.0.0.1'
    if (!isLocalOrigin) return signedUrl

    const base = new URL(LOCAL_KONG_BASE_URL)
    src.protocol = base.protocol
    // Usamos hostname en lugar de host para no arrastrar puertos viejos
    src.hostname = base.hostname
    // Copiamos el puerto de la base (que en devtunnels será vacío por ser HTTPS estándar)
    src.port = base.port

    return src.toString()
  } catch {
    return signedUrl
  }
}

const getExtension = (path: string) => {
  const base = getBasename(path)
  const dot = base.lastIndexOf('.')
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : ''
}

const toOfficeViewerUrl = (signedUrl: string) => {
  const url = rewriteSignedUrlForLocalKong(signedUrl)
  console.log('URL a enviar a Google:', url)
  return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`
}

const isOfficeDoc = (path: string) => {
  const ext = getExtension(path)
  return ext === 'doc' || ext === 'docx'
}

const getBasename = (path: string) => {
  const parts = path.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : path
}

const stripUuidPrefixFromBasename = (basename: string) => {
  return basename.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
    '',
  )
}

const ReferenciasParaIA = ({
  selectedArchivoIds = [],
  selectedRepositorioIds = [],
  uploadedFiles = [],
  onToggleArchivo,
  onToggleRepositorio,
  onFilesChange,
  enableSha256Dedupe,
  onDedupePendingChange,
  enableAutoUpload,
  autoScrollToDropzone,
}: {
  selectedArchivoIds?: Array<string>
  selectedRepositorioIds?: Array<string>
  uploadedFiles?: Array<UploadedFile>
  onToggleArchivo?: (id: string, checked: boolean) => void
  onToggleRepositorio?: (id: string, checked: boolean) => void
  onFilesChange?: (files: Array<UploadedFile>) => void
  enableSha256Dedupe?: boolean
  onDedupePendingChange?: (pendingCount: number) => void
  enableAutoUpload?: boolean
  autoScrollToDropzone?: boolean
}) => {
  const [busquedaArchivos, setBusquedaArchivos] = useState('')
  const [busquedaRepositorios, setBusquedaRepositorios] = useState('')
  const [archivos, setArchivos] = useState<Array<ArchivoConOpenAI>>([])
  const [signedUrls, setSignedUrls] = useState<
    Record<string, SignedUrlCacheEntry | undefined>
  >({})
  const signedUrlsRef = useRef<Record<string, SignedUrlCacheEntry | undefined>>(
    {},
  )
  const signingPromisesRef = useRef(new Map<string, Promise<string>>())
  const [isSigningById, setIsSigningById] = useState<Record<string, boolean>>(
    {},
  )

  const { data: repositorios = [] } = useRepositorios()

  useEffect(() => {
    signedUrlsRef.current = signedUrls
  }, [signedUrls])

  const cleanText = (text: string) => {
    return text
      .normalize('NFD') // Descompone "á" en "a" + "´"
      .replace(/[\u0300-\u036f]/g, '') // Elimina los símbolos diacríticos
      .toLowerCase() // Convierte a minúsculas
  }

  useEffect(() => {
    let isActive = true

    async function loadArchivos() {
      const supabase = supabaseBrowser()

      const { data, error } = await supabase
        .from('archivos')
        .select('id,path,size,openai_file_id,created_at')
        .not('openai_file_id', 'is', null)
        .order('created_at', { ascending: false })

      if (!isActive) return

      if (error) {
        console.error('Error cargando archivos de referencia:', error)
        setArchivos([])
        return
      }

      const rows = (Array.isArray(data) ? data : [])
        .map((r) => {
          const rec = r as unknown as {
            id: string
            path: string
            size: number | null
            openai_file_id: string | null
            created_at: string | null
          }

          const openaiFileId = rec.openai_file_id
            ? String(rec.openai_file_id)
            : ''
          if (!openaiFileId) return null

          return {
            id: String(rec.id),
            path: String(rec.path),
            size: typeof rec.size === 'number' ? rec.size : null,
            openai_file_id: openaiFileId,
            created_at: rec.created_at ? String(rec.created_at) : null,
          } satisfies ArchivoConOpenAI
        })
        .filter((x): x is ArchivoConOpenAI => Boolean(x))

      setArchivos(rows)
    }

    void loadArchivos()

    return () => {
      isActive = false
    }
  }, [])

  const getOrCreateSignedUrl = async (archivo: ArchivoConOpenAI) => {
    const cached = signedUrlsRef.current[archivo.id]
    if (cached?.url && cached.expiresAt > Date.now() + 5_000) return cached.url

    const existingPromise = signingPromisesRef.current.get(archivo.id)
    if (existingPromise) return existingPromise

    const p = (async () => {
      setIsSigningById((prev) => ({ ...prev, [archivo.id]: true }))
      try {
        const supabase = supabaseBrowser()
        const { data, error } = await supabase.storage
          .from('ai-storage')
          .createSignedUrl(archivo.path, SIGNED_URL_EXPIRES_IN_SECONDS, {
            download: false,
          })

        if (error) throw error

        const signedUrl = String(data.signedUrl)
        if (!signedUrl) throw new Error('No se pudo generar la URL firmada.')

        const nextEntry: SignedUrlCacheEntry = {
          url: signedUrl,
          expiresAt: Date.now() + SIGNED_URL_EXPIRES_IN_SECONDS * 1000,
        }

        setSignedUrls((prev) => ({ ...prev, [archivo.id]: nextEntry }))
        return signedUrl
      } finally {
        signingPromisesRef.current.delete(archivo.id)
        setIsSigningById((prev) => ({ ...prev, [archivo.id]: false }))
      }
    })()

    signingPromisesRef.current.set(archivo.id, p)
    return p
  }

  const getDocumentoHref = (archivo: ArchivoConOpenAI) => {
    const cached = signedUrls[archivo.id]
    if (!cached?.url || cached.expiresAt <= Date.now() + 5_000) return null
    return isOfficeDoc(archivo.path)
      ? toOfficeViewerUrl(cached.url)
      : cached.url
  }

  // Filtrado de archivos y de repositorios
  const archivosFiltrados = useMemo(() => {
    // Función helper para limpiar texto (quita acentos y hace minúsculas)

    const term = cleanText(busquedaArchivos)
    return archivos.filter((archivo) => {
      const basename = stripUuidPrefixFromBasename(getBasename(archivo.path))
      return cleanText(basename).includes(term)
    })
  }, [archivos, busquedaArchivos])

  useEffect(() => {
    const abort = { cancelled: false }
    const MAX_PREFETCH = 25
    const toPrefetch = archivosFiltrados.slice(0, MAX_PREFETCH)

    void (async () => {
      for (const archivo of toPrefetch) {
        if (abort.cancelled) return
        try {
          await getOrCreateSignedUrl(archivo)
        } catch {
          // ignore
        }
      }
    })()

    return () => {
      abort.cancelled = true
    }
  }, [archivosFiltrados])

  const repositoriosFiltrados = useMemo(() => {
    const term = cleanText(busquedaRepositorios)

    return repositorios.filter((repositorio: any) =>
      cleanText(repositorio.nombre || '').includes(term),
    )
  }, [repositorios, busquedaRepositorios])
  const tabs = [
    {
      name: 'Archivos existentes',

      value: 'archivos-existentes',

      icon: FileText,

      content: (
        <div className="flex flex-col">
          <BarraBusqueda
            value={busquedaArchivos}
            onChange={setBusquedaArchivos}
            placeholder="Buscar archivo existente..."
            className="m-1 mb-1.5"
          />
          <div className="flex h-96 flex-col gap-0.5 overflow-y-auto">
            {archivosFiltrados.map((archivo) => (
              <Label
                key={archivo.openai_file_id}
                className="border-border hover:border-primary/30 hover:bg-accent/50 m-0.5 flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors has-aria-checked:border-blue-600 has-aria-checked:bg-blue-50 dark:has-aria-checked:border-blue-900 dark:has-aria-checked:bg-blue-950"
              >
                <Checkbox
                  checked={selectedArchivoIds.includes(archivo.openai_file_id)}
                  onCheckedChange={(checked) =>
                    onToggleArchivo?.(archivo.openai_file_id, !!checked)
                  }
                  className={cn(
                    'peer border-primary ring-offset-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:ring-ring h-5 w-5 shrink-0 rounded-sm border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                    selectedArchivoIds.includes(archivo.openai_file_id)
                      ? ''
                      : 'invisible',
                  )}
                />

                <FileText className="text-muted-foreground h-4 w-4" />

                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">
                    {stripUuidPrefixFromBasename(getBasename(archivo.path))}
                  </p>

                  <p className="text-muted-foreground text-xs">
                    {archivo.size != null
                      ? formatFileSize(archivo.size)
                      : 'Tamaño no disponible'}
                  </p>

                  <div className="mt-1 flex items-center justify-between">
                    <a
                      href={getDocumentoHref(archivo) ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'text-muted-foreground hover:text-primary inline-flex items-center gap-1 text-xs underline transition-colors visited:text-[#551a8b] dark:visited:text-[#d0adf0]',
                        (isSigningById[archivo.id] ||
                          !getDocumentoHref(archivo)) &&
                          'pointer-events-none opacity-60',
                      )}
                      onMouseEnter={() => {
                        void getOrCreateSignedUrl(archivo)
                      }}
                      onFocus={() => {
                        void getOrCreateSignedUrl(archivo)
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        const href = getDocumentoHref(archivo)
                        if (href) return
                        e.preventDefault()
                        void getOrCreateSignedUrl(archivo).catch((err) => {
                          const message =
                            err instanceof Error
                              ? err.message
                              : 'No se pudo generar la URL firmada.'
                          notify.error(message)
                        })
                      }}
                    >
                      Ver documento <LinkIcon className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </Label>
            ))}
          </div>
        </div>
      ),
    },

    {
      name: 'Repositorios',

      value: 'repositorios',

      icon: FolderOpen,

      content: (
        <div className="flex flex-col">
          <BarraBusqueda
            value={busquedaRepositorios}
            onChange={setBusquedaRepositorios}
            placeholder="Buscar repositorio..."
            className="m-1 mb-1.5"
          />
          <div className="flex h-96 flex-col gap-0.5 overflow-y-auto">
            {repositoriosFiltrados.map((repositorio: any) => {
              const totalArchivos =
                repositorio.archivos_repositorios?.[0]?.count || 0

              const isSelected = selectedRepositorioIds.includes(
                repositorio.openai_vector_store_id,
              )

              const status =
                repositorio.status === 'completed'
                  ? 'Listo'
                  : repositorio.status === 'in_progress'
                    ? 'Procesando'
                    : 'Error'

              return (
                <Label
                  key={repositorio.id}
                  className={cn(
                    'border-border hover:border-primary/30 hover:bg-accent/50 m-0.5 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all',
                    isSelected && 'border-primary bg-primary/5',
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) =>
                      onToggleRepositorio?.(
                        repositorio.openai_vector_store_id,
                        !!checked,
                      )
                    }
                    className="mt-0.5"
                  />

                  <div
                    className={cn(
                      'rounded-lg p-2 transition-colors',
                      isSelected ? 'bg-primary/10' : 'bg-muted',
                    )}
                  >
                    <FolderOpen
                      className={cn(
                        'h-5 w-5',
                        isSelected ? 'text-primary' : 'text-muted-foreground',
                      )}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          'truncate text-sm font-semibold',
                          isSelected && 'text-primary',
                        )}
                      >
                        {repositorio.nombre}
                      </p>

                      <div
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-medium',
                          status === 'Listo' &&
                            'border-primary/20 bg-primary/10 text-primary',
                          status === 'Procesando' &&
                            'border-border bg-muted text-muted-foreground',
                          status === 'Error' &&
                            'border-destructive/20 bg-destructive/10 text-destructive',
                        )}
                      >
                        {status}
                      </div>
                    </div>

                    <p className="text-muted-foreground mt-1 text-xs">
                      {repositorio.descripcion || 'Repositorio de archivos'}
                    </p>

                    <div className="text-muted-foreground mt-2 flex items-center gap-2 text-[11px]">
                      <span>{totalArchivos} archivos</span>

                      {repositorio.updated_at && (
                        <>
                          <span>•</span>

                          <span>Actualizado recientemente</span>
                        </>
                      )}
                    </div>
                  </div>
                </Label>
              )
            })}
          </div>
        </div>
      ),
    },

    {
      name: 'Subir archivos',

      value: 'subir-archivos',

      icon: Upload,

      content: (
        <div className="p-1">
          <FileDropzone
            persistentFiles={uploadedFiles}
            onFilesChange={onFilesChange}
            enableSha256Dedupe={enableSha256Dedupe}
            onDedupePendingChange={onDedupePendingChange}
            enableAutoUpload={enableAutoUpload}
            title="Sube archivos de referencia"
            description="Documentos que serán usados como contexto para la generación"
            autoScrollToDropzone={autoScrollToDropzone}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="flex w-full flex-col gap-1">
      <Label>
        Referencias para la IA{' '}
        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
          (Opcional)
        </span>
      </Label>

      <Tabs defaultValue="archivos-existentes" className="gap-4">
        <TabsList className="w-full">
          {tabs.map(({ icon: Icon, name, value }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex items-center gap-1 px-2.5 sm:px-3"
            >
              <Icon />

              <span className="hidden sm:inline">{name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContents className="bg-background mx-1 -mt-2 mb-1 h-full rounded-sm">
          {tabs.map((tab) => (
            <TabsContent
              key={tab.value}
              value={tab.value}
              className="animate-in fade-in duration-300 ease-out"
            >
              {tab.content}
            </TabsContent>
          ))}
        </TabsContents>
      </Tabs>
    </div>
  )
}

export default ReferenciasParaIA

import { Link } from '@tanstack/react-router'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  BookOpen,
  Download,
  ExternalLink,
  Eye,
  FileText,
  FolderOpen,
  GraduationCap,
  MoreVertical,
  Sparkles,
} from 'lucide-react'
import { notify } from '@/lib/toast'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  files_download,
  files_get_signed_url,
} from '@/data/api/files.api'
import type {
  InteraccionReciente,
  InteraccionRecienteArchivo,
  InteraccionRecienteRepositorio,
} from '@/data/api/interaccionesIa.api'
import { useInteraccionesRecientes } from '@/data/hooks/useFiles'
import { cn } from '@/lib/utils'

const stripUuidPrefix = (basename: string) =>
  basename.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
    '',
  )

const getBasename = (path: string) => {
  const parts = path.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : path
}

const formatFileName = (path: string) => stripUuidPrefix(getBasename(path))

type Categoria = {
  label: string
  icon: typeof GraduationCap
  color: string
}

const categoriaFor = (item: InteraccionReciente): Categoria => {
  if (item.tipo === 'MEJORAR_SECCION') {
    return {
      label: 'Mejora con IA',
      icon: Sparkles,
      color:
        'text-purple-600 bg-purple-50 border-purple-100 dark:text-purple-400 dark:bg-purple-950/30 dark:border-purple-900/50',
    }
  }
  if (item.asignatura) {
    return {
      label: 'Materia',
      icon: BookOpen,
      color:
        'text-green-600 bg-green-50 border-green-100 dark:text-green-400 dark:bg-green-950/30 dark:border-green-900/50',
    }
  }
  if (item.plan_estudio) {
    return {
      label: 'Plan de estudios',
      icon: GraduationCap,
      color:
        'text-blue-600 bg-blue-50 border-blue-100 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-900/50',
    }
  }
  return {
    label: 'Interacción IA',
    icon: Sparkles,
    color:
      'text-purple-600 bg-purple-50 border-purple-100 dark:text-purple-400 dark:bg-purple-950/30 dark:border-purple-900/50',
  }
}

const tituloFor = (item: InteraccionReciente) => {
  if (item.asignatura?.nombre) return item.asignatura.nombre
  if (item.plan_estudio?.nombre) return item.plan_estudio.nombre
  return 'Interacción sin contexto'
}

const handleVerArchivo = async (archivo: InteraccionRecienteArchivo) => {
  try {
    const { finalUrl } = await files_get_signed_url({
      path: archivo.path,
      preview: true,
    })
    window.open(finalUrl, '_blank', 'noopener,noreferrer')
  } catch (e) {
    notify.error(
      e instanceof Error ? e.message : 'No se pudo abrir el archivo.',
    )
  }
}

const handleDescargarArchivo = async (archivo: InteraccionRecienteArchivo) => {
  try {
    const blob = await files_download({ path: archivo.path })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = formatFileName(archivo.path)
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    notify.error(
      e instanceof Error ? e.message : 'No se pudo descargar el archivo.',
    )
  }
}

function ArchivoRow({ archivo }: { archivo: InteraccionRecienteArchivo }) {
  return (
    <div className="text-muted-foreground hover:text-foreground group/file flex items-center gap-2 transition-colors">
      <FileText className="text-muted-foreground/70 h-3.5 w-3.5 shrink-0" />
      <span className="truncate text-xs">{formatFileName(archivo.path)}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-6 w-6 opacity-0 transition-opacity group-hover/file:opacity-100"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => handleVerArchivo(archivo)}>
            <Eye className="mr-2 h-4 w-4" /> Ver
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handleDescargarArchivo(archivo)}>
            <Download className="mr-2 h-4 w-4" /> Descargar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function RepositorioRow({ repo }: { repo: InteraccionRecienteRepositorio }) {
  return (
    <Link
      to="/referencias/repositorios/{-$repoId}"
      params={{ repoId: repo.id }}
      className="text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
    >
      <FolderOpen className="text-muted-foreground/70 h-3.5 w-3.5 shrink-0" />
      <span className="truncate text-xs">{repo.nombre}</span>
      <ExternalLink className="ml-auto h-3 w-3 opacity-60" />
    </Link>
  )
}

function InteraccionCard({ item }: { item: InteraccionReciente }) {
  const categoria = categoriaFor(item)
  const Icon = categoria.icon
  const titulo = tituloFor(item)
  const totalReferencias = item.archivos.length + item.repositorios.length

  const relativeUpdated = (() => {
    try {
      return formatDistanceToNow(parseISO(item.creado_en), {
        addSuffix: true,
        locale: es,
      })
    } catch {
      return ''
    }
  })()

  const planIdParaAsignatura = item.asignatura?.plan_estudio_id ?? null
  const asignaturaLink =
    item.asignatura && planIdParaAsignatura
      ? { planId: planIdParaAsignatura, asignaturaId: item.asignatura.id }
      : null
  const planLink =
    !asignaturaLink && item.plan_estudio
      ? { planId: item.plan_estudio.id }
      : null

  return (
    <Card className="border-border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <Badge
          variant="outline"
          className={cn(
            'flex items-center gap-1.5 px-2 py-0.5 font-medium',
            categoria.color,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {categoria.label}
        </Badge>
        <span className="text-muted-foreground text-[11px] font-medium">
          {relativeUpdated}
        </span>
      </CardHeader>

      <CardContent className="space-y-4">
        <h3 className="text-foreground line-clamp-2 leading-tight font-bold">
          {titulo}
        </h3>

        <div className="space-y-2">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Referencias usadas ({totalReferencias})
          </p>
          {totalReferencias === 0 ? (
            <p className="text-muted-foreground/70 text-xs italic">
              Sin archivos ni repositorios adjuntos.
            </p>
          ) : (
            <div className="space-y-1.5">
              {item.repositorios.map((repo) => (
                <RepositorioRow key={repo.id} repo={repo} />
              ))}
              {item.archivos.map((archivo) => (
                <ArchivoRow key={archivo.id} archivo={archivo} />
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-end pt-2">
        {asignaturaLink && (
          <Button
            asChild
            variant="link"
            size="sm"
            className="text-primary h-auto gap-1 p-0 font-semibold"
          >
            <Link
              to="/planes/$planId/asignaturas/$asignaturaId"
              params={asignaturaLink}
            >
              Ir a la materia
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
        {planLink && (
          <Button
            asChild
            variant="link"
            size="sm"
            className="text-primary h-auto gap-1 p-0 font-semibold"
          >
            <Link to="/planes/$planId" params={planLink}>
              Ir al plan
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

export function RecentActivityGrid() {
  const { data: interacciones, isLoading } = useInteraccionesRecientes(12)

  if (isLoading) {
    return (
      <div className="text-muted-foreground p-8 text-center text-sm">
        Cargando actividad reciente...
      </div>
    )
  }

  if (!interacciones?.length) {
    return (
      <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
        Aún no hay actividad reciente. Genera un plan o asignatura con IA para
        ver aquí tus archivos y repositorios usados.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {interacciones.map((item) => (
        <InteraccionCard key={item.id} item={item} />
      ))}
    </div>
  )
}

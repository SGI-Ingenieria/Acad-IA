import {
  CircleHelp,
  ClipboardList,
  Eye,
  FileText,
  Link,
  ListChecks,
  Presentation,
  Users,
} from 'lucide-react'

import type { RecursoTipo } from '@/data/api/recursos.api'
import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { RECURSO_TIPO_SINGULAR_LABEL } from '@/data/api/recursos.api'

export const TIPO_ICON: Record<RecursoTipo, LucideIcon> = {
  outline_presentacion: Presentation,
  apunte: FileText,
  quiz: CircleHelp,
  ejercicios: ListChecks,
  actividad: Users,
  rubrica: ClipboardList,
  recursos_externos: Link,
}

export function RecursoTipoBadge({ tipo }: { tipo: RecursoTipo }) {
  const Icon = TIPO_ICON[tipo]

  return (
    <Badge variant="secondary" className="shrink-0 gap-1 font-normal">
      <Icon className="h-3.5 w-3.5" />
      <span>{RECURSO_TIPO_SINGULAR_LABEL[tipo]}</span>
    </Badge>
  )
}

function getH5PSubtitulo(contenidoJson: unknown): string | null {
  if (!contenidoJson || typeof contenidoJson !== 'object') return null
  const payload = contenidoJson as Record<string, unknown>
  const ejercicios = payload.ejercicios
  if (!ejercicios || typeof ejercicios !== 'object') return null
  const actividades = (ejercicios as Record<string, unknown>).actividades_h5p
  if (!Array.isArray(actividades) || actividades.length === 0) return null
  const tipos = actividades
    .map((a) => (a as Record<string, unknown>).tipoActividad as string)
    .filter(Boolean)
  return tipos.length > 0 ? tipos.join(' · ') : null
}

export function RecursoItem({
  recurso,
  onClick,
}: {
  recurso: {
    id: string
    tipo: RecursoTipo
    titulo: string
    contenido_json?: unknown
  }
  onClick?: () => void
}) {
  const h5pSubtitulo =
    recurso.tipo === 'ejercicios'
      ? getH5PSubtitulo(recurso.contenido_json)
      : null

  return (
    <button
      type="button"
      onClick={onClick}
      className="group hover:bg-accent flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <RecursoTipoBadge tipo={recurso.tipo} />
          <span className="truncate text-sm">{recurso.titulo}</span>
        </div>
        {h5pSubtitulo && (
          <span className="text-muted-foreground truncate pl-1 text-xs">
            {h5pSubtitulo}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground flex items-center gap-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
          <Eye className="h-3.5 w-3.5" />
          Ver
        </span>
      </div>
    </button>
  )
}

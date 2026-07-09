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

export function RecursoItem({
  recurso,
  onClick,
}: {
  recurso: {
    id: string
    tipo: RecursoTipo
    titulo: string
  }
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group hover:bg-accent flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors"
    >
      <div className="flex min-w-0 items-center gap-2">
        <RecursoTipoBadge tipo={recurso.tipo} />
        <span className="truncate text-sm">{recurso.titulo}</span>
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

import {
  Check,
  CircleHelp,
  ClipboardList,
  FileText,
  Link,
  ListChecks,
  Loader2,
  Presentation,
  Users,
} from 'lucide-react'

import type { RecursoEstado, RecursoTipo } from '@/data/api/recursos.api'
import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  ESTADO_RECURSO_LABEL,
  RECURSO_TIPO_SINGULAR_LABEL,
} from '@/data/api/recursos.api'
import { cn } from '@/lib/utils'

export const TIPO_ICON: Record<RecursoTipo, LucideIcon> = {
  outline_presentacion: Presentation,
  apunte: FileText,
  quiz: CircleHelp,
  ejercicios: ListChecks,
  actividad: Users,
  rubrica: ClipboardList,
  recursos_externos: Link,
}

const ESTADO_DOT: Record<RecursoEstado, string> = {
  draft: 'bg-muted-foreground/40',
  generated: 'bg-blue-500',
  reviewed: 'bg-emerald-500',
  published: 'bg-green-600',
  archived: 'bg-slate-400',
}

export function RecursoTipoBadge({ tipo }: { tipo: RecursoTipo }) {
  const Icon = TIPO_ICON[tipo]

  return (
    <Badge variant="secondary" className="gap-1 font-normal">
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
    estado: RecursoEstado
  }
  onClick?: () => void
}) {
  const isDraft = recurso.estado === 'draft'

  return (
    <button
      type="button"
      onClick={onClick}
      className="group hover:bg-accent flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors"
    >
      <div className="flex items-center gap-2">
        <RecursoTipoBadge tipo={recurso.tipo} />
        <span
          className={cn('text-sm', isDraft && 'text-muted-foreground italic')}
        >
          {recurso.titulo}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn('h-2 w-2 rounded-full', ESTADO_DOT[recurso.estado])}
          title={ESTADO_RECURSO_LABEL[recurso.estado]}
        />
        {recurso.estado === 'published' ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : isDraft ? (
          <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />
        ) : null}
      </div>
    </button>
  )
}

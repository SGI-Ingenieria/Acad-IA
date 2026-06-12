import type { AsignaturaStatus, TipoAsignatura } from '@/types/plan'

export const asignaturaStatusConfig: Record<
  AsignaturaStatus,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    className?: string
  }
> = {
  generando: {
    label: 'Generando',
    variant: 'secondary',
    className: 'animate-pulse animation-duration-[2s]',
  },
  borrador: { label: 'Borrador', variant: 'secondary' },
  revisada: { label: 'Revisada', variant: 'outline' },
  aprobada: { label: 'Aprobada', variant: 'default' },
  archivada: { label: 'Archivada', variant: 'outline' },
  fallida: { label: 'Fallida', variant: 'destructive' },
}

export const asignaturaTipoConfig: Record<
  TipoAsignatura,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
  }
> = {
  OBLIGATORIA: { label: 'Obligatoria', variant: 'default' },
  OPTATIVA: { label: 'Optativa', variant: 'secondary' },
  TRONCAL: { label: 'Troncal', variant: 'outline' },
  OTRA: { label: 'Otra', variant: 'outline' },
}

import { LoaderCircle, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { usePermissions } from '@/data/hooks/usePermissions'
import { useReintentarGeneracionAsignatura } from '@/data/hooks/useSubjects'

export function ReintentarGeneracionAsignaturaButton({
  asignaturaId,
  planId,
  nombre,
  soloIcono = false,
}: {
  asignaturaId: string
  planId: string
  nombre: string
  soloIcono?: boolean
}) {
  const { has } = usePermissions()
  const reintento = useReintentarGeneracionAsignatura({
    asignaturaId,
    planId,
    nombre,
  })
  if (!has('ia.usar')) return null

  const boton = (
    <Button
      type="button"
      variant="ghost"
      size={soloIcono ? 'icon-sm' : 'sm'}
      className="relative z-10"
      aria-label={`Reintentar generación de ${nombre}`}
      aria-busy={reintento.isPending}
      disabled={reintento.isPending}
      onClick={(event) => {
        event.stopPropagation()
        reintento.mutate()
      }}
    >
      {reintento.isPending ? (
        <LoaderCircle className="animate-spin motion-reduce:animate-none" />
      ) : (
        <RotateCcw />
      )}
      {!soloIcono && (reintento.isPending ? 'Reintentando…' : 'Reintentar')}
    </Button>
  )

  return soloIcono ? (
    <Tooltip>
      <TooltipTrigger asChild>{boton}</TooltipTrigger>
      <TooltipContent>
        {reintento.isPending
          ? 'Reintentando generación…'
          : 'Reintentar generación'}
      </TooltipContent>
    </Tooltip>
  ) : (
    boton
  )
}

import { LoaderCircle, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { usePermissions } from '@/data/hooks/usePermissions'
import { useReintentarGeneracionAsignatura } from '@/data/hooks/useSubjects'

export function ReintentarGeneracionAsignaturaButton({
  asignaturaId,
  planId,
  nombre,
}: {
  asignaturaId: string
  planId: string
  nombre: string
}) {
  const { has } = usePermissions()
  const reintento = useReintentarGeneracionAsignatura({
    asignaturaId,
    planId,
    nombre,
  })
  if (!has('ia.usar')) return null

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
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
      {reintento.isPending ? 'Reintentando…' : 'Reintentar'}
    </Button>
  )
}

import { TemaItem } from './TemaItem'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export function UnidadCard({
  numero,
  titulo,
  temas,
}: {
  numero: number
  titulo: string
  temas: Array<{
    id: string
    titulo: string
    horas: number
  }>
}) {
  return (
    <Card>
      <CardContent className="space-y-grupo p-seccion">
        <div className="gap-control flex items-center">
          <Badge>Unidad {numero}</Badge>
          <h3 className="font-semibold">{titulo}</h3>
        </div>

        <div className="space-y-relacionado">
          {temas.map((tema) => (
            <TemaItem key={tema.id} {...tema} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

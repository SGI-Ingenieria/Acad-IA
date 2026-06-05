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
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <Badge>Unidad {numero}</Badge>
          <h3 className="font-semibold">{titulo}</h3>
        </div>

        <div className="space-y-2">
          {temas.map((tema) => (
            <TemaItem key={tema.id} {...tema} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

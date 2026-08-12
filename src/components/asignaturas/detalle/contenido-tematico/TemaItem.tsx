import { Pencil } from 'lucide-react'

import { EditTemaDialog } from './EditTemaDialog'

export function TemaItem({
  id,
  titulo,
  horas,
}: {
  id: string
  titulo: string
  horas: number
}) {
  return (
    <EditTemaDialog temaId={id} defaultValue={titulo} horas={horas}>
      <button className="px-grupo py-relacionado flex w-full items-center justify-between rounded-md border text-left hover:bg-gray-50">
        <span>{titulo}</span>
        <div className="text-muted-foreground gap-control flex items-center text-sm">
          <span>{horas} hrs</span>
          <Pencil className="h-4 w-4" />
        </div>
      </button>
    </EditTemaDialog>
  )
}

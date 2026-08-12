import { AlertTriangle } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  titulo?: string
  descripcion?: string
}
export const AlertaConflicto = ({
  isOpen,
  onOpenChange,
  onConfirm,
  titulo,
  descripcion,
}: Props) => {
  // Intentamos parsear el mensaje si viene como JSON para la lista de materias
  let contenido
  try {
    const data = JSON.parse(descripcion as any)
    contenido = (
      <div className="space-y-control">
        <p className="text-sm text-slate-600">{data.main}</p>
        <div className="gap-relacionado py-relacionado flex flex-wrap">
          {data.materias.map((m: string, i: number) => (
            <span
              key={i}
              className="animate-in fade-in zoom-in-95 px-control py-micro inline-flex items-center rounded-md border border-red-100 bg-red-50 text-xs font-medium text-red-700 duration-300"
            >
              <AlertTriangle className="mr-relacionado h-3 w-3 shrink-0" />
              {m}
            </span>
          ))}
        </div>
        <p className="mt-relacionado text-xs font-semibold text-slate-500">
          ¿Deseas ignorar la regla y moverla de todos modos (Esto eliminará la
          seriación)?
        </p>
      </div>
    )
  } catch {
    contenido = <p className="text-sm text-slate-600">{descripcion}</p>
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md rounded-2xl">
        <AlertDialogHeader>
          <div className="mb-grupo gap-control flex items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-xl font-bold tracking-tight">
              {titulo}
            </AlertDialogTitle>
          </div>
        </AlertDialogHeader>

        <AlertDialogDescription asChild>{contenido}</AlertDialogDescription>

        <AlertDialogFooter className="mt-grupo">
          <AlertDialogCancel asChild>
            <Button variant="ghost">Cancelar</Button>
          </AlertDialogCancel>

          <AlertDialogAction asChild>
            <Button
              onClick={onConfirm}
              className="bg-red-600 font-bold text-white shadow-lg shadow-red-200 hover:bg-red-700"
            >
              Mover de todos modos
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

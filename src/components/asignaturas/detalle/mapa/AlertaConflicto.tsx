import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { AlertTriangle } from 'lucide-react'

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
      <div className="space-y-3">
        <p className="text-sm text-slate-600">{data.main}</p>
        <div className="flex flex-wrap gap-2 py-2">
          {data.materias.map((m: string, i: number) => (
            <span
              key={i}
              className="animate-in fade-in zoom-in-95 inline-flex items-center rounded-md border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 duration-300"
            >
              <AlertTriangle className="mr-1.5 h-3 w-3 shrink-0" />
              {m}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs font-semibold text-slate-500">
          ¿Deseas ignorar la regla y moverla de todos modos (Esto eliminará la
          seriación)?
        </p>
      </div>
    )
  } catch {
    contenido = <p className="text-sm text-slate-600">{descripcion}</p>
  }

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-200 bg-slate-950/40 backdrop-blur-[2px]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-201 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <AlertDialog.Title className="text-xl font-bold tracking-tight text-slate-900">
              {titulo}
            </AlertDialog.Title>
          </div>

          <AlertDialog.Description asChild>{contenido}</AlertDialog.Description>

          <div className="mt-8 flex flex-col-reverse justify-end gap-3 sm:flex-row">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">Cancelar</Button>
              {/* Radix automáticamente llamará a onOpenChange(false) al hacer clic aquí */}
            </AlertDialog.Cancel>

            <AlertDialog.Action asChild>
              <Button
                onClick={onConfirm}
                className="bg-red-600 font-bold text-white shadow-lg shadow-red-200 hover:bg-red-700"
              >
                Mover de todos modos
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

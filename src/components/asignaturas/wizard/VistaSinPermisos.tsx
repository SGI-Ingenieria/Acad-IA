import { ShieldAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function VistaSinPermisos({ onClose }: { onClose: () => void }) {
  return (
    <>
      <DialogHeader className="p-seccion flex-none border-b">
        <DialogTitle>Nueva Asignatura</DialogTitle>
      </DialogHeader>
      <div className="p-seccion flex-1">
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive gap-relacionado flex items-center">
              <ShieldAlert className="h-5 w-5" />
              Sin permisos
            </CardTitle>
            <CardDescription>
              Solo el Jefe de Carrera puede crear asignaturas.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

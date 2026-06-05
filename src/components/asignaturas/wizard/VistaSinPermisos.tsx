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
      <DialogHeader className="flex-none border-b p-6">
        <DialogTitle>Nueva Asignatura</DialogTitle>
      </DialogHeader>
      <div className="flex-1 p-6">
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
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

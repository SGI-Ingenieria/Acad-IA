import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

export function EditTemaDialog({
  children,
  temaId,
  defaultValue,
  horas,
}: {
  children: React.ReactNode
  temaId: string
  defaultValue: string
  horas: number
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(defaultValue)

  function handleSave() {
    console.log('Guardar tema', temaId, value)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} className="w-full text-left">
        {children}
      </Button>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar tema</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={4}
          />

          <p className="text-muted-foreground text-sm">
            Horas asignadas: {horas}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

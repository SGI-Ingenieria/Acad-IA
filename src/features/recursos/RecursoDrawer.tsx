import { useEffect, useState } from 'react'

import type { RecursoEstado } from '@/data/api/recursos.api'
import type { Tables } from '@/types/supabase'

import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ESTADO_RECURSO_LABEL } from '@/data/api/recursos.api'

const ESTADOS: Array<RecursoEstado> = [
  'draft',
  'generated',
  'reviewed',
  'published',
  'archived',
]

export function RecursoDrawer({
  recurso,
  open,
  onOpenChange,
  onGuardar,
  isPending,
  readOnly,
}: {
  recurso: Tables<'learning_objects'> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onGuardar: (patch: {
    titulo: string
    descripcion: string
    estado: RecursoEstado
  }) => void
  isPending: boolean
  readOnly?: boolean
}) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [estado, setEstado] = useState<RecursoEstado>('draft')

  useEffect(() => {
    if (recurso) {
      setTitulo(recurso.titulo)
      setDescripcion(recurso.descripcion ?? '')
      setEstado(recurso.estado)
    }
  }, [recurso])

  if (!recurso) return null

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-lg">{recurso.titulo}</DrawerTitle>
          <DrawerDescription>
            Recurso tipo <span className="capitalize">{recurso.tipo}</span>
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-4 px-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="recurso-titulo">Título</Label>
            <Input
              id="recurso-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              disabled={readOnly || isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recurso-estado">Estado</Label>
            <Select
              value={estado}
              onValueChange={(v) => setEstado(v as RecursoEstado)}
              disabled={readOnly || isPending}
            >
              <SelectTrigger id="recurso-estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ESTADO_RECURSO_LABEL[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recurso-descripcion">Descripción / notas</Label>
            <Textarea
              id="recurso-descripcion"
              rows={5}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              disabled={readOnly || isPending}
            />
          </div>
        </div>

        <DrawerFooter className="flex-row justify-end gap-2">
          <DrawerClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cerrar
            </Button>
          </DrawerClose>
          {!readOnly && (
            <Button
              disabled={isPending}
              onClick={() => onGuardar({ titulo, descripcion, estado })}
            >
              {isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

import { useEffect, useState } from 'react'

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
import { Textarea } from '@/components/ui/textarea'
import { RECURSO_TIPO_SINGULAR_LABEL } from '@/data/api/recursos.api'

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
  onGuardar: (patch: { titulo: string; descripcion: string }) => void
  isPending: boolean
  readOnly?: boolean
}) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')

  useEffect(() => {
    if (recurso) {
      setTitulo(recurso.titulo)
      setDescripcion(recurso.descripcion ?? '')
    }
  }, [recurso])

  if (!recurso) return null

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-lg">{recurso.titulo}</DrawerTitle>
          <DrawerDescription>
            Contenido: {RECURSO_TIPO_SINGULAR_LABEL[recurso.tipo]}
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
              onClick={() => onGuardar({ titulo, descripcion })}
            >
              {isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

import { Check, Palette } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { LineaPlan } from '@/data'
import type { Tables } from '@/types/supabase'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  descripcionBloque,
  GUIA_DESCRIPCION_BLOQUE,
} from '@/lib/bloques-conocimiento'
import { PALETA_LINEAS_CURRICULARES } from '@/lib/linea-curricular-colors'
import { cn } from '@/lib/utils'

export type BloqueFormValue = {
  nombre: string
  descripcion: string
  color: string
  area: string | null
}

type Sugerencia = Tables<'lineas_curriculares_sugeridas'>

export function BloqueFormDialog({
  open,
  onOpenChange,
  bloque,
  colorInicial,
  sugerencias,
  sugerirAreaComun,
  coloresUsados,
  isPending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bloque: LineaPlan | null
  colorInicial: string
  sugerencias: Array<Sugerencia>
  sugerirAreaComun: boolean
  coloresUsados: Array<string | null>
  isPending: boolean
  onSubmit: (value: BloqueFormValue) => Promise<void>
}) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [color, setColor] = useState(colorInicial)
  const [area, setArea] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setNombre(bloque?.nombre ?? '')
    setDescripcion(bloque ? descripcionBloque(bloque) : '')
    setColor(bloque?.color ?? colorInicial)
    setArea(bloque?.area ?? null)
  }, [bloque, colorInicial, open])

  const aplicarSugerencia = (sugerencia: {
    nombre: string
    area?: string | null
    color?: string | null
  }) => {
    setNombre(sugerencia.nombre)
    setArea(sugerencia.area ?? null)
    if (
      sugerencia.color &&
      !coloresUsados.some(
        (usado) =>
          usado?.trim().toUpperCase() ===
          sugerencia.color?.trim().toUpperCase(),
      )
    ) {
      setColor(sugerencia.color)
    }
  }

  const puedeGuardar = nombre.trim().length > 0 && !isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {bloque ? 'Editar bloque de conocimiento' : 'Agregar bloque'}
          </DialogTitle>
          <DialogDescription>
            Nombra el cuerpo de conocimiento y explica por qué forma parte de
            este recorrido académico.
          </DialogDescription>
        </DialogHeader>

        {!bloque && (sugerencias.length > 0 || sugerirAreaComun) && (
          <div className="space-y-2">
            <Label>Sugerencias para comenzar</Label>
            <div className="flex flex-wrap gap-2">
              {sugerirAreaComun && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    aplicarSugerencia({
                      nombre: 'Área común',
                      area: 'Área común',
                    })
                  }
                >
                  Área común
                </Button>
              )}
              {sugerencias.map((sugerencia) => (
                <Button
                  key={sugerencia.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => aplicarSugerencia(sugerencia)}
                >
                  {sugerencia.color && (
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: sugerencia.color }}
                      aria-hidden
                    />
                  )}
                  {sugerencia.nombre}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="bloque-nombre">Nombre</Label>
          <Input
            id="bloque-nombre"
            value={nombre}
            maxLength={200}
            placeholder="Ejemplo: Redes y comunicaciones"
            onChange={(event) => setNombre(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bloque-descripcion">Propósito</Label>
          <Textarea
            id="bloque-descripcion"
            value={descripcion}
            maxLength={1600}
            rows={5}
            placeholder={GUIA_DESCRIPCION_BLOQUE}
            onChange={(event) => setDescripcion(event.target.value)}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Color</legend>
          <div className="flex flex-wrap gap-2">
            {PALETA_LINEAS_CURRICULARES.map((opcion) => {
              const selected = opcion.toUpperCase() === color.toUpperCase()
              return (
                <button
                  key={opcion}
                  type="button"
                  aria-label={`Elegir color ${opcion}`}
                  aria-pressed={selected}
                  className={cn(
                    'focus-visible:ring-ring relative size-8 rounded-full border-2 border-transparent outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                    selected && 'border-foreground/80',
                  )}
                  style={{ backgroundColor: opcion }}
                  onClick={() => setColor(opcion)}
                >
                  {selected && (
                    <Check className="absolute inset-0 m-auto size-4 text-white drop-shadow-sm" />
                  )}
                </button>
              )
            })}
            <label className="border-border bg-card focus-within:ring-ring relative flex size-8 cursor-pointer items-center justify-center rounded-full border focus-within:ring-2 focus-within:ring-offset-2">
              <Palette className="text-muted-foreground size-4" />
              <span className="sr-only">Elegir un color personalizado</span>
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
        </fieldset>

        <DialogFooter>
          <Button
            disabled={!puedeGuardar}
            onClick={() =>
              void onSubmit({
                nombre: nombre.trim(),
                descripcion: descripcion.trim(),
                color,
                area,
              })
            }
          >
            {isPending
              ? 'Guardando…'
              : bloque
                ? 'Guardar cambios'
                : 'Agregar bloque'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

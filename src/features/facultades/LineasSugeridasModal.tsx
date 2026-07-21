import { Check, Palette, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { z } from 'zod'

import { useAppForm } from '@/components/form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EditableText } from '@/components/ui/editable-text'
import { Input } from '@/components/ui/input'
import {
  useLineasSugeridas,
  useLineasSugeridasCrud,
} from '@/data/hooks/useMeta'

type Props = {
  facultadId: string
  facultadNombre: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type LineaValues = {
  nombre: string
  area: string
  color: string
}

const nombreSchema = z
  .string()
  .trim()
  .min(1, 'El nombre de la línea es requerido.')

export default function LineasSugeridasModal({
  facultadId,
  facultadNombre,
  open,
  onOpenChange,
}: Props) {
  const { data: lineas = [], isLoading } = useLineasSugeridas(
    open ? facultadId : null,
  )
  const { create, update, archive } = useLineasSugeridasCrud(facultadId)

  // editingId: null = ningún formulario; '' = formulario de alta; uuid = edición.
  // Estado efímero de UI (qué editor está abierto), no estado del formulario.
  const [editingId, setEditingId] = useState<string | null>(null)

  const closeForm = () => setEditingId(null)

  const handleUpdateNombre = (
    linea: (typeof lineas)[number],
    nombre: string,
  ) => {
    const trimmed = nombre.trim()
    if (!trimmed || trimmed === linea.nombre) return
    update.mutate({
      id: linea.id,
      input: {
        nombre: trimmed,
        area: linea.area ?? null,
        color: linea.color ?? null,
      },
    })
  }

  const handleUpdateArea = (linea: (typeof lineas)[number], area: string) => {
    const trimmed = area.trim()
    if (trimmed === (linea.area ?? '')) return
    update.mutate({
      id: linea.id,
      input: {
        nombre: linea.nombre,
        area: trimmed || null,
        color: linea.color ?? null,
      },
    })
  }

  // Mutaciones optimistas: el editor se cierra al instante y el toast global
  // avisa (con rollback) si el servidor rechaza.
  const handleSubmit = (values: LineaValues) => {
    const payload = {
      nombre: values.nombre.trim(),
      area: values.area.trim() || null,
      color: values.color || null,
    }

    if (editingId) {
      update.mutate({ id: editingId, input: payload })
    } else {
      const maxOrden = lineas.reduce((max, l) => Math.max(max, l.orden), 0)
      create.mutate({ ...payload, orden: maxOrden + 1 })
    }
    closeForm()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Líneas curriculares sugeridas</DialogTitle>
          <DialogDescription>
            Sugerencias para <strong>{facultadNombre}</strong>. Aparecen al
            agregar una línea en planes de licenciatura de esta facultad.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {isLoading ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Cargando…
            </p>
          ) : lineas.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Aún no hay líneas sugeridas para esta facultad.
            </p>
          ) : (
            lineas.map((linea) =>
              editingId === linea.id ? (
                <LineaForm
                  key={linea.id}
                  defaultValues={{
                    nombre: linea.nombre,
                    area: linea.area ?? '',
                    color: linea.color ?? '#2563eb',
                  }}
                  onSubmit={handleSubmit}
                  onCancel={closeForm}
                />
              ) : (
                <div
                  key={linea.id}
                  className="border-input flex items-center gap-3 rounded-md border p-3"
                >
                  <span
                    className="size-4 shrink-0 rounded-full border"
                    style={{ backgroundColor: linea.color ?? 'transparent' }}
                  />
                  <div className="min-w-0 flex-1">
                    <EditableText
                      value={linea.nombre}
                      onSave={(nombre) => handleUpdateNombre(linea, nombre)}
                      editable={editingId === null}
                      maxLength={200}
                      ariaLabel="Nombre de la línea"
                      className="block truncate text-sm font-medium"
                    />
                    <EditableText
                      value={linea.area ?? ''}
                      onSave={(area) => handleUpdateArea(linea, area)}
                      editable={editingId === null}
                      placeholder="Añadir área…"
                      maxLength={200}
                      ariaLabel="Área de la línea"
                      className="text-muted-foreground block truncate text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setEditingId(linea.id)}
                    disabled={editingId !== null}
                    aria-label="Editar color y datos"
                  >
                    <Palette className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive size-8"
                    onClick={() => archive.mutate(linea.id)}
                    disabled={editingId !== null}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ),
            )
          )}

          {editingId === '' && (
            <LineaForm
              key="nueva"
              defaultValues={{ nombre: '', area: '', color: '#2563eb' }}
              onSubmit={handleSubmit}
              onCancel={closeForm}
            />
          )}
        </div>

        {editingId === null && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setEditingId('')}
          >
            <Plus className="size-4" /> Agregar línea sugerida
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Editor inline compacto (sin labels visibles, como el diseño original):
 * usa `form.AppField` con inputs propios + `aria-label` y error por campo.
 */
function LineaForm({
  defaultValues,
  onSubmit,
  onCancel,
}: {
  defaultValues: LineaValues
  onSubmit: (values: LineaValues) => void
  onCancel: () => void
}) {
  const form = useAppForm({
    defaultValues,
    onSubmit: ({ value }) => onSubmit(value),
  })

  // Enfoca el nombre al abrir el editor (ref callback estable: corre solo al
  // montarse el input, sin useEffect ni autoFocus).
  const focusOnMount = useCallback((node: HTMLInputElement | null) => {
    node?.focus()
  }, [])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      className="border-primary/40 bg-primary/5 space-y-3 rounded-md border p-3"
    >
      <div className="flex items-center gap-3">
        <form.AppField name="color">
          {(field) => (
            <Input
              type="color"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              className="h-9 w-12 shrink-0 cursor-pointer p-1"
              aria-label="Color"
            />
          )}
        </form.AppField>
        <form.AppField name="nombre" validators={{ onChange: nombreSchema }}>
          {(field) => {
            const invalid =
              field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <div className="min-w-0 flex-1">
                <Input
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Nombre de la línea (p. ej. Programación)"
                  maxLength={200}
                  aria-label="Nombre de la línea"
                  aria-invalid={invalid}
                  aria-describedby={invalid ? 'linea-nombre-error' : undefined}
                  ref={focusOnMount}
                />
                {invalid && (
                  <p
                    id="linea-nombre-error"
                    className="text-destructive mt-1 text-sm"
                  >
                    El nombre de la línea es requerido.
                  </p>
                )}
              </div>
            )
          }}
        </form.AppField>
      </div>
      <form.AppField name="area">
        {(field) => (
          <Input
            value={field.state.value}
            onChange={(event) => field.handleChange(event.target.value)}
            onBlur={field.handleBlur}
            placeholder="Área o descripción (opcional)"
            maxLength={200}
            aria-label="Área o descripción"
          />
        )}
      </form.AppField>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="size-4" /> Cancelar
        </Button>
        <form.AppForm>
          <form.SubmitButton size="sm">
            <Check className="size-4" /> Guardar
          </form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  )
}

import { Check, Palette, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { FormEvent } from 'react'

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

type FormState = {
  nombre: string
  area: string
  color: string
}

const EMPTY_FORM: FormState = { nombre: '', area: '', color: '#2563eb' }

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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const isSaving = create.isPending || update.isPending

  const startCreate = () => {
    setEditingId('')
    setForm(EMPTY_FORM)
  }

  const startEdit = (linea: (typeof lineas)[number]) => {
    setEditingId(linea.id)
    setForm({
      nombre: linea.nombre,
      area: linea.area ?? '',
      color: linea.color ?? '#2563eb',
    })
  }

  const cancelForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const nombre = form.nombre.trim()
    if (!nombre) return

    const payload = {
      nombre,
      area: form.area.trim() || null,
      color: form.color || null,
    }

    if (editingId) {
      update.mutate(
        { id: editingId, input: payload },
        { onSuccess: cancelForm },
      )
    } else {
      const maxOrden = lineas.reduce((max, l) => Math.max(max, l.orden), 0)
      create.mutate(
        { ...payload, orden: maxOrden + 1 },
        { onSuccess: cancelForm },
      )
    }
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
                  form={form}
                  setForm={setForm}
                  onSubmit={handleSubmit}
                  onCancel={cancelForm}
                  isSaving={isSaving}
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
                    onClick={() => startEdit(linea)}
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
              form={form}
              setForm={setForm}
              onSubmit={handleSubmit}
              onCancel={cancelForm}
              isSaving={isSaving}
            />
          )}
        </div>

        {editingId === null && (
          <Button type="button" variant="outline" onClick={startCreate}>
            <Plus className="size-4" /> Agregar línea sugerida
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

function LineaForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  isSaving,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onSubmit: (event: FormEvent) => void
  onCancel: () => void
  isSaving: boolean
}) {
  const nombreRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    nombreRef.current?.focus()
  }, [])

  return (
    <form
      onSubmit={onSubmit}
      className="border-primary/40 bg-primary/5 space-y-3 rounded-md border p-3"
    >
      <div className="flex items-center gap-3">
        <Input
          type="color"
          value={form.color}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, color: event.target.value }))
          }
          className="h-9 w-12 shrink-0 cursor-pointer p-1"
          aria-label="Color"
        />
        <Input
          ref={nombreRef}
          value={form.nombre}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, nombre: event.target.value }))
          }
          placeholder="Nombre de la línea (p. ej. Programación)"
          maxLength={200}
          required
        />
      </div>
      <Input
        value={form.area}
        onChange={(event) =>
          setForm((prev) => ({ ...prev, area: event.target.value }))
        }
        placeholder="Área o descripción (opcional)"
        maxLength={200}
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X className="size-4" /> Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isSaving || !form.nombre.trim()}
        >
          <Check className="size-4" /> Guardar
        </Button>
      </div>
    </form>
  )
}

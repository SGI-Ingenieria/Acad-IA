import { DragDropProvider } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import {
  Copy,
  GripVertical,
  Link,
  Link2Off,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { useState } from 'react'

import type { CampoDefinicion } from './types'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

function titleToKey(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics (é→e, ñ→n, etc.)
    .replace(/[^a-z0-9\s_]/g, '') // only letters, digits, spaces, underscores
    .trim()
    .replace(/\s+/g, '_') // spaces → underscores
    .replace(/^[0-9_]+/, '') // can't start with digit
}

function sanitizeKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^[0-9]+/, '')
}

function campoVacio(orden: number): CampoDefinicion {
  return {
    key: '',
    titulo: '',
    descripcion: '',
    tipo: 'string',
    ejemplos: [],
    referencia_normativa: '',
    x_column: '',
    requerido: false,
    orden,
  }
}

/* ── Item draggable ── */
function CampoItem({
  campo,
  idx,
  isOpen,
  onToggle,
  onUpdate,
  onRemove,
  onDuplicate,
  dirty,
  isSaving,
  onSave,
}: {
  campo: CampoDefinicion
  idx: number
  isOpen: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<CampoDefinicion>) => void
  onRemove: () => void
  onDuplicate: () => void
  dirty?: boolean
  isSaving?: boolean
  onSave?: () => void
}) {
  const { ref, handleRef, isDragSource, isDropTarget } = useSortable({
    id: campo.key || String(idx),
    index: idx,
  })

  // keyLinked=true → key auto-generates from title; false → user set a custom key
  const [keyLinked, setKeyLinked] = useState(
    !campo.key || campo.key === titleToKey(campo.titulo),
  )

  const handleTituloChange = (val: string) => {
    const patch: Partial<CampoDefinicion> = { titulo: val }
    if (keyLinked) patch.key = titleToKey(val)
    onUpdate(patch)
  }

  const handleKeyChange = (val: string) => {
    setKeyLinked(false)
    onUpdate({ key: sanitizeKey(val.toLowerCase()) })
  }

  const handleLinkToggle = () => {
    if (!keyLinked) {
      // Re-link: regenerate key from current title
      onUpdate({ key: titleToKey(campo.titulo) })
    }
    setKeyLinked((v) => !v)
  }

  const hasErrors =
    !campo.key.trim() || !campo.titulo.trim() || !campo.descripcion.trim()

  const addEjemplo = () =>
    onUpdate({ ejemplos: [...(campo.ejemplos ?? []), ''] })

  const updateEjemplo = (ejIdx: number, val: string) => {
    const ejemplos = [...(campo.ejemplos ?? [])]
    ejemplos[ejIdx] = val
    onUpdate({ ejemplos })
  }

  const removeEjemplo = (ejIdx: number) =>
    onUpdate({ ejemplos: (campo.ejemplos ?? []).filter((_, i) => i !== ejIdx) })

  return (
    <div
      ref={ref}
      className={cn(
        'transition-opacity',
        isDragSource && 'opacity-50',
        isDropTarget && 'ring-primary/30 rounded-lg ring-2',
      )}
    >
      <Card>
        <CardHeader className="py-2.5">
          <div className="flex items-center gap-2">
            {/* Handle drag */}
            <button
              ref={handleRef}
              type="button"
              className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab touch-none active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </button>

            {/* Info del campo */}
            <button
              type="button"
              onClick={onToggle}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold">
                  {campo.titulo || (
                    <span className="text-muted-foreground italic">
                      Sin título
                    </span>
                  )}
                </span>
                {campo.key && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    {campo.key}
                  </Badge>
                )}
                {campo.x_column && (
                  <Badge variant="outline" className="font-mono text-xs">
                    → {campo.x_column}
                  </Badge>
                )}
                {campo.requerido && (
                  <Badge variant="destructive" className="text-xs">
                    Requerido
                  </Badge>
                )}
                {hasErrors && (
                  <Badge className="bg-amber-100 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    Incompleto
                  </Badge>
                )}
              </div>
              {campo.descripcion && !isOpen && (
                <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                  {campo.descripcion}
                </p>
              )}
            </button>

            {/* Acciones */}
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onDuplicate}
                title="Duplicar"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive h-7 w-7"
                onClick={onRemove}
                title="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {isOpen && (
          <CardContent className="space-y-4 pt-0">
            <Separator />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">
                  Título <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={campo.titulo}
                  onChange={(e) => handleTituloChange(e.target.value)}
                  placeholder="Nombre descriptivo del campo"
                  autoFocus
                />
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">
                    Clave (key) <span className="text-destructive">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={handleLinkToggle}
                    title={
                      keyLinked ? 'Desvincular de título' : 'Vincular a título'
                    }
                    className={cn(
                      'flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors',
                      keyLinked
                        ? 'text-primary hover:text-primary/70'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {keyLinked ? (
                      <>
                        <Link className="h-3 w-3" /> Auto
                      </>
                    ) : (
                      <>
                        <Link2Off className="h-3 w-3" /> Manual
                      </>
                    )}
                  </button>
                </div>
                <Input
                  value={campo.key}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  placeholder="clave_del_campo"
                  className={cn(
                    'font-mono text-sm',
                    keyLinked && 'text-muted-foreground',
                  )}
                  readOnly={keyLinked}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">
                Descripción <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={campo.descripcion}
                onChange={(e) => onUpdate({ descripcion: e.target.value })}
                placeholder="Indica qué información se espera en este campo..."
                className="min-h-20 text-sm"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">Columna BD (x-column)</Label>
                <Input
                  value={campo.x_column ?? ''}
                  onChange={(e) =>
                    onUpdate({ x_column: e.target.value || undefined })
                  }
                  placeholder="columna_en_bd (opcional)"
                  className="font-mono text-sm"
                />
                <p className="text-muted-foreground text-xs">
                  Mapea a columna raíz en lugar de <code>datos</code>.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Referencia normativa</Label>
                <Textarea
                  value={campo.referencia_normativa ?? ''}
                  onChange={(e) =>
                    onUpdate({
                      referencia_normativa: e.target.value || undefined,
                    })
                  }
                  placeholder="Art. 8 fracción IV del Acuerdo 17/11/17..."
                  className="min-h-16 text-sm"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={campo.requerido}
                onCheckedChange={(v) => onUpdate({ requerido: !!v })}
              />
              Campo obligatorio
            </label>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  Ejemplos{' '}
                  <span className="text-muted-foreground font-normal">
                    ({(campo.ejemplos ?? []).length})
                  </span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={addEjemplo}
                >
                  <Plus className="mr-1 h-3 w-3" /> Agregar
                </Button>
              </div>
              {(campo.ejemplos ?? []).length === 0 && (
                <p className="text-muted-foreground text-xs italic">
                  Sin ejemplos.
                </p>
              )}
              {(campo.ejemplos ?? []).map((ej, ejIdx) => (
                <div key={ejIdx} className="flex items-center gap-2">
                  <Input
                    value={ej}
                    onChange={(e) => updateEjemplo(ejIdx, e.target.value)}
                    placeholder={`Ejemplo ${ejIdx + 1}`}
                    className="text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeEjemplo(ejIdx)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {dirty && onSave && (
              <>
                <Separator />
                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={onSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-3.5 w-3.5" />
                    )}
                    Guardar estructura
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}

/* ── Editor principal ── */
export function CamposEditor({
  campos,
  onChange,
  dirty,
  isSaving,
  onSave,
}: {
  campos: CampoDefinicion[]
  onChange: (campos: CampoDefinicion[]) => void
  dirty?: boolean
  isSaving?: boolean
  onSave?: () => void
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const update = (idx: number, patch: Partial<CampoDefinicion>) => {
    const next = campos.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    // Si cambió el key, actualizar también expandedKey
    if (
      patch.key !== undefined &&
      expandedKey === (campos[idx].key || String(idx))
    ) {
      setExpandedKey(patch.key || String(idx))
    }
    onChange(next)
  }

  const remove = (idx: number) => {
    const itemKey = campos[idx].key || String(idx)
    onChange(
      campos.filter((_, i) => i !== idx).map((c, i) => ({ ...c, orden: i })),
    )
    if (expandedKey === itemKey) setExpandedKey(null)
  }

  const duplicate = (idx: number) => {
    const copy: CampoDefinicion = {
      ...campos[idx],
      key: campos[idx].key + '_copia',
      orden: campos.length,
    }
    onChange([...campos, copy])
  }

  const handleDragEnd = ({ operation }: any) => {
    const { source, target } = operation
    if (!source || !target || source.id === target.id) return

    const fromIdx = campos.findIndex(
      (c, i) => (c.key || String(i)) === String(source.id),
    )
    const toIdx = campos.findIndex(
      (c, i) => (c.key || String(i)) === String(target.id),
    )
    if (fromIdx === -1 || toIdx === -1) return

    const next = [...campos]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    onChange(next.map((c, i) => ({ ...c, orden: i })))
  }

  return (
    <div className="space-y-2">
      {campos.length === 0 && (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Sin campos definidos. Agrega el primero.
        </p>
      )}

      <DragDropProvider onDragEnd={handleDragEnd}>
        {campos.map((campo, idx) => {
          const itemKey = campo.key || String(idx)
          return (
            <CampoItem
              key={itemKey}
              campo={campo}
              idx={idx}
              isOpen={expandedKey === itemKey}
              onToggle={() =>
                setExpandedKey(expandedKey === itemKey ? null : itemKey)
              }
              onUpdate={(patch) => update(idx, patch)}
              onRemove={() => remove(idx)}
              onDuplicate={() => duplicate(idx)}
              dirty={dirty && expandedKey === itemKey}
              isSaving={isSaving}
              onSave={onSave}
            />
          )
        })}
      </DragDropProvider>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => {
          const next = [...campos, campoVacio(campos.length)]
          onChange(next)
          setExpandedKey(String(next.length - 1))
        }}
      >
        <Plus className="mr-2 h-4 w-4" /> Agregar campo
      </Button>
    </div>
  )
}

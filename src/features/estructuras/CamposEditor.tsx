import { DragDropProvider } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import {
  Copy,
  GripVertical,
  Link,
  Link2Off,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useState } from 'react'

import { esLlaveReservada } from './CamposSiempreIncluidos'
import { getTipoCampo } from './types'

import type { CampoDefinicion, TipoCampo } from './types'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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

const TIPO_LABELS: Record<TipoCampo, string> = {
  string: 'Texto',
  integer: 'Numérico',
  enum: 'Opciones',
}

const TIPO_OPTIONS: Array<{ value: TipoCampo; label: string }> = [
  { value: 'string', label: 'Texto' },
  { value: 'integer', label: 'Numérico' },
  { value: 'enum', label: 'Opciones' },
]

function campoVacio(orden: number): CampoDefinicion {
  return {
    uid: crypto.randomUUID(),
    key: '',
    titulo: '',
    descripcion: '',
    tipo: 'string',
    ejemplos: [],
    referencia_normativa: '',
    requerido: false,
    orden,
  }
}

type Modo = 'plan' | 'asignatura'

/* ── Item draggable ── */
function CampoItem({
  campo,
  idx,
  modo,
  isOpen,
  onToggle,
  onUpdate,
  onRemove,
  onDuplicate,
}: {
  campo: CampoDefinicion
  idx: number
  modo: Modo
  isOpen: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<CampoDefinicion>) => void
  onRemove: () => void
  onDuplicate: () => void
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

  const isReserved = !!campo.key.trim() && esLlaveReservada(modo, campo.key)

  const hasErrors =
    !campo.key.trim() || !campo.titulo.trim() || !campo.descripcion.trim()

  const tipoCampo = getTipoCampo(campo)

  const handleTipoChange = (nuevo: TipoCampo) => {
    const patch: Partial<CampoDefinicion> = {}
    if (nuevo === 'enum') {
      patch.tipo = 'string'
      patch.enum = campo.enum ?? []
      patch.minimum = undefined
      patch.maximum = undefined
    } else if (nuevo === 'string') {
      patch.tipo = 'string'
      patch.enum = undefined
      patch.minimum = undefined
      patch.maximum = undefined
    } else {
      patch.tipo = nuevo // 'integer'
      patch.enum = undefined
    }
    onUpdate(patch)
  }

  const addOpcion = () => onUpdate({ enum: [...(campo.enum ?? []), ''] })

  const updateOpcion = (opIdx: number, val: string) => {
    const opts = [...(campo.enum ?? [])]
    opts[opIdx] = val
    onUpdate({ enum: opts })
  }

  const removeOpcion = (opIdx: number) =>
    onUpdate({ enum: (campo.enum ?? []).filter((_, i) => i !== opIdx) })

  const addEjemplo = () =>
    onUpdate({ ejemplos: [...(campo.ejemplos ?? []), ''] })

  const updateEjemplo = (ejIdx: number, val: string) => {
    const ejs = [...(campo.ejemplos ?? [])]
    ejs[ejIdx] = val
    onUpdate({ ejemplos: ejs })
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
      <Card className="overflow-hidden">
        <CardHeader className="py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {/* Handle drag */}
            <button
              ref={handleRef}
              type="button"
              className="text-muted-foreground/40 hover:text-muted-foreground shrink-0 cursor-grab touch-none active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </button>

            {/* Info del campo */}
            <button
              type="button"
              onClick={onToggle}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {campo.titulo || (
                          <span className="text-muted-foreground italic">
                            Sin título
                          </span>
                        )}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="px-3 py-2">
                      <p className="text-sm leading-relaxed font-medium tracking-wide">
                        {campo.key || 'Sin key'}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {TIPO_LABELS[tipoCampo]}
                </Badge>
                {campo.requerido && (
                  <Badge variant="destructive" className="shrink-0 text-xs">
                    Req.
                  </Badge>
                )}
                {isReserved && (
                  <Badge variant="destructive" className="shrink-0 text-xs">
                    Reservado
                  </Badge>
                )}
                {hasErrors && (
                  <Badge className="shrink-0 bg-amber-100 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
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
                  id="campo-titulo"
                  value={campo.titulo}
                  onChange={(e) => handleTituloChange(e.target.value)}
                  placeholder="Nombre descriptivo del campo"
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

            <div className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                id="campo-requerido"
                checked={campo.requerido}
                onCheckedChange={(v) => onUpdate({ requerido: !!v })}
              />
              <Label htmlFor="campo-requerido" className="text-sm">
                Campo obligatorio
              </Label>
            </div>

            <Separator />

            {/* ── Tipo de campo ── */}
            <div className="grid gap-1.5">
              <Label className="text-xs">Tipo de campo</Label>
              <div className="bg-muted inline-flex w-full rounded-lg p-1">
                {TIPO_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleTipoChange(opt.value)}
                    className={cn(
                      'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                      tipoCampo === opt.value
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Min / Max para numérico ── */}
            {tipoCampo === 'integer' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Mínimo (opcional)</Label>
                  <Input
                    type="number"
                    value={campo.minimum ?? ''}
                    onChange={(e) =>
                      onUpdate({
                        minimum:
                          e.target.value !== ''
                            ? Number(e.target.value)
                            : undefined,
                      })
                    }
                    placeholder="Sin límite inferior"
                    className="text-sm"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Máximo (opcional)</Label>
                  <Input
                    type="number"
                    value={campo.maximum ?? ''}
                    onChange={(e) =>
                      onUpdate({
                        maximum:
                          e.target.value !== ''
                            ? Number(e.target.value)
                            : undefined,
                      })
                    }
                    placeholder="Sin límite superior"
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            {/* ── Opciones para enum ── */}
            {tipoCampo === 'enum' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">
                    Opciones{' '}
                    <span className="text-muted-foreground font-normal">
                      ({(campo.enum ?? []).length})
                    </span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={addOpcion}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Agregar
                  </Button>
                </div>
                {(campo.enum ?? []).length === 0 && (
                  <p className="text-muted-foreground text-xs italic">
                    Sin opciones. Agrega al menos una.
                  </p>
                )}
                {(campo.enum ?? []).map((op, opIdx) => (
                  <div key={opIdx} className="flex items-center gap-2">
                    <Input
                      value={op}
                      onChange={(e) => updateOpcion(opIdx, e.target.value)}
                      placeholder={`Opción ${opIdx + 1}`}
                      className="text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeOpcion(opIdx)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Ejemplos (solo para texto) ── */}
            {tipoCampo === 'string' && (
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
  modo,
  onChange,
  requiresDeleteConfirmation,
}: {
  campos: Array<CampoDefinicion>
  modo: Modo
  onChange: (campos: Array<CampoDefinicion>) => void
  requiresDeleteConfirmation?: (campo: CampoDefinicion) => boolean
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<{
    campo: CampoDefinicion
    idx: number
  } | null>(null)

  const update = (idx: number, patch: Partial<CampoDefinicion>) => {
    const next = campos.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    onChange(next)
  }

  const remove = (idx: number) => {
    const stableKey = campos[idx].uid ?? (campos[idx].key || String(idx))
    onChange(
      campos.filter((_, i) => i !== idx).map((c, i) => ({ ...c, orden: i })),
    )
    if (expandedKey === stableKey) setExpandedKey(null)
  }

  const requestRemove = (idx: number) => {
    const campo = campos[idx]
    if (requiresDeleteConfirmation?.(campo)) {
      setDeleteCandidate({ campo, idx })
      return
    }
    remove(idx)
  }

  const duplicate = (idx: number) => {
    const newUid = crypto.randomUUID()
    const copy: CampoDefinicion = {
      ...campos[idx],
      uid: newUid,
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
          const stableKey = campo.uid ?? itemKey
          return (
            <CampoItem
              key={stableKey}
              campo={campo}
              idx={idx}
              modo={modo}
              isOpen={expandedKey === stableKey}
              onToggle={() =>
                setExpandedKey(expandedKey === stableKey ? null : stableKey)
              }
              onUpdate={(patch) => update(idx, patch)}
              onRemove={() => requestRemove(idx)}
              onDuplicate={() => duplicate(idx)}
            />
          )
        })}
      </DragDropProvider>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => {
          const nuevo = campoVacio(campos.length)
          onChange([...campos, nuevo])
          setExpandedKey(nuevo.uid!)
        }}
      >
        <Plus className="mr-2 h-4 w-4" /> Agregar campo
      </Button>

      <AlertDialog
        open={Boolean(deleteCandidate)}
        onOpenChange={(open) => {
          if (!open) setDeleteCandidate(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este campo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará{' '}
              <strong>{deleteCandidate?.campo.titulo || 'este campo'}</strong>{' '}
              de la estructura y también se borrará su dato en todos los{' '}
              {modo === 'plan' ? 'planes' : 'registros de asignatura'} que
              dependen de ella.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteCandidate) return
                const currentIdx = campos.findIndex(
                  (campo) => campo.uid === deleteCandidate.campo.uid,
                )
                remove(currentIdx === -1 ? deleteCandidate.idx : currentIdx)
                setDeleteCandidate(null)
              }}
            >
              Eliminar campo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

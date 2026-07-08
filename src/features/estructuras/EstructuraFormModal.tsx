import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { CamposEditor } from './CamposEditor'
import { esLlaveReservada } from './CamposSiempreIncluidos'
import { camposToDefinicion, parseCampos } from './types'

import type {
  CampoDefinicion,
  EstructuraAsignatura,
  EstructuraPlan,
  TipoEstructura,
} from './types'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  useEstructurasAsignaturaCrud,
  useEstructurasPlan,
  useEstructurasPlanCrud,
  useEstadosPlan,
} from '@/data'

type Mode = 'plan' | 'asignatura'

type Props = {
  open: boolean
  mode: Mode
  editing?: EstructuraPlan | EstructuraAsignatura | null
  onClose: () => void
  defaultTipo?: TipoEstructura
}

export function EstructuraFormModal({
  open,
  mode,
  editing,
  onClose,
  defaultTipo,
}: Props) {
  const planCrud = useEstructurasPlanCrud()
  const asigCrud = useEstructurasAsignaturaCrud()
  const { data: estructurasPlan = [] } = useEstructurasPlan()
  const { data: estadosPlan = [] } = useEstadosPlan()

  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<TipoEstructura | ''>('CURRICULAR')
  const [estructuraPlanId, setEstructuraPlanId] = useState('')
  const [campos, setCampos] = useState<Array<CampoDefinicion>>([])

  const parentPlan = useMemo(
    () => estructurasPlan.find((ep) => ep.id === estructuraPlanId),
    [estructurasPlan, estructuraPlanId],
  )

  const effectiveTipoEstructura: TipoEstructura | null = useMemo(() => {
    if (mode === 'plan') return tipo || null
    const editingAsig = editing as EstructuraAsignatura | undefined
    return parentPlan?.tipo ?? editingAsig?.tipo ?? null
  }, [mode, tipo, editing, parentPlan])

  useEffect(() => {
    if (open) {
      setNombre(editing?.nombre ?? '')
      const editingPlan =
        editing && mode === 'plan' ? (editing as EstructuraPlan) : null
      setTipo(
        editingPlan
          ? editingPlan.tipo
          : mode === 'plan'
            ? (defaultTipo ?? 'CURRICULAR')
            : '',
      )
      setEstructuraPlanId(
        editing && mode === 'asignatura'
          ? (editing as EstructuraAsignatura).estructura_plan_id
          : (estructurasPlan[0]?.id ?? ''),
      )
      setCampos(parseCampos(editing ? editing.definicion : undefined))
    }
  }, [open, editing, mode, estructurasPlan, defaultTipo])

  const isPending =
    planCrud.create.isPending ||
    planCrud.update.isPending ||
    asigCrud.create.isPending ||
    asigCrud.update.isPending

  const canSave =
    nombre.trim().length > 0 && (mode === 'plan' || Boolean(estructuraPlanId))

  const handleSave = async () => {
    const reservadas = campos.filter((c) => esLlaveReservada(mode, c.key))
    if (reservadas.length > 0) {
      toast.error(
        `La llave "${reservadas[0].key}" ya es un campo siempre incluido. Quítala o renómbrala.`,
      )
      return
    }

    const definicion = camposToDefinicion(campos)

    try {
      if (editing) {
        if (mode === 'plan') {
          await planCrud.update.mutateAsync({
            id: editing.id,
            input: { nombre, tipo: tipo as TipoEstructura, definicion },
          })
        } else {
          await asigCrud.update.mutateAsync({
            id: editing.id,
            input: {
              nombre,
              tipo: effectiveTipoEstructura,
              definicion,
              estructura_plan_id: estructuraPlanId,
            },
          })
        }
        toast.success('Estructura actualizada')
      } else {
        if (mode === 'plan') {
          await planCrud.create.mutateAsync({
            nombre,
            tipo: tipo as TipoEstructura,
            definicion,
          })
        } else {
          await asigCrud.create.mutateAsync({
            nombre,
            tipo: effectiveTipoEstructura,
            definicion,
            estructura_plan_id: estructuraPlanId,
          })
        }
        toast.success('Estructura creada')
      }
      onClose()
    } catch {
      toast.error('No se pudo guardar la estructura')
    }
  }

  const title = editing
    ? `Editar ${mode === 'plan' ? 'plantilla de plan' : 'plantilla de materia'}`
    : `Nueva ${mode === 'plan' ? 'plantilla de plan' : 'plantilla de materia'}`

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Nombre</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Plan de Ingeniería en Sistemas"
              />
            </div>

            {mode === 'plan' && (
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select
                  value={tipo}
                  onValueChange={(v) => setTipo(v as TipoEstructura)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CURRICULAR">Curricular</SelectItem>
                    <SelectItem value="NO_CURRICULAR">No Curricular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {mode === 'asignatura' && (
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Estructura de plan</Label>
                <Select
                  value={estructuraPlanId}
                  onValueChange={setEstructuraPlanId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una estructura de plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {estructurasPlan.map((estructura) => (
                      <SelectItem key={estructura.id} value={estructura.id}>
                        {estructura.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-semibold">Campos de la estructura</p>
            <CamposEditor
              campos={campos}
              modo={mode}
              onChange={setCampos}
              estadosPlan={estadosPlan}
              tipoEstructura={effectiveTipoEstructura}
            />
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button onClick={handleSave} disabled={!canSave || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? 'Guardar cambios' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

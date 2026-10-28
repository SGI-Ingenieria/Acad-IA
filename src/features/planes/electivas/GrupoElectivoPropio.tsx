import { Loader2, Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import type {
  GrupoElectivoPlan,
  OperacionGrupoElectivo,
} from '@/data/api/gruposElectivos.api'
import type { Asignatura } from '@/data/types/domain'

import { showAppPrompt } from '@/components/ui/app-alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type Accion = (
  grupo: GrupoElectivoPlan,
  operacion: OperacionGrupoElectivo['operacion'],
  datos?: OperacionGrupoElectivo['datos'],
) => Promise<void>

export function GrupoElectivoPropio({
  grupo,
  grupos,
  asignaturas,
  editable,
  pendiente,
  atenuado,
  registrar,
  onHover,
  onArrastrar,
  onFinArrastre,
  onSoltarAsignatura,
  ejecutar,
  onAbrirAsignatura,
}: {
  grupo: GrupoElectivoPlan
  grupos: Array<GrupoElectivoPlan>
  asignaturas: Array<Asignatura>
  editable: boolean
  pendiente: boolean
  atenuado: boolean
  registrar: (elemento: HTMLButtonElement | null) => void
  onHover: (activo: boolean) => void
  onArrastrar: (e: React.DragEvent) => void
  onFinArrastre: () => void
  onSoltarAsignatura: (e: React.DragEvent) => void
  ejecutar: Accion
  onAbrirAsignatura: (id: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const miembros = asignaturas.filter((a) => a.grupo_electivo_id === grupo.id)
  const disponibles = asignaturas.filter(
    (a) =>
      a.grupo_electivo_id !== grupo.id &&
      !a.area_comun_origen_id &&
      !['archivada', 'generando', 'fallida'].includes(a.estado),
  )
  const previo = grupos.find((g) => g.id === grupo.prerrequisito_grupo_id)
  const ejecutarSeguro = (
    operacion: OperacionGrupoElectivo['operacion'],
    datos?: OperacionGrupoElectivo['datos'],
  ) => {
    void ejecutar(grupo, operacion, datos).catch(() => undefined)
  }
  return (
    <>
      <section
        aria-label={grupo.nombre}
        onDragOver={(e) => {
          if (editable && !pendiente) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        onDrop={onSoltarAsignatura}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              ref={registrar}
              variant="outline"
              draggable={editable && !pendiente}
              onDragStart={onArrastrar}
              onDragEnd={onFinArrastre}
              onMouseEnter={() => onHover(true)}
              onMouseLeave={() => onHover(false)}
              onFocus={() => onHover(true)}
              onBlur={() => onHover(false)}
              onClick={() => setAbierto(true)}
              aria-label={`Abrir ${grupo.nombre}`}
              className={cn(
                'organic-interactive bg-card border-primary/35 p-grupo flex h-44 min-h-44 w-40 min-w-40 shrink-0 flex-col justify-between rounded-xl text-center whitespace-normal',
                atenuado && 'opacity-25',
              )}
            >
              <span className="text-muted-foreground text-xs">
                C{grupo.numero_ciclo}
              </span>
              <span className="line-clamp-3 font-semibold">{grupo.nombre}</span>
              <span className="text-muted-foreground text-xs">
                {pendiente ? (
                  <Loader2
                    className="size-4 animate-spin"
                    aria-label="Guardando bloque"
                  />
                ) : miembros.length ? (
                  `${miembros.length} alternativas · ${miembros[0].creditos} CR`
                ) : (
                  'Arrastra asignaturas'
                )}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            C{grupo.numero_ciclo} · {grupo.nombre}
          </TooltipContent>
        </Tooltip>
      </section>
      <Dialog modal={false} open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{grupo.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-grupo">
            <div className="space-y-control">
              <Label htmlFor={`antecedente-${grupo.id}`}>
                Bloque antecedente
              </Label>
              {editable ? (
                <Select
                  value={grupo.prerrequisito_grupo_id ?? 'ninguno'}
                  disabled={pendiente}
                  onValueChange={(id) =>
                    ejecutarSeguro('editar', {
                      prerrequisito_grupo_id: id === 'ninguno' ? null : id,
                    })
                  }
                >
                  <SelectTrigger id={`antecedente-${grupo.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguno">Sin seriación</SelectItem>
                    {grupos
                      .filter(
                        (g) =>
                          g.id !== grupo.id &&
                          g.numero_ciclo < grupo.numero_ciclo,
                      )
                      .map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.nombre}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">{previo?.nombre ?? 'Sin seriación'}</p>
              )}
            </div>
            {editable && (
              <Select
                value=""
                disabled={pendiente || !disponibles.length}
                onValueChange={(id) =>
                  ejecutarSeguro('incorporar', { asignatura_id: id })
                }
              >
                <SelectTrigger aria-label="Agregar asignatura al bloque">
                  <SelectValue placeholder="Agregar asignatura" />
                </SelectTrigger>
                <SelectContent>
                  {disponibles.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.codigo} · {a.nombre} · {a.creditos} CR (
                      {a.horas_academicas ?? 0} HD +{' '}
                      {a.horas_independientes ?? 0} HI)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <ul className="space-y-control max-h-72 overflow-y-auto">
              {miembros.map((a) => (
                <li
                  key={a.id}
                  className="gap-control flex items-center"
                  draggable={editable && !pendiente}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', a.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                >
                  <Button
                    variant="ghost"
                    className="h-auto min-w-0 flex-1 justify-start text-left whitespace-normal"
                    onClick={() => {
                      setAbierto(false)
                      onAbrirAsignatura(a.id)
                    }}
                  >
                    {a.codigo} · {a.nombre}
                  </Button>
                  {editable && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={pendiente}
                          aria-label={`Retirar ${a.nombre} del bloque`}
                          onClick={() =>
                            ejecutarSeguro('retirar', { asignatura_id: a.id })
                          }
                        >
                          <X className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Retirar del bloque</TooltipContent>
                    </Tooltip>
                  )}
                  {editable && grupos.length > 1 && (
                    <Select
                      value={grupo.id}
                      disabled={pendiente}
                      onValueChange={(id) => {
                        const destino = grupos.find((g) => g.id === id)
                        if (destino)
                          void ejecutar(destino, 'incorporar', {
                            asignatura_id: a.id,
                          }).catch(() => undefined)
                      }}
                    >
                      <SelectTrigger
                        className="w-32"
                        aria-label={`Mover ${a.nombre} a otro bloque`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {grupos.map((g) => (
                          <SelectItem value={g.id} key={g.id}>
                            {g.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </li>
              ))}
            </ul>
            {editable && (
              <div className="gap-control flex justify-end">
                <Button
                  variant="ghost"
                  disabled={pendiente}
                  onClick={() => {
                    void showAppPrompt({
                      title: 'Renombrar bloque electivo',
                      label: 'Nombre',
                      initialValue: grupo.nombre,
                      required: true,
                    }).then((nombre) => {
                      if (nombre) ejecutarSeguro('editar', { nombre })
                    })
                  }}
                >
                  <Pencil className="size-4" />
                  Renombrar
                </Button>
                <Button
                  variant="destructive"
                  disabled={pendiente}
                  onClick={() => ejecutarSeguro('eliminar')}
                >
                  <Trash2 className="size-4" />
                  Eliminar bloque
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

import { Link } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowUp,
  Edit3,
  Focus,
  Map,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { BloqueFormDialog } from './BloqueFormDialog'
import { BloquesEnfoque } from './BloquesEnfoque'

import type { BloqueFormValue } from './BloqueFormDialog'
import type { LineaPlan } from '@/data'
import type { ComponentProps } from 'react'

import { showAppConfirm } from '@/components/ui/app-alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  useCreateLinea,
  useDeleteLinea,
  useLineasSugeridas,
  usePlan,
  usePlanAsignaturas,
  usePlanLineas,
  useReorderLineas,
  useUpdateLinea,
  useUpdatePlanDesignPhase,
} from '@/data'
import {
  requestAdminOverrideReason,
  usePlanCapabilities,
} from '@/data/auth/planCapabilities'
import { BarraVistaCurricular } from '@/features/planes/curriculo/BarraVistaCurricular'
import { descripcionBloque } from '@/lib/bloques-conocimiento'
import {
  colorLineaCurricular,
  siguienteColorLineaCurricular,
} from '@/lib/linea-curricular-colors'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'

function AccionIcono({
  label,
  children,
  ...props
}: ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function BloquesConocimientoPage({ planId }: { planId: string }) {
  const { data: plan } = usePlan(planId)
  const {
    data: bloques = [],
    isLoading: loadingBloques,
    isError: errorBloques,
    refetch: recargarBloques,
  } = usePlanLineas(planId)
  const {
    data: asignaturas = [],
    isLoading: loadingAsignaturas,
    isError: errorAsignaturas,
    refetch: recargarAsignaturas,
  } = usePlanAsignaturas(planId)
  const capabilities = usePlanCapabilities(plan)
  const canEdit = capabilities.canEditPlan
  const facultadId = plan?.carreras?.facultad_id ?? null
  const { data: sugerencias = [] } = useLineasSugeridas(facultadId)
  const crear = useCreateLinea()
  const actualizar = useUpdateLinea()
  const reordenar = useReorderLineas()
  const eliminar = useDeleteLinea()
  const actualizarFase = useUpdatePlanDesignPhase()
  const [editorOpen, setEditorOpen] = useState(false)
  const [bloqueEditando, setBloqueEditando] = useState<LineaPlan | null>(null)
  const [enfoqueOpen, setEnfoqueOpen] = useState(false)

  const bloquesOrdenados = useMemo(
    () => [...bloques].sort((a, b) => a.orden - b.orden),
    [bloques],
  )
  const coloresUsados = useMemo(
    () => bloquesOrdenados.map((bloque) => bloque.color),
    [bloquesOrdenados],
  )
  const colorInicial = useMemo(
    () => siguienteColorLineaCurricular(coloresUsados),
    [coloresUsados],
  )

  const pedirOverride = async (accion: string) => {
    if (!capabilities.requiresAdminOverrideForEdit) return null
    return requestAdminOverrideReason(`${accion} fuera de la etapa normal`)
  }

  const abrirNuevo = () => {
    setBloqueEditando(null)
    setEditorOpen(true)
  }

  const abrirEdicion = (bloque: LineaPlan) => {
    setBloqueEditando(bloque)
    setEditorOpen(true)
  }

  const guardar = async (value: BloqueFormValue) => {
    if (!canEdit) return
    const nombreNormalizado = value.nombre.toLocaleLowerCase('es-MX')
    const duplicado = bloquesOrdenados.some(
      (bloque) =>
        bloque.id !== bloqueEditando?.id &&
        bloque.nombre.trim().toLocaleLowerCase('es-MX') === nombreNormalizado,
    )
    if (duplicado) {
      notify.error('Ya existe un bloque con ese nombre.')
      return
    }

    const adminOverrideReason = await pedirOverride(
      bloqueEditando ? 'editar un bloque de conocimiento' : 'agregar un bloque',
    )
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason) {
      return
    }

    try {
      if (bloqueEditando) {
        await actualizar.mutateAsync({
          lineaId: bloqueEditando.id,
          planId,
          patch: {
            nombre: value.nombre,
            color: value.color,
            area: value.area,
            proposito: value.descripcion || null,
            aporte_perfil_egreso: null,
            alcance_formativo: null,
            adminOverrideReason,
          },
        })
      } else {
        await crear.mutateAsync({
          nombre: value.nombre,
          plan_estudio_id: planId,
          orden:
            bloquesOrdenados.reduce(
              (maximo, bloque) => Math.max(maximo, bloque.orden),
              0,
            ) + 1,
          area: value.area ?? undefined,
          color: value.color,
          proposito: value.descripcion || null,
          aporte_perfil_egreso: null,
          alcance_formativo: null,
          adminOverrideReason,
        })

        if (plan?.fase_diseno === 'FUNDAMENTOS') {
          actualizarFase.mutate({ planId, fase: 'BLOQUES' })
        }
      }
    } catch {
      return
    }

    setEditorOpen(false)
  }

  const mover = async (bloque: LineaPlan, desplazamiento: -1 | 1) => {
    const indice = bloquesOrdenados.findIndex((item) => item.id === bloque.id)
    const indiceVecino = indice + desplazamiento
    if (
      !canEdit ||
      indiceVecino < 0 ||
      indiceVecino >= bloquesOrdenados.length
    ) {
      return
    }
    const vecino = bloquesOrdenados[indiceVecino]

    const adminOverrideReason = await pedirOverride(
      'reordenar los bloques de conocimiento',
    )
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason) {
      return
    }

    try {
      await reordenar.mutateAsync({
        planId,
        updates: [
          { lineaId: bloque.id, orden: vecino.orden },
          { lineaId: vecino.id, orden: bloque.orden },
        ],
        adminOverrideReason,
      })
    } catch {
      return
    }
  }

  const borrar = async (bloque: LineaPlan) => {
    if (!canEdit) return
    const afectadas = asignaturas.filter(
      (asignatura) => asignatura.linea_plan_id === bloque.id,
    ).length
    const confirmed = await showAppConfirm({
      title: `Eliminar “${bloque.nombre}”`,
      description:
        afectadas > 0
          ? `${afectadas} ${afectadas === 1 ? 'asignatura regresará' : 'asignaturas regresarán'} a pendientes. Ninguna asignatura se eliminará.`
          : 'El bloque se quitará del plan. Esta acción no puede deshacerse.',
      variant: 'destructive',
      confirmLabel: 'Eliminar bloque',
    })
    if (!confirmed) return

    const adminOverrideReason = await pedirOverride(
      'eliminar un bloque de conocimiento',
    )
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason) {
      return
    }

    try {
      await eliminar.mutateAsync({
        lineaId: bloque.id,
        planId,
        adminOverrideReason,
      })
    } catch {
      return
    }
  }

  if (loadingBloques || loadingAsignaturas) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="size-9" />
          <Skeleton className="size-9" />
        </div>
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} className="h-36 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (errorBloques || errorAsignaturas) {
    return (
      <div className="border-border flex min-h-72 flex-col items-center justify-center border-y px-6 py-14 text-center">
        <p className="max-w-xl text-lg font-semibold">
          No pudimos cargar la estructura curricular
        </p>
        <p className="text-muted-foreground mt-2 max-w-xl text-sm">
          Tus bloques siguen guardados. Vuelve a intentar para recuperar esta
          vista.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => {
            void Promise.all([recargarBloques(), recargarAsignaturas()])
          }}
        >
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <section className="space-y-6" data-guia="bloques-conocimiento">
      <h2 className="sr-only">Bloques de conocimiento</h2>

      <BarraVistaCurricular>
        {canEdit && (
          <Button data-guia="agregar-bloque" onClick={abrirNuevo}>
            <Plus />
            Agregar bloque
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              asChild
              variant="outline"
              size="icon"
              data-guia="alternar-vista-curricular"
              aria-label="Ver mapa curricular"
            >
              <Link
                to="/planes/$planId/mapa"
                params={{ planId }}
                resetScroll={false}
                viewTransition
              >
                <Map />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ver mapa curricular</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              aria-label="Enfocar bloques de conocimiento"
              onClick={() => setEnfoqueOpen(true)}
            >
              <Focus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Enfocar bloques de conocimiento</TooltipContent>
        </Tooltip>
      </BarraVistaCurricular>

      {bloquesOrdenados.length === 0 ? (
        <div className="border-border flex min-h-72 flex-col items-center justify-center border-y px-6 py-14 text-center">
          <p className="max-w-xl text-lg font-semibold">
            Convierte los fundamentos en cuerpos de conocimiento
          </p>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
            Cada bloque organiza aquello que el estudiante necesita aprender
            para alcanzar el perfil de egreso. Ordénalos de lo básico a lo
            especializado; después podrás distribuir las asignaturas en el mapa
            curricular.
          </p>
          {canEdit && (
            <Button className="mt-6" onClick={abrirNuevo}>
              <Plus />
              Crear el primer bloque
            </Button>
          )}
        </div>
      ) : (
        <ol className="divide-border divide-y">
          {bloquesOrdenados.map((bloque, index) => {
            const color = colorLineaCurricular(bloque, index)
            const descripcion = descripcionBloque(bloque)
            const creditos = asignaturas
              .filter((asignatura) => asignatura.linea_plan_id === bloque.id)
              .reduce(
                (total, asignatura) => total + (asignatura.creditos ?? 0),
                0,
              )

            return (
              <li
                key={bloque.id}
                className="group relative overflow-hidden px-5 py-7 sm:px-7"
                style={{
                  backgroundColor: `color-mix(in oklab, ${color} 7%, var(--card))`,
                }}
              >
                <span
                  className="absolute inset-y-5 left-0 w-1 rounded-r-full"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <div
                  className={cn(
                    'flex items-start gap-5',
                    canEdit ? 'sm:pr-60' : 'sm:pr-24',
                  )}
                >
                  <span className="text-muted-foreground/70 hidden pt-1 text-sm font-semibold tabular-nums sm:block">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-2xl leading-tight font-semibold tracking-tight text-balance lg:text-3xl">
                      {bloque.nombre}
                    </h3>
                    <p
                      className={cn(
                        'mt-3 max-w-4xl text-sm leading-relaxed',
                        descripcion
                          ? 'text-muted-foreground line-clamp-2'
                          : 'text-muted-foreground/70 italic',
                      )}
                    >
                      {descripcion || 'Todavía sin describir.'}
                    </p>
                  </div>

                  <p
                    className="ml-auto flex shrink-0 items-baseline justify-end gap-1 tabular-nums sm:hidden"
                    aria-label={`${creditos.toFixed(
                      creditos % 1 === 0 ? 0 : 2,
                    )} créditos`}
                  >
                    <span className="text-xl leading-none font-semibold">
                      {creditos.toFixed(creditos % 1 === 0 ? 0 : 2)}
                    </span>
                    <span
                      className="text-xs font-bold tracking-wide uppercase"
                      style={{ color }}
                      aria-hidden
                    >
                      CR
                    </span>
                  </p>

                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="sm:hidden"
                          aria-label={`Acciones para ${bloque.nombre}`}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => abrirEdicion(bloque)}>
                          <Edit3 />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={index === 0 || reordenar.isPending}
                          onSelect={() => void mover(bloque, -1)}
                        >
                          <ArrowUp />
                          Subir
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={
                            index === bloquesOrdenados.length - 1 ||
                            reordenar.isPending
                          }
                          onSelect={() => void mover(bloque, 1)}
                        >
                          <ArrowDown />
                          Bajar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => void borrar(bloque)}
                        >
                          <Trash2 />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <div className="pointer-events-none absolute top-1/2 right-7 hidden h-9 w-56 -translate-y-1/2 sm:block">
                  {canEdit && (
                    <div className="absolute top-1/2 right-0 flex w-36 -translate-y-1/2 translate-x-3 items-center justify-end gap-0.5 opacity-0 transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:translate-x-0 motion-reduce:transition-none">
                      <AccionIcono
                        label={`Editar ${bloque.nombre}`}
                        onClick={() => abrirEdicion(bloque)}
                      >
                        <Edit3 />
                      </AccionIcono>
                      <AccionIcono
                        label={`Subir ${bloque.nombre}`}
                        disabled={index === 0 || reordenar.isPending}
                        onClick={() => void mover(bloque, -1)}
                      >
                        <ArrowUp />
                      </AccionIcono>
                      <AccionIcono
                        label={`Bajar ${bloque.nombre}`}
                        disabled={
                          index === bloquesOrdenados.length - 1 ||
                          reordenar.isPending
                        }
                        onClick={() => void mover(bloque, 1)}
                      >
                        <ArrowDown />
                      </AccionIcono>
                      <AccionIcono
                        label={`Eliminar ${bloque.nombre}`}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => void borrar(bloque)}
                      >
                        <Trash2 />
                      </AccionIcono>
                    </div>
                  )}

                  <p
                    className={cn(
                      'absolute top-1/2 right-0 flex w-16 -translate-y-1/2 items-baseline justify-end gap-1 tabular-nums transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                      canEdit &&
                        'group-focus-within:-translate-x-40 group-hover:-translate-x-40',
                    )}
                    aria-label={`${creditos.toFixed(
                      creditos % 1 === 0 ? 0 : 2,
                    )} créditos`}
                  >
                    <span className="text-2xl leading-none font-semibold">
                      {creditos.toFixed(creditos % 1 === 0 ? 0 : 2)}
                    </span>
                    <span
                      className="text-xs font-bold tracking-wide uppercase"
                      style={{ color }}
                      aria-hidden
                    >
                      CR
                    </span>
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <BloqueFormDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        bloque={bloqueEditando}
        colorInicial={colorInicial}
        sugerencias={sugerencias.filter(
          (sugerencia) =>
            !bloquesOrdenados.some(
              (bloque) =>
                bloque.nombre.trim().toLocaleLowerCase('es-MX') ===
                sugerencia.nombre.trim().toLocaleLowerCase('es-MX'),
            ),
        )}
        sugerirAreaComun={
          plan?.carreras?.nivel === 'Licenciatura' &&
          !bloquesOrdenados.some(
            (bloque) =>
              bloque.nombre.trim().toLocaleLowerCase('es-MX') === 'área común',
          )
        }
        coloresUsados={coloresUsados}
        isPending={crear.isPending || actualizar.isPending}
        onSubmit={guardar}
      />

      <BloquesEnfoque
        open={enfoqueOpen}
        onOpenChange={setEnfoqueOpen}
        bloques={bloquesOrdenados}
      />
    </section>
  )
}

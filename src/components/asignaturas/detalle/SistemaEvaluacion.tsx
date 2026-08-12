import { useParams } from '@tanstack/react-router'
import {
  CheckCircle2,
  ClipboardList,
  Minus,
  Pencil,
  Plus,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import type {
  PayloadMejorarCampo,
  PayloadProponerEvaluacion,
  ResultadoMejorarCampo,
  ResultadoProponerEvaluacion,
} from '@/data'
import type { OpcionesAccionAgente } from '@/features/agente'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { usePlan } from '@/data'
import {
  requestAdminOverrideReason,
  useAsignaturaCapabilities,
} from '@/data/auth/planCapabilities'
import { useSubject, useUpdateAsignatura } from '@/data/hooks/useSubjects'
import {
  AccionAgente,
  idCampoAgente,
  useAccionAgente,
  useColoresLineas,
} from '@/features/agente'
import { cn } from '@/lib/utils'

type CriterioEvaluacion = {
  criterio: string
  porcentaje: number
}

type CriterioDraft = {
  id: string
  criterio: string
  porcentaje: string // permite vacío mientras se edita
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Normaliza el JSON de la BD a filas válidas (criterio no vacío, 1–100). */
function parseCriterios(raw: unknown): Array<CriterioEvaluacion> {
  if (!Array.isArray(raw)) return []

  const rows: Array<CriterioEvaluacion> = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const criterio = typeof item.criterio === 'string' ? item.criterio : ''
    const porcentajeNum =
      typeof item.porcentaje === 'number'
        ? item.porcentaje
        : typeof item.porcentaje === 'string'
          ? Number(item.porcentaje)
          : NaN

    if (!criterio.trim()) continue
    if (!Number.isFinite(porcentajeNum)) continue
    const porcentaje = Math.trunc(porcentajeNum)
    if (porcentaje < 1 || porcentaje > 100) continue

    rows.push({ criterio: criterio.trim(), porcentaje })
  }

  return rows
}

/**
 * Rampa monocroma derivada de `--primary`: cada criterio recibe un tono de la
 * misma familia con la luminosidad escalonada, de modo que la distribución se
 * lee de un vistazo sin introducir colores ajenos a la paleta de la página.
 */
function segmentColor(index: number): string {
  const step = index % 6
  return `oklch(from var(--primary) calc(l - ${step * 0.07}) calc(c - ${step * 0.02}) h)`
}

export function SistemaEvaluacion() {
  const { asignaturaId, planId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })
  const { data, isLoading } = useSubject(asignaturaId)
  const { data: plan } = usePlan(planId)
  const capabilities = useAsignaturaCapabilities(plan, asignaturaId)
  const canEdit = capabilities.canEditAsignaturas
  const updateAsignatura = useUpdateAsignatura()

  const criterios = useMemo(
    () => parseCriterios((data as any)?.criterios_de_evaluacion),
    [data],
  )

  const [isEditing, setIsEditing] = useState(false)
  const [rows, setRows] = useState<Array<CriterioDraft>>([])

  const totalGuardado = criterios.reduce((acc, c) => acc + c.porcentaje, 0)
  const totalBorrador = rows.reduce((acc, r) => {
    const n = Number(String(r.porcentaje).trim())
    if (!Number.isFinite(n)) return acc
    const porcentaje = Math.trunc(n)
    if (porcentaje < 1 || porcentaje > 100) return acc
    return acc + porcentaje
  }, 0)

  const startEditing = () => {
    setRows(
      criterios.length > 0
        ? criterios.map((c) => ({
            id: crypto.randomUUID(),
            criterio: c.criterio,
            porcentaje: String(c.porcentaje),
          }))
        : [{ id: crypto.randomUUID(), criterio: '', porcentaje: '' }],
    )
    setIsEditing(true)
  }

  const handleSave = async () => {
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'editar una asignatura fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return

    const cleaned: Array<CriterioEvaluacion> = []
    for (const r of rows) {
      const criterio = r.criterio.trim()
      const porcentajeStr = String(r.porcentaje).trim()
      if (!criterio || !porcentajeStr) continue

      const n = Number(porcentajeStr)
      if (!Number.isFinite(n)) continue
      const porcentaje = Math.trunc(n)
      if (porcentaje < 1 || porcentaje > 100) continue

      cleaned.push({ criterio, porcentaje })
    }

    setIsEditing(false)
    // La mutación optimista refresca la query al instante y hace rollback con
    // toast global en español si el servidor rechaza.
    updateAsignatura.mutate({
      asignaturaId,
      patch: { criterios_de_evaluacion: cleaned } as any,
      adminOverrideReason,
    })
  }

  // ── Modo agente ────────────────────────────────────────────────────────────

  const puedeAgentar = canEdit && capabilities.canUseIA
  const colores = useColoresLineas(planId)

  /**
   * Escritura que espera al servidor. El editor manual usa `mutate` porque le
   * basta con cerrarse al instante; el agente necesita saber cuándo aterrizó el
   * cambio —y si el usuario canceló el override— para no registrar en la pila de
   * deshacer algo que nunca ocurrió.
   */
  const guardarCriterios = async (siguientes: Array<CriterioEvaluacion>) => {
    const adminOverrideReason = capabilities.requiresAdminOverrideForEdit
      ? await requestAdminOverrideReason(
          'editar una asignatura fuera de la etapa normal del plan',
        )
      : null
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason) {
      throw new Error(
        'Hace falta un motivo para editar fuera de la etapa normal del plan.',
      )
    }

    await updateAsignatura.mutateAsync({
      asignaturaId,
      patch: { criterios_de_evaluacion: siguientes } as any,
      adminOverrideReason,
    })
  }

  const renombrarCriterio = async (index: number, nombre: string) => {
    const limpio = nombre.trim()
    if (!limpio) return
    await guardarCriterios(
      criterios.map((c, i) => (i === index ? { ...c, criterio: limpio } : c)),
    )
  }

  /**
   * Un único disparador para todos los porcentajes. Comparten instancia del hook
   * —y por tanto id, halo y estado de ejecución— porque los porcentajes tienen
   * que sumar 100: tocar uno solo produciría un sistema inválido. Que los seis se
   * pongan en `Skeleton` a la vez es justamente la señal de que se reescriben en
   * bloque.
   */
  const agenteEvaluacion = useAccionAgente<
    ResultadoProponerEvaluacion,
    Array<CriterioEvaluacion>
  >({
    id: `evaluacion:${asignaturaId}`,
    accion: 'proponer_evaluacion',
    etiqueta: 'Proponer el sistema de evaluación',
    ariaLabel: 'Ajustar todos los porcentajes con IA',
    modo: 'boton',
    disabled: !puedeAgentar,
    colores,
    payload: () =>
      ({
        asignatura_id: asignaturaId,
        asignatura_nombre: data?.nombre ?? '',
        criterios,
      }) satisfies PayloadProponerEvaluacion,
    snapshot: () => criterios,
    aplicar: (resultado) => guardarCriterios(resultado.criterios),
    restaurar: (previos) => guardarCriterios(previos),
  })

  /** El nombre de un criterio sí se puede ajustar solo: no toca los porcentajes. */
  const opcionesCriterio = (
    c: CriterioEvaluacion,
    index: number,
  ): OpcionesAccionAgente<ResultadoMejorarCampo, string> => ({
    id: idCampoAgente('asignatura', asignaturaId, `criterio.${index}`),
    accion: 'mejorar_campo',
    etiqueta: `Ajustar «${c.criterio}»`,
    ariaLabel: `Ajustar el criterio ${c.criterio} con IA`,
    modo: 'boton',
    disabled: !puedeAgentar,
    colores,
    payload: () =>
      ({
        entidad: 'asignatura',
        entidad_id: asignaturaId,
        clave: `criterios_de_evaluacion.${index}.criterio`,
        label: `Criterio de evaluación ${index + 1}`,
        ayuda:
          'Nombre de un criterio del sistema de evaluación. Su porcentaje no cambia.',
        contenido_actual: c.criterio,
        es_richtext: false,
      }) satisfies PayloadMejorarCampo,
    snapshot: () => c.criterio,
    aplicar: (resultado) => renombrarCriterio(index, resultado.contenido),
    restaurar: (previo) => renombrarCriterio(index, previo),
  })

  if (isLoading) {
    return (
      <div className="space-y-grupo mx-auto max-w-3xl">
        <Skeleton className="h-4 w-full rounded-full" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div
      className="mx-auto max-w-3xl"
      data-comment-scope="subject-field"
      data-comment-key="evaluation"
    >
      {isEditing ? (
        <div className="space-y-grupo">
          <div className="space-y-relacionado">
            {rows.map((row, index) => (
              <div
                key={row.id}
                className="gap-relacionado grid grid-cols-[minmax(0,1fr)_5.5rem_2rem] items-center"
              >
                <Input
                  value={row.criterio}
                  placeholder="Criterio (p. ej. Examen parcial)"
                  aria-label={`Criterio ${index + 1}`}
                  maxLength={200}
                  onChange={(e) => {
                    const nextCriterio = e.target.value
                    setRows((prev) =>
                      prev.map((r) =>
                        r.id === row.id ? { ...r, criterio: nextCriterio } : r,
                      ),
                    )
                  }}
                />
                <div className="relative">
                  <Input
                    value={row.porcentaje}
                    placeholder="0"
                    inputMode="numeric"
                    aria-label={`Porcentaje del criterio ${index + 1}`}
                    className="pr-region text-right tabular-nums"
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw !== '' && !/^\d{1,3}$/.test(raw)) return
                      setRows((prev) => {
                        const next = prev.map((r) =>
                          r.id === row.id ? { ...r, porcentaje: raw } : r,
                        )
                        const total = next.reduce(
                          (acc, r) => acc + (Number(r.porcentaje) || 0),
                          0,
                        )
                        return total > 100 ? prev : next
                      })
                    }}
                  />
                  <span
                    className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm"
                    aria-hidden
                  >
                    %
                  </span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                      aria-label={`Quitar criterio ${row.criterio || index + 1}`}
                      onClick={() =>
                        setRows((prev) => prev.filter((r) => r.id !== row.id))
                      }
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Quitar criterio</TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="text-primary hover:bg-primary/10"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                { id: crypto.randomUUID(), criterio: '', porcentaje: '' },
              ])
            }
          >
            <Plus className="h-4 w-4" /> Agregar criterio
          </Button>

          <div className="gap-grupo pt-grupo flex items-center justify-between border-t">
            <TotalIndicator total={totalBorrador} />
            <div className="gap-relacionado flex">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => void handleSave()}
                disabled={totalBorrador > 100 || updateAsignatura.isPending}
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      ) : criterios.length === 0 ? (
        <div className="gap-grupo py-exhibicion flex flex-col items-center text-center">
          <ClipboardList
            className="text-muted-foreground/40 h-10 w-10"
            aria-hidden
          />
          <div className="space-y-micro">
            <p className="text-foreground text-sm font-semibold">
              Esta asignatura aún no define su sistema de evaluación
            </p>
            <p className="text-muted-foreground mx-auto max-w-sm text-sm">
              Los criterios y sus porcentajes deben sumar 100% para que el
              documento oficial quede completo.
            </p>
          </div>
          {canEdit &&
            (agenteEvaluacion.enModoAgente ? (
              // Sin criterios no hay porcentajes que pulsar: el disparador global
              // se apoya aquí, que es el único punto de entrada de la superficie.
              <Button
                className={agenteEvaluacion.halo.className}
                style={agenteEvaluacion.halo.style}
                {...agenteEvaluacion.props}
              >
                <Sparkles
                  className={cn(
                    'h-4 w-4',
                    agenteEvaluacion.ejecutando && 'animate-pulse',
                  )}
                />
                Proponer criterios
              </Button>
            ) : (
              <Button onClick={startEditing}>
                <Plus className="h-4 w-4" /> Definir criterios
              </Button>
            ))}

          {agenteEvaluacion.rechazo && (
            <p className="text-muted-foreground animate-in fade-in max-w-sm text-xs leading-relaxed">
              {agenteEvaluacion.rechazo}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-seccion">
          {/* Distribución: un vistazo del peso de cada criterio */}
          <div className="space-y-control">
            <div
              className="bg-muted flex h-3 w-full gap-px overflow-hidden rounded-full"
              role="img"
              aria-label={`Distribución de la evaluación: ${criterios
                .map((c) => `${c.criterio} ${c.porcentaje}%`)
                .join(', ')}`}
            >
              {criterios.map((c, index) => (
                <div
                  key={`${c.criterio}-${index}`}
                  className="h-full"
                  style={{
                    width: `${c.porcentaje}%`,
                    backgroundColor: segmentColor(index),
                  }}
                />
              ))}
            </div>

            {canEdit && (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={startEditing}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
              </div>
            )}
          </div>

          {/* Criterios */}
          <ul
            className="divide-border/60 relative divide-y"
            aria-label={
              agenteEvaluacion.enModoAgente
                ? 'Criterios de evaluación. Ajustar un porcentaje reescribe todos los demás.'
                : undefined
            }
          >
            {/* Encierra la columna de porcentajes: son una sola unidad porque
                deben sumar 100, y el usuario tiene que verlo antes de pulsar. */}
            {agenteEvaluacion.enModoAgente && (
              <span
                aria-hidden
                className="border-primary/40 pointer-events-none absolute -inset-y-1 -right-2 w-16 rounded-xl border border-dashed"
              />
            )}

            {criterios.map((c, index) => (
              <AccionAgente
                key={`${c.criterio}-${index}`}
                opciones={opcionesCriterio(c, index)}
              >
                {(agenteNombre) => (
                  <li className="py-control">
                    <div className="gap-control flex items-center">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: segmentColor(index) }}
                        aria-hidden
                      />

                      {agenteNombre.ejecutando ? (
                        <Skeleton className="h-4 min-w-0 flex-1" />
                      ) : agenteNombre.enModoAgente ? (
                        <button
                          type="button"
                          className={cn(
                            'text-foreground hover:bg-muted/60 -mx-relacionado px-relacionado py-micro min-w-0 flex-1 truncate rounded-md text-left text-sm',
                            agenteNombre.halo.className,
                          )}
                          style={agenteNombre.halo.style}
                          {...agenteNombre.props}
                        >
                          {c.criterio}
                        </button>
                      ) : (
                        <span className="text-foreground min-w-0 flex-1 text-sm">
                          {c.criterio}
                        </span>
                      )}

                      {agenteEvaluacion.ejecutando ? (
                        <Skeleton className="h-4 w-12 shrink-0" />
                      ) : agenteEvaluacion.enModoAgente ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                'text-foreground hover:bg-muted/60 py-micro w-12 shrink-0 rounded-md text-right text-sm font-semibold tabular-nums',
                                agenteEvaluacion.halo.className,
                              )}
                              style={agenteEvaluacion.halo.style}
                              {...agenteEvaluacion.props}
                            >
                              {c.porcentaje}%
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Reparte de nuevo todos los porcentajes con la IA
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-foreground w-12 shrink-0 text-right text-sm font-semibold tabular-nums">
                          {c.porcentaje}%
                        </span>
                      )}
                    </div>

                    {agenteNombre.rechazo && (
                      <p className="text-muted-foreground animate-in fade-in mt-relacionado pl-seccion text-xs leading-relaxed">
                        {agenteNombre.rechazo}
                      </p>
                    )}
                  </li>
                )}
              </AccionAgente>
            ))}
          </ul>

          <div className="border-border/60 pt-control flex justify-end border-t">
            <TotalIndicator total={totalGuardado} />
          </div>

          {agenteEvaluacion.rechazo && (
            <p className="text-muted-foreground animate-in fade-in text-xs leading-relaxed">
              {agenteEvaluacion.rechazo}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** Total con estado: completo (100), incompleto (<100). El editor impide >100. */
function TotalIndicator({ total }: { total: number }) {
  const completo = total === 100

  return (
    <p
      className={cn(
        'gap-relacionado flex items-center text-sm tabular-nums',
        completo ? 'text-muted-foreground' : 'text-destructive font-medium',
      )}
    >
      {completo ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
      ) : (
        <TriangleAlert className="h-4 w-4" aria-hidden />
      )}
      Total {total}/100
      {!completo && total < 100 ? ` · faltan ${100 - total} puntos` : ''}
    </p>
  )
}

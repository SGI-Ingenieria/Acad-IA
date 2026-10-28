import { useForm } from '@tanstack/react-form'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpenText,
  ClipboardCheck,
  FileText,
  Loader2,
  Map,
  Plus,
  UsersRound,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'

import type {
  ContextoAreaComun,
  DistribucionAreaComun,
  EspacioAreaComun,
} from '@/data/types/areaComun'
import type { Asignatura, PlanEstudio } from '@/data/types/domain'

import { showAppConfirm } from '@/components/ui/app-alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogDescription,
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
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  useAccionesAreaComun,
  useAreaComun,
  useAreaComunIndicadores,
} from '@/data/hooks/useAreaComun'
import { useCarreras } from '@/data/hooks/useMeta'
import { usePermissions } from '@/data/hooks/usePermissions'
import { usePlan, usePlanAsignaturas } from '@/data/hooks/usePlans'
import {
  configuracionAreaComunSchema,
  PLAN_AREA_COMUN_ID,
} from '@/data/types/areaComun'
import { notify } from '@/lib/toast'

export function AreaComunControl({
  plan,
  editable,
}: {
  plan: PlanEstudio
  editable: boolean
}) {
  const contexto = useAreaComun(plan.id)
  const acciones = useAccionesAreaComun()
  const { has } = usePermissions()
  const [abierto, setAbierto] = useState(false)
  const esArea = plan.categoria === 'AREA_COMUN'
  const pendiente = acciones.publicar.isPending || acciones.retirar.isPending

  if (contexto.isPending) return <Skeleton className="h-9 w-40" />
  if (contexto.isError)
    return (
      <Button variant="outline" onClick={() => void contexto.refetch()}>
        Reintentar Área común
      </Button>
    )
  const ctx = contexto.data

  const publicar = async () => {
    const confirmado = await showAppConfirm({
      title: 'Publicar Área común',
      description: `Se actualizarán ${ctx.planes_usuarios.length} planes vinculados. Los cambios se aplicarán juntos después de validar sus distribuciones y electivas.`,
      confirmLabel: 'Publicar',
    })
    if (!confirmado) return
    acciones.publicar.mutate(
      { planId: plan.id, revision: ctx.revision },
      {
        onSuccess: () => notify.success('Área común publicada.'),
      },
    )
  }

  const retirar = async () => {
    if (
      !(await showAppConfirm({
        title: 'Retirar línea de Área común',
        description:
          'Las materias comunes dejarán de formar parte de este plan. El catálogo de Área común se conserva.',
        variant: 'destructive',
        confirmLabel: 'Retirar línea',
      }))
    )
      return
    acciones.retirar.mutate(plan.id, {
      onSuccess: () => notify.success('Línea retirada.'),
    })
  }

  return (
    <>
      {esArea ? (
        <>
          <span className="text-muted-foreground text-sm">
            {ctx.numero_publicacion
              ? `Publicación ${ctx.numero_publicacion}`
              : 'Sin publicar'}
          </span>
          {editable && (
            <Button variant="outline" onClick={() => setAbierto(true)}>
              Distribuciones
            </Button>
          )}
          {has('area_comun.publicar') && (
            <Button disabled={pendiente} onClick={() => void publicar()}>
              {pendiente && <Loader2 className="animate-spin" />}Publicar
              cambios
            </Button>
          )}
        </>
      ) : (
        editable &&
        plan.estructuras_plan?.tipo === 'CURRICULAR' && (
          <>
            <Button variant="outline" onClick={() => setAbierto(true)}>
              {ctx.incorporacion
                ? 'Electivas de Área común'
                : 'Agregar línea de Área común'}
            </Button>
            {ctx.incorporacion && (
              <Button
                variant="ghost"
                disabled={pendiente}
                onClick={() => void retirar()}
              >
                {pendiente && <Loader2 className="animate-spin" />}Retirar línea
              </Button>
            )}
          </>
        )
      )}
      <Dialog open={abierto} onOpenChange={setAbierto}>
        {abierto &&
          (esArea ? (
            <DistribucionesEditor
              planId={plan.id}
              contexto={ctx}
              cerrar={() => setAbierto(false)}
            />
          ) : (
            <IncorporacionEditor
              planId={plan.id}
              contexto={ctx}
              cerrar={() => setAbierto(false)}
            />
          ))}
      </Dialog>
    </>
  )
}

function IncorporacionEditor({
  planId,
  contexto,
  cerrar,
}: {
  planId: string
  contexto: ContextoAreaComun
  cerrar: () => void
}) {
  const acciones = useAccionesAreaComun()
  const distribucion = contexto.distribucion
  const materias = contexto.contenido?.asignaturas ?? []
  const form = useForm({
    defaultValues: {
      publicacionId: contexto.publicacion_id,
      electivas: contexto.incorporacion?.electivas ?? {},
    },
    onSubmit: async ({ value }) => {
      await acciones.incorporar.mutateAsync({
        planId,
        electivas: value.electivas,
        publicacionId: value.publicacionId!,
      })
      notify.success('Línea de Área común incorporada.')
      cerrar()
    },
  })
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Área curricular común</DialogTitle>
      </DialogHeader>
      {!contexto.publicacion_id ? (
        <p role="status">Área común aún no tiene una publicación.</p>
      ) : !distribucion ? (
        <p role="status">
          Área común no ha publicado una distribución compatible con este plan.
        </p>
      ) : (
        <form
          className="space-y-grupo"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit().catch(() => undefined)
          }}
        >
          <p className="text-muted-foreground text-sm">
            Publicación {contexto.numero_publicacion} ·{' '}
            {distribucion.numero_ciclos} {distribucion.tipo_ciclo.toLowerCase()}
            s
          </p>
          {distribucion.nota && (
            <p className="text-sm" role="status">
              {distribucion.nota}
            </p>
          )}
          <ol className="space-y-control max-h-64 overflow-y-auto">
            {distribucion.espacios
              .filter((e) => e.asignatura_id)
              .map((e) => (
                <li
                  key={e.clave}
                  className="gap-control flex justify-between text-sm"
                >
                  <span>
                    {materias.find((a) => a.id === e.asignatura_id)?.nombre}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    C{e.numero_ciclo}
                  </span>
                </li>
              ))}
          </ol>
          <form.Field name="electivas">
            {(field) => (
              <div className="space-y-grupo">
                {distribucion.espacios
                  .filter((e) => e.opciones)
                  .map((e) => (
                    <div className="space-y-control" key={e.clave}>
                      <Label htmlFor={`electiva-${e.clave}`}>
                        {e.nombre ?? e.clave} · C{e.numero_ciclo}
                      </Label>
                      <Select
                        value={field.state.value[e.clave] ?? ''}
                        onValueChange={(id) =>
                          field.handleChange({
                            ...field.state.value,
                            [e.clave]: id,
                          })
                        }
                      >
                        <SelectTrigger id={`electiva-${e.clave}`}>
                          <SelectValue placeholder="Elegir asignatura" />
                        </SelectTrigger>
                        <SelectContent>
                          {e.opciones?.map((id) => (
                            <SelectItem key={id} value={id}>
                              {materias.find((a) => a.id === id)?.nombre ?? id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
              </div>
            )}
          </form.Field>
          <DialogFooter>
            <form.Subscribe selector={(s) => s.values.electivas}>
              {(electivas) => (
                <Button
                  type="submit"
                  disabled={
                    acciones.incorporar.isPending ||
                    distribucion.espacios.some(
                      (e) =>
                        e.opciones &&
                        !e.opciones.includes(electivas[e.clave] ?? ''),
                    )
                  }
                >
                  {acciones.incorporar.isPending && (
                    <Loader2 className="animate-spin" />
                  )}
                  {contexto.incorporacion
                    ? 'Guardar electivas'
                    : 'Agregar línea'}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      )}
    </DialogContent>
  )
}

function DistribucionesEditor({
  planId,
  contexto,
  cerrar,
}: {
  planId: string
  contexto: ContextoAreaComun
  cerrar: () => void
}) {
  const { data: materias = [] } = usePlanAsignaturas(planId)
  const { data: carreras = [] } = useCarreras()
  const acciones = useAccionesAreaComun()
  const [error, setError] = useState<string | null>(null)
  const form = useForm({
    defaultValues: {
      distribuciones: contexto.borrador ?? [],
      revision: contexto.revision,
    },
    onSubmit: async ({ value }) => {
      const parsed = configuracionAreaComunSchema.safeParse(
        value.distribuciones,
      )
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Configuración inválida.')
        return
      }
      setError(null)
      await acciones.guardar.mutateAsync({
        planId,
        revision: value.revision,
        distribuciones: parsed.data,
      })
      notify.success('Distribuciones guardadas en borrador.')
      cerrar()
    },
  })
  return (
    <DialogContent className="sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>Distribuciones de Área común</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-grupo"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit().catch(() => undefined)
        }}
      >
        <form.Field name="distribuciones">
          {(field) => {
            const ds = field.state.value
            const actualizar = (
              index: number,
              patch: Partial<DistribucionAreaComun>,
            ) =>
              field.handleChange(
                ds.map((d, n) => (n === index ? { ...d, ...patch } : d)),
              )
            return (
              <div className="space-y-seccion max-h-[65vh] overflow-y-auto">
                {ds.map((d, index) => (
                  <section key={d.clave} className="space-y-grupo">
                    <div className="gap-grupo flex flex-wrap items-end">
                      <div className="space-y-control">
                        <Label htmlFor={`ciclos-${index}`}>Ciclos</Label>
                        <Input
                          id={`ciclos-${index}`}
                          type="number"
                          min={1}
                          value={d.numero_ciclos}
                          onChange={(e) =>
                            actualizar(index, {
                              numero_ciclos: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-control">
                        <Label htmlFor={`tipo-${index}`}>Tipo de ciclo</Label>
                        <Select
                          value={d.tipo_ciclo}
                          onValueChange={(
                            v: DistribucionAreaComun['tipo_ciclo'],
                          ) => actualizar(index, { tipo_ciclo: v })}
                        >
                          <SelectTrigger id={`tipo-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              [
                                'Semestre',
                                'Cuatrimestre',
                                'Trimestre',
                                'Otro',
                              ] as const
                            ).map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-control min-w-48 flex-1">
                        <Label htmlFor={`carrera-${index}`}>Aplicación</Label>
                        <Select
                          value={d.carrera_id ?? 'todas'}
                          onValueChange={(v) =>
                            actualizar(index, {
                              carrera_id: v === 'todas' ? null : v,
                            })
                          }
                        >
                          <SelectTrigger id={`carrera-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todas">
                              Todas las carreras
                            </SelectItem>
                            {carreras.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          field.handleChange(ds.filter((_, n) => n !== index))
                        }
                      >
                        <Trash2 />
                        Retirar distribución
                      </Button>
                    </div>
                    <div className="space-y-control">
                      <Label htmlFor={`nota-${index}`}>
                        Notas y excepciones pendientes
                      </Label>
                      <Textarea
                        id={`nota-${index}`}
                        value={d.nota ?? ''}
                        onChange={(e) =>
                          actualizar(index, { nota: e.target.value })
                        }
                      />
                    </div>
                    {d.espacios.map((espacio, n) => (
                      <EspacioEditor
                        key={espacio.clave}
                        espacio={espacio}
                        espacios={d.espacios}
                        materias={materias}
                        max={d.numero_ciclos}
                        actualizar={(patch) =>
                          actualizar(index, {
                            espacios: d.espacios.map((e, j) =>
                              j === n ? { ...e, ...patch } : e,
                            ),
                          })
                        }
                        reemplazar={(e) =>
                          actualizar(index, {
                            espacios: d.espacios.map((actual, j) =>
                              j === n ? e : actual,
                            ),
                          })
                        }
                        retirar={() =>
                          actualizar(index, {
                            espacios: d.espacios.filter((_, j) => j !== n),
                          })
                        }
                      />
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        actualizar(index, {
                          espacios: [
                            ...d.espacios,
                            {
                              clave: crypto.randomUUID(),
                              numero_ciclo: 1,
                              orden: d.espacios.length,
                              asignatura_id: materias[0]?.id,
                            },
                          ],
                        })
                      }
                    >
                      <Plus />
                      Agregar espacio
                    </Button>
                  </section>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    field.handleChange([
                      ...ds,
                      {
                        clave: crypto.randomUUID(),
                        tipo_ciclo: 'Semestre',
                        numero_ciclos: 8,
                        carrera_id: null,
                        espacios: (ds[0]?.espacios ?? []).map((e) => ({
                          ...e,
                        })),
                      },
                    ])
                  }
                >
                  <Plus />
                  Agregar distribución
                </Button>
              </div>
            )
          }}
        </form.Field>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="submit" disabled={acciones.guardar.isPending}>
            {acciones.guardar.isPending && <Loader2 className="animate-spin" />}
            Guardar borrador
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function EspacioEditor({
  espacios,
  espacio,
  materias,
  max,
  actualizar,
  reemplazar,
  retirar,
}: {
  espacio: EspacioAreaComun
  espacios: Array<EspacioAreaComun>
  materias: Array<Asignatura>
  max: number
  actualizar: (patch: Partial<EspacioAreaComun>) => void
  reemplazar: (espacio: EspacioAreaComun) => void
  retirar: () => void
}) {
  return (
    <div className="space-y-control">
      <div className="gap-control flex flex-wrap items-center">
        <Select
          value={espacio.opciones ? 'electiva' : 'fija'}
          onValueChange={(v) => {
            const {
              asignatura_id: _asignatura,
              opciones: _opciones,
              ...base
            } = espacio
            reemplazar(
              v === 'electiva'
                ? { ...base, opciones: materias[0] ? [materias[0].id] : [] }
                : { ...base, asignatura_id: materias[0]?.id },
            )
          }}
        >
          <SelectTrigger aria-label="Tipo de espacio" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fija">Fija</SelectItem>
            <SelectItem value="electiva">Electiva</SelectItem>
          </SelectContent>
        </Select>
        {espacio.opciones ? (
          <Input
            aria-label="Nombre del espacio electivo"
            value={espacio.nombre ?? ''}
            placeholder="Nombre de la electiva"
            className="flex-1"
            onChange={(e) => actualizar({ nombre: e.target.value })}
          />
        ) : (
          <Select
            value={espacio.asignatura_id ?? ''}
            onValueChange={(id) => actualizar({ asignatura_id: id })}
          >
            <SelectTrigger
              aria-label="Asignatura del espacio"
              className="flex-1"
            >
              <SelectValue placeholder="Elegir materia" />
            </SelectTrigger>
            <SelectContent>
              {materias.map((a) => (
                <SelectItem value={a.id} key={a.id}>
                  {a.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Input
          type="number"
          min={1}
          max={max}
          aria-label="Ciclo oficial"
          value={espacio.numero_ciclo}
          className="w-20"
          onChange={(e) => actualizar({ numero_ciclo: Number(e.target.value) })}
        />
        <Button type="button" variant="ghost" onClick={retirar}>
          Retirar espacio
        </Button>
      </div>
      {espacio.opciones && (
        <div className="space-y-control">
          <Label htmlFor={'antecedente-' + espacio.clave}>
            Grupo antecedente
          </Label>
          <Select
            value={espacio.prerrequisito_grupo_clave ?? 'ninguno'}
            onValueChange={(clave) => {
              const { prerrequisito_grupo_clave: _previo, ...base } = espacio
              reemplazar(
                clave === 'ninguno'
                  ? base
                  : { ...base, prerrequisito_grupo_clave: clave },
              )
            }}
          >
            <SelectTrigger id={'antecedente-' + espacio.clave}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ninguno">Sin seriación</SelectItem>
              {espacios
                .filter(
                  (e) =>
                    e.opciones &&
                    e.clave !== espacio.clave &&
                    e.numero_ciclo < espacio.numero_ciclo,
                )
                .map((e) => (
                  <SelectItem key={e.clave} value={e.clave}>
                    {e.nombre ?? e.clave}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {espacio.opciones && (
        <div className="gap-control grid sm:grid-cols-2">
          {materias.map((a) => (
            <label key={a.id} className="gap-control flex items-center text-sm">
              <Checkbox
                checked={espacio.opciones?.includes(a.id)}
                onCheckedChange={(checked) =>
                  actualizar({
                    opciones: checked
                      ? [...(espacio.opciones ?? []), a.id]
                      : espacio.opciones?.filter((id) => id !== a.id),
                  })
                }
              />
              {a.nombre}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export function AreaComunPlanesUsuarios({ planId }: { planId: string }) {
  const contexto = useAreaComun(planId)
  if (!contexto.data) return null
  return (
    <section className="space-y-grupo">
      <h2 className="text-lg font-semibold">Planes que utilizan esta línea</h2>
      {contexto.data.planes_usuarios.length === 0 ? (
        <p className="text-muted-foreground text-sm">Sin incorporaciones</p>
      ) : (
        <ul className="space-y-control">
          {contexto.data.planes_usuarios.map((p) => (
            <li key={p.id}>{p.nombre}</li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground text-sm">
        Borrador · Pendiente de publicación
      </p>
    </section>
  )
}

export function AreaComunAcceso() {
  const { has } = usePermissions()
  if (!has('area_comun.gestionar')) return null
  return (
    <Button variant="outline" asChild>
      <Link to="/planes/$planId/mapa" params={{ planId: PLAN_AREA_COMUN_ID }}>
        Administrar Área curricular común
      </Link>
    </Button>
  )
}

export function AreaComunInicio({
  bloqueClave,
}: {
  bloqueClave?: string | null
}) {
  const plan = usePlan(PLAN_AREA_COMUN_ID)
  const materias = usePlanAsignaturas(PLAN_AREA_COMUN_ID)
  const contexto = useAreaComun(PLAN_AREA_COMUN_ID)
  const [pendienteActivo, setPendienteActivo] = useState<string | null>(null)
  const todasLasAsignaturas = materias.data ?? []
  const bloquePorClave: Record<string, string> = {
    PENSAMIENTO_COMUNICACION: 'Pensamiento y Comunicación',
    HUMANISMO_SOCIEDAD: 'Humanismo y Sociedad',
    LENGUA_EXTRANJERA: 'Lengua Extranjera',
    EMPRENDIMIENTO_SUSTENTABILIDAD: 'Emprendimiento y Sostenibilidad',
  }
  const nombreBloque = bloqueClave ? bloquePorClave[bloqueClave] : null
  const nombresBloqueCompatibles = new Set(
    nombreBloque
      ? [
          nombreBloque,
          ...(bloqueClave === 'HUMANISMO_SOCIEDAD'
            ? ['Humanismo Sociedad']
            : []),
          ...(bloqueClave === 'EMPRENDIMIENTO_SUSTENTABILIDAD'
            ? [
                'Emprendimiento Sustentabilidad',
                'Emprendimiento Sostenibilidad',
              ]
            : []),
        ]
      : [],
  )
  const asignaturasVisibles = nombreBloque
    ? todasLasAsignaturas.filter((asignatura) => {
        const meta = asignatura.meta_origen
        return (
          meta &&
          typeof meta === 'object' &&
          !Array.isArray(meta) &&
          typeof meta.bloque === 'string' &&
          nombresBloqueCompatibles.has(meta.bloque)
        )
      })
    : todasLasAsignaturas
  const ids = asignaturasVisibles.map((a) => a.id)
  const indicadores = useAreaComunIndicadores(PLAN_AREA_COMUN_ID, ids)
  if (plan.isPending || materias.isPending || contexto.isPending)
    return <Skeleton className="h-32 w-full" />
  if (plan.isError || materias.isError || contexto.isError)
    return (
      <section className="space-y-control" aria-live="polite">
        <Button
          variant="outline"
          onClick={() =>
            void Promise.all([
              plan.refetch(),
              materias.refetch(),
              contexto.refetch(),
            ])
          }
        >
          Reintentar catálogo
        </Button>
        <ul className="text-destructive text-sm" role="alert">
          {plan.isError && (
            <li>
              Plan:{' '}
              {plan.error instanceof Error
                ? plan.error.message
                : 'No se pudo cargar.'}
            </li>
          )}
          {materias.isError && (
            <li>
              Asignaturas:{' '}
              {materias.error instanceof Error
                ? materias.error.message
                : 'No se pudieron cargar.'}
            </li>
          )}
          {contexto.isError && (
            <li>
              Configuración:{' '}
              {contexto.error instanceof Error
                ? contexto.error.message
                : 'No se pudo cargar.'}
            </li>
          )}
        </ul>
      </section>
    )
  const asignaturas = asignaturasVisibles
  const relaciones = indicadores.data
  const categorias = [
    {
      id: 'datos',
      titulo: 'Datos incompletos',
      detalle: 'Falta código, horas académicas o créditos.',
      icono: FileText,
      ruta: (id: string) => ({
        to: '/planes/$planId/asignaturas/$asignaturaId' as const,
        params: { planId: PLAN_AREA_COMUN_ID, asignaturaId: id },
      }),
      afectadas: asignaturas.filter(
        (a) =>
          !a.codigo?.trim() || a.horas_academicas == null || a.creditos == null,
      ),
    },
    {
      id: 'contenido',
      titulo: 'Sin contenido temático',
      detalle: 'La asignatura no tiene unidades registradas.',
      icono: BookOpenText,
      ruta: (id: string) => ({
        to: '/planes/$planId/asignaturas/$asignaturaId/contenido' as const,
        params: { planId: PLAN_AREA_COMUN_ID, asignaturaId: id },
      }),
      afectadas: asignaturas.filter(
        (a) =>
          !Array.isArray(a.contenido_tematico) ||
          a.contenido_tematico.length === 0,
      ),
    },
    {
      id: 'bibliografia',
      titulo: 'Sin bibliografía',
      detalle: 'No hay referencias asociadas.',
      icono: BookOpenText,
      ruta: (id: string) => ({
        to: '/planes/$planId/asignaturas/$asignaturaId/bibliografia' as const,
        params: { planId: PLAN_AREA_COMUN_ID, asignaturaId: id },
      }),
      afectadas: asignaturas.filter((a) => !relaciones?.bibliografia.has(a.id)),
    },
    {
      id: 'evaluacion',
      titulo: 'Sin criterios de evaluación',
      detalle: 'Falta definir cómo se evaluará el aprendizaje.',
      icono: ClipboardCheck,
      ruta: (id: string) => ({
        to: '/planes/$planId/asignaturas/$asignaturaId/evaluacion' as const,
        params: { planId: PLAN_AREA_COMUN_ID, asignaturaId: id },
      }),
      afectadas: asignaturas.filter(
        (a) =>
          !Array.isArray(a.criterios_de_evaluacion) ||
          a.criterios_de_evaluacion.length === 0,
      ),
    },
    {
      id: 'responsables',
      titulo: 'Sin responsable asignado',
      detalle: 'Asigna quién dará seguimiento a la materia.',
      icono: UsersRound,
      ruta: (id: string) => ({
        to: '/planes/$planId/asignaturas/$asignaturaId' as const,
        params: { planId: PLAN_AREA_COMUN_ID, asignaturaId: id },
      }),
      afectadas: asignaturas.filter((a) => !relaciones?.responsables.has(a.id)),
    },
    {
      id: 'borrador',
      titulo: 'Asignaturas en borrador',
      detalle: 'Revisa el estado antes de publicar el catálogo.',
      icono: FileText,
      ruta: (id: string) => ({
        to: '/planes/$planId/asignaturas/$asignaturaId' as const,
        params: { planId: PLAN_AREA_COMUN_ID, asignaturaId: id },
      }),
      afectadas: asignaturas.filter((a) => a.estado === 'borrador'),
    },
    {
      id: 'mapa',
      titulo: 'Sin ubicación curricular',
      detalle: 'La asignatura no está ubicada en un ciclo y línea.',
      icono: Map,
      ruta: (_id: string) => ({
        to: '/planes/$planId/mapa' as const,
        params: { planId: PLAN_AREA_COMUN_ID },
      }),
      afectadas: asignaturas.filter(
        (a) => a.numero_ciclo == null || a.linea_plan_id == null,
      ),
    },
  ]
  const categoriasVisibles = bloqueClave
    ? categorias.filter((categoria) =>
        ['datos', 'contenido', 'bibliografia', 'evaluacion'].includes(
          categoria.id,
        ),
      )
    : categorias
  const pendientes = categoriasVisibles.reduce(
    (sum, categoria) => sum + categoria.afectadas.length,
    0,
  )
  const total = asignaturas.length * categoriasVisibles.length
  const avance = total ? Math.round(((total - pendientes) / total) * 100) : 100
  const prioridad = categoriasVisibles.find(
    (categoria) => categoria.afectadas.length > 0,
  )
  const seleccion = categoriasVisibles.find(
    (categoria) => categoria.id === pendienteActivo,
  )
  return (
    <div className="space-y-seccion">
      <section className="space-y-grupo">
        <div className="gap-grupo flex flex-wrap items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold">
              {plan.data.nombre_display}
            </h2>
            <p className="text-muted-foreground text-sm">
              {nombreBloque ? `${nombreBloque} · ` : ''}
              {asignaturas.length} asignaturas ·{' '}
              {contexto.data.numero_publicacion
                ? `Publicación ${contexto.data.numero_publicacion}`
                : 'Sin publicación vigente'}
              {contexto.data.borrador && ' · Cambios en borrador'}
            </p>
          </div>
          {!bloqueClave && (
            <Button asChild>
              <Link
                to="/planes/$planId/mapa"
                params={{ planId: PLAN_AREA_COMUN_ID }}
              >
                Administrar Área curricular común
              </Link>
            </Button>
          )}
        </div>
      </section>

      {prioridad && (
        <section className="border-border gap-grupo px-seccion py-grupo flex flex-wrap items-center justify-between border-y">
          <div className="gap-grupo flex items-start">
            <prioridad.icono className="text-primary mt-micro size-5" />
            <div>
              <p className="text-primary text-sm font-medium">
                Tu prioridad ahora
              </p>
              <h3 className="font-semibold">
                {prioridad.afectadas[0]?.nombre}
              </h3>
              <p className="text-muted-foreground text-sm">
                {prioridad.detalle}
              </p>
            </div>
          </div>
          <Button asChild>
            <Link {...prioridad.ruta(prioridad.afectadas[0].id)}>
              Atender pendiente <ArrowRight />
            </Link>
          </Button>
        </section>
      )}

      <div className="gap-seccion grid lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.6fr)]">
        <section className="border-border space-y-grupo py-grupo border-y">
          <div>
            <p className="text-primary text-sm font-medium">
              Avance del catálogo
            </p>
            <p className="text-4xl font-bold">{avance}%</p>
            <p className="text-muted-foreground text-sm">
              {total - pendientes} completos · {pendientes} pendientes
            </p>
          </div>
          <div
            className="bg-muted h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={avance}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Avance del catálogo"
          >
            <div
              className="bg-primary h-full rounded-full transition-[width]"
              style={{ width: `${avance}%` }}
            />
          </div>
          <p className="text-muted-foreground text-sm">
            El avance considera datos, contenido, bibliografía, evaluación,
            responsables, estado y ubicación de cada asignatura.
          </p>
        </section>

        <section className="space-y-grupo">
          <div>
            <h3 className="text-xl font-semibold">Pendientes prioritarios</h3>
            <p className="text-muted-foreground text-sm">
              Selecciona un indicador para abrir sus asignaturas.
            </p>
          </div>
          {indicadores.isError ? (
            <div className="space-y-control">
              <p role="alert" className="text-destructive text-sm">
                No se pudieron cargar bibliografía y responsables.
              </p>
              <Button
                variant="outline"
                onClick={() => void indicadores.refetch()}
              >
                Reintentar indicadores
              </Button>
            </div>
          ) : indicadores.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="gap-control grid sm:grid-cols-2 xl:grid-cols-3">
              {categoriasVisibles.map((categoria) => (
                <button
                  key={categoria.id}
                  type="button"
                  onClick={() => setPendienteActivo(categoria.id)}
                  className="border-border organic-interactive p-grupo rounded-lg border text-left"
                >
                  <div className="gap-control flex items-center">
                    <categoria.icono className="text-muted-foreground size-5" />
                    <span className="text-2xl font-bold">
                      {categoria.afectadas.length}
                    </span>
                  </div>
                  <p className="mt-control font-semibold">{categoria.titulo}</p>
                  <span className="text-muted-foreground text-sm">
                    Seleccionar asignaturas
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
      {bloqueClave && (
        <section className="space-y-grupo">
          <h3 className="text-xl font-semibold">Materias del bloque</h3>
          <ul className="divide-border divide-y">
            {asignaturas.map((asignatura) => (
              <li key={asignatura.id}>
                <Link
                  to="/planes/$planId/asignaturas/$asignaturaId"
                  params={{
                    planId: PLAN_AREA_COMUN_ID,
                    asignaturaId: asignatura.id,
                  }}
                  className="gap-grupo py-control hover:text-primary flex items-center justify-between"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {asignatura.nombre}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {[asignatura.codigo, `C${asignatura.numero_ciclo ?? '—'}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!bloqueClave && <AreaComunPlanesUsuarios planId={PLAN_AREA_COMUN_ID} />}
      <Dialog
        open={Boolean(seleccion)}
        onOpenChange={(open) => !open && setPendienteActivo(null)}
      >
        {seleccion && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{seleccion.titulo}</DialogTitle>
              <DialogDescription>
                {seleccion.afectadas.length} asignaturas · Catálogo de Área
                común
              </DialogDescription>
            </DialogHeader>
            {seleccion.afectadas.length ? (
              <ul className="space-y-control max-h-[60vh] overflow-y-auto">
                {seleccion.afectadas.map((asignatura) => (
                  <li
                    key={asignatura.id}
                    className="border-border gap-grupo py-control flex items-center justify-between border-b"
                  >
                    <span>{asignatura.nombre}</span>
                    <Button variant="ghost" size="sm" asChild>
                      <Link {...seleccion.ruta(asignatura.id)}>
                        Abrir <ArrowRight />
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status">
                No hay asignaturas pendientes en este indicador.
              </p>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

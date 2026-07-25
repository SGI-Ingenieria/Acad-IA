import { useNavigate, useParams } from '@tanstack/react-router'
import {
  ArrowLeftRight,
  BookOpen,
  Globe,
  Library,
  Plus,
  Quote,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'

import type {
  PayloadProponerBibliografia,
  ResultadoProponerBibliografia,
} from '@/data'
import type { Tables } from '@/types/supabase'

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
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  requestAdminOverrideReason,
  useAsignaturaCapabilities,
} from '@/data/auth/planCapabilities'
import { usePlan } from '@/data/hooks/usePlans'
import {
  useCreateBibliografia,
  useDeleteBibliografia,
  useSubject,
  useSubjectBibliografia,
  useUpdateBibliografia,
} from '@/data/hooks/useSubjects'
import { useAccionAgente, useColoresLineas } from '@/features/agente'
import { cn } from '@/lib/utils'

const FORMATOS = ['apa', 'ieee', 'vancouver', 'chicago'] as const
type Formato = (typeof FORMATOS)[number]

const FORMATO_LABEL: Record<Formato, string> = {
  apa: 'APA',
  ieee: 'IEEE',
  vancouver: 'Vancouver',
  chicago: 'Chicago',
}

type BibliografiaRow = Tables<'bibliografia_asignatura'>

/**
 * Instantánea de una creación: el id no existe hasta que el servidor responde,
 * así que se rellena dentro de `aplicar` para que deshacer sepa qué borrar.
 */
type Creado = { id: string | null }

const FORMATO_POR_DEFECTO = 'apa'

/** Estilo de cita dominante; la propuesta de la IA debe seguir el de la casa. */
function formatoDominante(entradas: Array<BibliografiaRow>): string {
  const cuenta = new Map<string, number>()
  for (const entrada of entradas) {
    if (!entrada.formato) continue
    cuenta.set(entrada.formato, (cuenta.get(entrada.formato) ?? 0) + 1)
  }

  let mejor = FORMATO_POR_DEFECTO
  let maximo = 0
  for (const [formato, veces] of cuenta) {
    if (veces > maximo) {
      mejor = formato
      maximo = veces
    }
  }
  return mejor
}

export function BibliographyItem() {
  const navigate = useNavigate()
  const { planId, asignaturaId } = useParams({
    from: '/planes/$planId/asignaturas/$asignaturaId',
  })

  const { data: bibliografia = [], isLoading } =
    useSubjectBibliografia(asignaturaId)
  const { data: plan } = usePlan(planId)
  const { data: asignatura } = useSubject(asignaturaId)
  const capabilities = useAsignaturaCapabilities(plan, asignaturaId)
  const canEditBibliografia = capabilities.canEditAsignaturas

  const { mutate: actualizarBibliografia } = useUpdateBibliografia(asignaturaId)
  const {
    mutate: eliminarBibliografia,
    mutateAsync: eliminarBibliografiaAsync,
  } = useDeleteBibliografia(asignaturaId)
  const { mutateAsync: crearBibliografia } = useCreateBibliografia()

  const [selectedEntry, setSelectedEntry] = useState<BibliografiaRow | null>(
    null,
  )
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const basicaEntries = bibliografia.filter((e) => e.tipo === 'BASICA')
  const complementariaEntries = bibliografia.filter(
    (e) => e.tipo === 'COMPLEMENTARIA',
  )

  const getAdminOverrideReason = async (actionLabel: string) => {
    if (!capabilities.requiresAdminOverrideForEdit) return null
    return requestAdminOverrideReason(actionLabel)
  }

  const handleAdd = () => {
    if (!canEditBibliografia) return
    void navigate({
      to: '/planes/$planId/asignaturas/$asignaturaId/bibliografia/nueva',
      params: { planId, asignaturaId },
      resetScroll: false,
    })
  }

  const handleMove = async (entry: BibliografiaRow) => {
    if (!canEditBibliografia) return
    const adminOverrideReason = await getAdminOverrideReason(
      'mover esta referencia fuera de su etapa normal',
    )
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return
    actualizarBibliografia({
      id: entry.id,
      updates: {
        tipo: entry.tipo === 'BASICA' ? 'COMPLEMENTARIA' : 'BASICA',
      },
      adminOverrideReason,
    })
  }

  const handleChangeFormato = async (
    entry: BibliografiaRow,
    formato: string,
  ) => {
    if (!canEditBibliografia) return
    const adminOverrideReason = await getAdminOverrideReason(
      'cambiar el formato de cita fuera de su etapa normal',
    )
    if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
      return
    actualizarBibliografia({
      id: entry.id,
      updates: { formato },
      adminOverrideReason,
    })
  }

  const handleConfirmDelete = async () => {
    if (!canEditBibliografia) return
    if (deleteId) {
      const adminOverrideReason = await getAdminOverrideReason(
        'eliminar esta referencia fuera de su etapa normal',
      )
      if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason)
        return
      eliminarBibliografia(
        { id: deleteId, adminOverrideReason },
        {
          onSuccess: () => setDeleteId(null),
        },
      )
    }
  }

  // ── Modo agente ────────────────────────────────────────────────────────────

  const colores = useColoresLineas(planId)

  /**
   * El `+` de bibliografía en modo agente no abre el formulario: pide una
   * referencia a la IA, que decide con qué herramientas buscarla (catálogo de
   * biblioteca, búsqueda en línea o su propio conocimiento) y devuelve la cita
   * ya formateada. Deshacer borra la fila creada, cuyo id sólo se conoce después
   * de que el servidor responda.
   */
  const agenteBibliografia = useAccionAgente<
    ResultadoProponerBibliografia,
    Creado
  >({
    id: `bibliografia:${asignaturaId}`,
    accion: 'proponer_bibliografia',
    etiqueta: 'Proponer una referencia bibliográfica',
    ariaLabel: 'Proponer una referencia bibliográfica con IA',
    modo: 'boton',
    disabled: !canEditBibliografia || !capabilities.canUseIA,
    colores,
    payload: () =>
      ({
        asignatura_id: asignaturaId,
        asignatura_nombre: asignatura?.nombre ?? '',
        formato: formatoDominante(bibliografia),
        existentes: bibliografia.map((entrada) => ({
          titulo: entrada.titulo,
          cita: entrada.cita,
        })),
      }) satisfies PayloadProponerBibliografia,
    snapshot: () => ({ id: null }),
    aplicar: async (resultado, creado) => {
      const adminOverrideReason = await getAdminOverrideReason(
        'agregar una referencia fuera de su etapa normal',
      )
      if (capabilities.requiresAdminOverrideForEdit && !adminOverrideReason) {
        throw new Error(
          'Hace falta un motivo para editar fuera de la etapa normal del plan.',
        )
      }

      const fila = await crearBibliografia({
        asignatura_id: asignaturaId,
        cita: resultado.cita,
        tipo: resultado.tipo,
        formato: resultado.formato,
        titulo: resultado.titulo,
        autores: resultado.autores,
        editorial: resultado.editorial,
        anio: resultado.anio,
        isbn: resultado.isbn,
        referencia_en_linea: resultado.referencia_en_linea,
        adminOverrideReason,
      })
      creado.id = fila.id
    },
    restaurar: async (creado) => {
      if (!creado.id) return
      await eliminarBibliografiaAsync({ id: creado.id })
    },
  })

  const botonAgregar = (grande: boolean) =>
    agenteBibliografia.enModoAgente ? (
      <Button
        size={grande ? 'lg' : 'default'}
        className={cn(
          !grande && 'shadow-md',
          agenteBibliografia.halo.className,
        )}
        style={agenteBibliografia.halo.style}
        {...agenteBibliografia.props}
      >
        <Sparkles
          className={cn(
            'mr-2 h-4 w-4',
            agenteBibliografia.ejecutando && 'animate-pulse',
          )}
        />
        Proponer referencia
      </Button>
    ) : (
      <Button
        onClick={handleAdd}
        size={grande ? 'lg' : 'default'}
        className={cn(!grande && 'shadow-md')}
      >
        <Plus className="mr-2 h-4 w-4" /> Agregar bibliografía
      </Button>
    )

  if (isLoading)
    return <div className="p-10 text-center">Cargando bibliografía...</div>

  if (bibliografia.length === 0) {
    return (
      <div className="animate-in fade-in duration-500">
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <BookOpen className="text-muted-foreground h-12 w-12 opacity-40" />
          <div>
            <p className="text-foreground font-medium">
              Aún no hay referencias
            </p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
              Agrega libros, artículos y otras obras de consulta para esta
              asignatura. Puedes buscarlos en línea o capturarlos manualmente.
            </p>
          </div>
          {canEditBibliografia ? (
            botonAgregar(true)
          ) : (
            <p className="text-muted-foreground text-sm">
              La bibliografía esta en modo solo lectura en esta etapa.
            </p>
          )}
          {agenteBibliografia.rechazo && (
            <p className="text-muted-foreground animate-in fade-in max-w-sm text-xs leading-relaxed">
              {agenteBibliografia.rechazo}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in space-y-8 pb-8 duration-500">
      <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-foreground text-2xl font-bold tracking-tight">
            Bibliografía
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {bibliografia.length}{' '}
            {bibliografia.length === 1 ? 'referencia' : 'referencias'} ·{' '}
            {basicaEntries.length} básica
            {basicaEntries.length !== 1 ? 's' : ''} ·{' '}
            {complementariaEntries.length} complementaria
            {complementariaEntries.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canEditBibliografia && (
          <div className="flex flex-col items-start gap-1.5 md:items-end">
            {botonAgregar(false)}
            {agenteBibliografia.rechazo && (
              <p className="text-muted-foreground animate-in fade-in max-w-xs text-xs leading-relaxed md:text-right">
                {agenteBibliografia.rechazo}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-8">
        {basicaEntries.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-primary h-4 w-1 rounded-full" />
              <h3 className="text-foreground font-semibold">
                Bibliografía Básica
              </h3>
              <span className="text-muted-foreground text-sm">
                ({basicaEntries.length})
              </span>
            </div>
            <div className="grid gap-3">
              {basicaEntries.map((entry) => (
                <BibliografiaCard
                  key={entry.id}
                  entry={entry}
                  onView={() => setSelectedEntry(entry)}
                  onMove={() => handleMove(entry)}
                  onChangeFormato={(fmt) => handleChangeFormato(entry, fmt)}
                  onDelete={() => setDeleteId(entry.id)}
                  canEdit={canEditBibliografia}
                />
              ))}
            </div>
          </section>
        )}

        {complementariaEntries.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-muted-foreground/40 h-4 w-1 rounded-full" />
              <h3 className="text-foreground font-semibold">
                Bibliografía Complementaria
              </h3>
              <span className="text-muted-foreground text-sm">
                ({complementariaEntries.length})
              </span>
            </div>
            <div className="grid gap-3">
              {complementariaEntries.map((entry) => (
                <BibliografiaCard
                  key={entry.id}
                  entry={entry}
                  onView={() => setSelectedEntry(entry)}
                  onMove={() => handleMove(entry)}
                  onChangeFormato={(fmt) => handleChangeFormato(entry, fmt)}
                  onDelete={() => setDeleteId(entry.id)}
                  canEdit={canEditBibliografia}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <BibliografiaDetailDialog
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar referencia?</AlertDialogTitle>
            <AlertDialogDescription>
              La referencia será quitada del plan de estudios. Esta acción no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={!canEditBibliografia}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// --- Subcomponents ---

function BibliografiaCard({
  entry,
  onView,
  onMove,
  onChangeFormato,
  onDelete,
  canEdit,
}: {
  entry: BibliografiaRow
  onView: () => void
  onMove: () => void
  onChangeFormato: (formato: Formato) => void
  onDelete: () => void
  canEdit: boolean
}) {
  const autores = Array.isArray(entry.autores)
    ? (entry.autores as Array<unknown>).filter(
        (a): a is string => typeof a === 'string',
      )
    : []

  const moveLabel =
    entry.tipo === 'BASICA' ? 'Mover a Complementaria' : 'Mover a Básica'

  const currentFormato = (entry.formato ?? '') as Formato

  return (
    <Card
      className="group hover:ring-primary/20 cursor-pointer transition-all hover:shadow-md hover:ring-1"
      onClick={onView}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <BookOpen
            className={cn(
              'mt-0.5 h-5 w-5 shrink-0',
              entry.tipo === 'BASICA'
                ? 'text-primary'
                : 'text-muted-foreground',
            )}
          />
          <div className="min-w-0 flex-1">
            {entry.titulo && (
              <p className="text-foreground mb-1 leading-snug font-medium">
                {entry.titulo}
              </p>
            )}
            {autores.length > 0 && (
              <p className="text-muted-foreground mb-1 text-xs">
                {autores.join('; ')}
              </p>
            )}
            <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
              {entry.cita}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {entry.tipo === 'BASICA' ? 'Básica' : 'Complementaria'}
              </Badge>
              {entry.formato && (
                <Badge variant="outline" className="text-[10px] uppercase">
                  {entry.formato}
                </Badge>
              )}
              {entry.referencia_biblioteca && (
                <Badge
                  variant="secondary"
                  className="bg-muted text-muted-foreground text-[10px]"
                >
                  Biblioteca
                </Badge>
              )}
              {entry.referencia_en_linea && (
                <Badge variant="secondary" className="text-[10px]">
                  En línea
                </Badge>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {/* Change citation format */}
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Quote className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Cambiar formato de cita</TooltipContent>
                </Tooltip>
                <DropdownMenuContent
                  align="end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenuLabel className="text-xs">
                    Formato de cita
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {FORMATOS.map((fmt) => (
                    <DropdownMenuItem
                      key={fmt}
                      disabled={fmt === currentFormato}
                      onSelect={() => onChangeFormato(fmt)}
                      className="gap-2"
                    >
                      <span className="font-medium uppercase">
                        {FORMATO_LABEL[fmt]}
                      </span>
                      {fmt === currentFormato && (
                        <span className="text-muted-foreground ml-auto text-xs">
                          actual
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Move between básica / complementaria */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-primary h-8 w-8"
                    aria-label={moveLabel}
                    onClick={(e) => {
                      e.stopPropagation()
                      onMove()
                    }}
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{moveLabel}</TooltipContent>
              </Tooltip>

              {/* Delete */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete()
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Eliminar referencia</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function BibliografiaDetailDialog({
  entry,
  onClose,
}: {
  entry: BibliografiaRow | null
  onClose: () => void
}) {
  if (!entry) return null

  const autores = Array.isArray(entry.autores)
    ? (entry.autores as Array<unknown>).filter(
        (a): a is string => typeof a === 'string',
      )
    : []

  const hasData =
    autores.length > 0 || entry.editorial || entry.anio || entry.isbn

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{entry.titulo ?? 'Detalle de referencia'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 text-sm">
          {/* Cita */}
          <div>
            <p className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
              Cita
            </p>
            <p className="text-foreground leading-relaxed">{entry.cita}</p>
          </div>

          {/* Datos bibliográficos */}
          {hasData && (
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Datos bibliográficos
              </p>
              <dl className="space-y-1.5">
                {autores.length > 0 && (
                  <div className="grid grid-cols-[112px_1fr] gap-2">
                    <dt className="text-muted-foreground">Autores</dt>
                    <dd>{autores.join('; ')}</dd>
                  </div>
                )}
                {entry.editorial && (
                  <div className="grid grid-cols-[112px_1fr] gap-2">
                    <dt className="text-muted-foreground">Editorial</dt>
                    <dd>{entry.editorial}</dd>
                  </div>
                )}
                {entry.anio && (
                  <div className="grid grid-cols-[112px_1fr] gap-2">
                    <dt className="text-muted-foreground">Año</dt>
                    <dd>{entry.anio}</dd>
                  </div>
                )}
                {entry.isbn && (
                  <div className="grid grid-cols-[112px_1fr] gap-2">
                    <dt className="text-muted-foreground">ISBN</dt>
                    <dd className="font-mono">{entry.isbn}</dd>
                  </div>
                )}
                {entry.formato && (
                  <div className="grid grid-cols-[112px_1fr] gap-2">
                    <dt className="text-muted-foreground">Formato</dt>
                    <dd className="uppercase">{entry.formato}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Procedencia */}
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              Procedencia
            </p>
            {entry.referencia_en_linea ? (
              <div className="flex items-start gap-2">
                <Globe className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <span className="text-foreground">Fuente en línea</span>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {entry.referencia_en_linea}
                  </p>
                </div>
              </div>
            ) : entry.referencia_biblioteca ? (
              <div className="flex items-center gap-2">
                <Library className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="text-foreground">
                  Referencia de biblioteca
                </span>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Captura manual o sin fuente registrada
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

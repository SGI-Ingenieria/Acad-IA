import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import {
  Ban,
  BookOpen,
  Building2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Crown,
  FileText,
  GraduationCap,
  Landmark,
  Loader2,
  Mail,
  Network,
  PanelRightOpen,
  Route,
  ShieldCheck,
  UserCircle,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { construirJerarquia } from './buildJerarquia'
import {
  formatDate,
  getRoleName,
  getRoleNodeLabel,
  getScopeFullLabel,
  getScopeLabel,
  getUsuarioRoles,
  matchesSearch,
} from './usuario-ui'
import { getScopeStyles, getUsuarioStatus } from './usuario-visuals'
import { UsuarioAccionesMenu } from './UsuarioAccionesMenu'
import { UsuarioAvatar } from './UsuarioAvatar'

import type {
  CarreraNodo,
  FacultadNodo,
  MiembroJerarquia,
  ProfesorCarrera,
} from './buildJerarquia'
import type { Rol, Usuario, UsuarioRol } from '@/data/api/usuarios.api'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { FacultadIconPill } from '@/components/shared/FacultadIconPill'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useUsuarioRelaciones } from '@/data/hooks/useUsuarios'
import { formatCarreraNombre, formatFacultadNombre } from '@/lib/facultad-utils'
import { cn } from '@/lib/utils'

gsap.registerPlugin(useGSAP)

export const hierarchyGsap = {
  easeStandard: 'power3.out',
  easeSoft: 'expo.out',
  easeInOut: 'power2.inOut',

  durationFast: 0.16,
  durationBase: 0.28,
  durationSlow: 0.42,

  staggerTiny: 0.025,
  staggerBase: 0.045,

  hoverScale: 1.012,
  selectedScale: 1.018,
}

const ADMIN_SECTION_NODE_ID = 'system-admins'
const ACADEMIC_ROOT_NODE_ID = 'academic-vice-rectory'
const EXTERNAL_NODE_ID = 'external-reviewers'

const ADMIN_ROLE_KEY = 'ADMIN'
const VICERRECTOR_ROLE_KEY = 'VICERRECTOR_ACADEMICO'

type RoleScope = Rol['alcance_default']
type NodeVariant =
  | 'global'
  | 'vicerrectoria'
  | 'faculty'
  | 'career'
  | 'external'

type GlobalRoleKey = typeof ADMIN_ROLE_KEY | typeof VICERRECTOR_ROLE_KEY

type GroupSelection = {
  kind: 'group'
  nodeId: string
  title: string
  roleLabel: string
  scopeLabel: string
  description: string
  pathIds: Array<string>
  pathLabel: Array<string>
  facultad?: { color: string | null; icono: string | null } | null
  stats: Array<{ label: string; value: string }>
  relationships: Array<string>
}

type PersonSelection = {
  kind: 'person'
  nodeId: string
  usuario: Usuario
  roleLabel: string
  scopeLabel: string
  scope: RoleScope
  pathIds: Array<string>
  pathLabel: Array<string>
  facultad?: { color: string | null; icono: string | null } | null
  materias?: number
}

type HierarchySelection = GroupSelection | PersonSelection

type HierarchyViewModel = {
  hasSearch: boolean
  searchTerm: string
  matchedUserCount: number
  matchedNodeIds: Set<string>
  branchMatchIds: Set<string>
  selectableByNodeId: Map<string, HierarchySelection>
  expandableIds: Set<string>
  forceExpandedIds: Set<string>
  renderKey: string
  totals: {
    global: number
    facultades: number
    carreras: number
    profesores: number
    externos: number
  }
}

type UsuariosJerarquiaProps = {
  usuarios: Array<Usuario>
  catalogos: Parameters<typeof construirJerarquia>[1]
  isLoading: boolean
  canManageUsers: boolean
  canManageRoles: boolean
  canManageResponsables: boolean
  searchTerm?: string
  onAssignRole: (usuario: Usuario) => void
  onReasignar: (usuario: Usuario) => void
  onGestionarMaterias: (usuario: Usuario) => void
}

type ActionProps = {
  canManageUsers: boolean
  canManageRoles: boolean
  canManageResponsables: boolean
  onAssignRole: (usuario: Usuario) => void
  onReasignar: (usuario: Usuario) => void
  onGestionarMaterias: (usuario: Usuario) => void
}

export function UsuariosJerarquia({
  usuarios,
  catalogos,
  isLoading,
  canManageUsers,
  canManageRoles,
  canManageResponsables,
  searchTerm = '',
  onAssignRole,
  onReasignar,
  onGestionarMaterias,
}: UsuariosJerarquiaProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1280px)')
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1279px)')
  const reducedMotion = usePrefersReducedMotion()

  const jerarquia = useMemo(
    () => construirJerarquia(usuarios, catalogos),
    [usuarios, catalogos],
  )

  const viewModel = useMemo(
    () => buildHierarchyViewModel(jerarquia, searchTerm),
    [jerarquia, searchTerm],
  )

  const selectedSelection = selectedNodeId
    ? (viewModel.selectableByNodeId.get(selectedNodeId) ?? null)
    : null
  const selectedPathIds = selectedSelection?.pathIds ?? []
  const selectedSelectionNodeId = selectedSelection?.nodeId ?? null

  useEffect(() => {
    setCollapsedIds((current) => {
      const next = new Set<string>()
      current.forEach((id) => {
        if (viewModel.expandableIds.has(id)) next.add(id)
      })
      return next
    })
  }, [viewModel.expandableIds])

  useEffect(() => {
    if (!selectedNodeId) return
    if (!viewModel.selectableByNodeId.has(selectedNodeId)) {
      setSelectedNodeId(null)
    }
  }, [selectedNodeId, viewModel.selectableByNodeId])

  useEffect(() => {
    if (isDesktop || !selectedSelectionNodeId) return
    setDrawerOpen(true)
  }, [isDesktop, selectedSelectionNodeId])

  const toggleExpanded = (nodeId: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const isExpanded = (nodeId: string) =>
    viewModel.forceExpandedIds.has(nodeId) || !collapsedIds.has(nodeId)

  const actionProps = {
    canManageUsers,
    canManageRoles,
    canManageResponsables,
    onAssignRole,
    onReasignar,
    onGestionarMaterias,
  }

  if (isLoading) return <HierarchyLoadingState />

  if (jerarquia.totalMiembros === 0) {
    return <HierarchyEmptyState />
  }

  return (
    <div className="p-control sm:p-grupo relative overflow-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, oklch(from var(--primary) l c h / 0.18), transparent 32%), radial-gradient(circle at 80% 10%, oklch(from var(--chart-4) l c h / 0.14), transparent 30%), radial-gradient(circle at 50% 90%, oklch(from var(--chart-5) l c h / 0.12), transparent 35%)',
        }}
      />

      <div className="gap-grupo relative grid xl:grid-cols-[minmax(0,1fr)_380px]">
        <HierarchyCanvas
          jerarquia={jerarquia}
          viewModel={viewModel}
          actionProps={actionProps}
          selectedNodeId={selectedNodeId}
          selectedPathIds={selectedPathIds}
          reducedMotion={reducedMotion}
          isExpanded={isExpanded}
          onToggleExpanded={toggleExpanded}
          onSelectNode={setSelectedNodeId}
        />

        <div className="hidden xl:block">
          <HierarchyDetailPanel
            selection={selectedSelection}
            reducedMotion={reducedMotion}
            canManageUsers={canManageUsers}
          />
        </div>
      </div>

      {!isDesktop && selectedSelection && (
        <Drawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          direction={isTablet ? 'right' : 'bottom'}
        >
          <DrawerContent className="max-h-[86vh]">
            <DrawerHeader className="pr-pagina relative">
              <DrawerTitle>Detalle del nodo</DrawerTitle>
              <DrawerDescription>
                Rol, alcance y relaciones dentro del mapa académico.
              </DrawerDescription>
              <DrawerClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-3 right-3"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Cerrar detalle</span>
                </Button>
              </DrawerClose>
            </DrawerHeader>
            <div className="px-grupo pb-grupo overflow-y-auto">
              <HierarchyDetailPanel
                selection={selectedSelection}
                reducedMotion={reducedMotion}
                canManageUsers={canManageUsers}
                embedded
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  )
}

// Hijo de un riel CSS tipo organigrama. El riel (vertical + codo) se dibuja
// con pseudo-elementos en `.tree-child` (ver styles.css); `active` resalta en
// primario el segmento que entra al nodo cuando está en la ruta seleccionada.
function TreeChild({
  active,
  className,
  children,
}: {
  active?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn('tree-child', active && 'tree-child--active', className)}
    >
      {children}
    </div>
  )
}

function HierarchyCanvas({
  jerarquia,
  viewModel,
  actionProps,
  selectedNodeId,
  selectedPathIds,
  reducedMotion,
  isExpanded,
  onToggleExpanded,
  onSelectNode,
}: {
  jerarquia: ReturnType<typeof construirJerarquia>
  viewModel: HierarchyViewModel
  actionProps: ActionProps
  selectedNodeId: string | null
  selectedPathIds: Array<string>
  reducedMotion: boolean
  isExpanded: (nodeId: string) => boolean
  onToggleExpanded: (nodeId: string) => void
  onSelectNode: (nodeId: string) => void
}) {
  const treeRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set('.hierarchy-node-card', {
          opacity: 1,
          y: 0,
          clearProps: 'transform',
        })
      })

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          '.hierarchy-node-card',
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            duration: hierarchyGsap.durationSlow,
            ease: hierarchyGsap.easeSoft,
            stagger: hierarchyGsap.staggerBase,
          },
        )
      })

      return () => mm.revert()
    },
    {
      scope: treeRef,
      dependencies: [viewModel.renderKey],
      revertOnUpdate: true,
    },
  )

  const adminExpanded = isExpanded(ADMIN_SECTION_NODE_ID)
  const academicRootExpanded = isExpanded(ACADEMIC_ROOT_NODE_ID)
  const externalExpanded = isExpanded(EXTERNAL_NODE_ID)
  const adminMembers = getGlobalRoleMembers(jerarquia.global, ADMIN_ROLE_KEY)
  const vicerrectorMembers = getGlobalRoleMembers(
    jerarquia.global,
    VICERRECTOR_ROLE_KEY,
  )

  return (
    <section className="border-border/70 bg-card/[0.78] p-control sm:p-grupo relative min-w-0 overflow-hidden rounded-lg border shadow-sm">
      <div className="gap-control pb-grupo relative z-10 flex flex-col border-b md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-primary gap-relacionado flex items-center text-xs font-semibold tracking-wide uppercase">
            <Network className="h-4 w-4" />
            Roles académicos
          </div>
          <h2 className="text-foreground mt-micro text-xl font-bold">
            Jerarquía por rol y alcance
          </h2>
        </div>
      </div>

      {viewModel.hasSearch && (
        <div className="border-primary/20 bg-primary/[0.07] text-foreground mt-control px-control py-relacionado relative z-10 rounded-md border text-sm">
          {viewModel.matchedUserCount > 0 ? (
            <>
              {viewModel.matchedUserCount}{' '}
              {viewModel.matchedUserCount === 1
                ? 'coincidencia resaltada'
                : 'coincidencias resaltadas'}
              . Las ramas relevantes se mantienen abiertas.
            </>
          ) : (
            <>
              Sin coincidencias directas para "{viewModel.searchTerm}". El mapa
              completo se mantiene visible para conservar el contexto.
            </>
          )}
        </div>
      )}

      <div ref={treeRef} className="mt-grupo pb-control relative min-h-[420px]">
        <div className="space-y-seccion">
          <div className="space-y-micro">
            <HierarchyNode
              nodeId={ADMIN_SECTION_NODE_ID}
              variant="global"
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Administradores"
              expandable={adminMembers.length > 0}
              expanded={adminExpanded}
              selected={selectedNodeId === ADMIN_SECTION_NODE_ID}
              inSelectedPath={selectedPathIds.includes(ADMIN_SECTION_NODE_ID)}
              matched={isMatched(ADMIN_SECTION_NODE_ID, viewModel)}
              reducedMotion={reducedMotion}
              onSelect={() => onSelectNode(ADMIN_SECTION_NODE_ID)}
              onToggle={() => onToggleExpanded(ADMIN_SECTION_NODE_ID)}
            />

            {adminMembers.length > 0 && (
              <BranchContent
                expanded={adminExpanded}
                reducedMotion={reducedMotion}
              >
                <div className="tree-branch">
                  {adminMembers.map((miembro) => {
                    const nodeId = globalMemberNodeId(miembro)
                    return (
                      <TreeChild
                        key={nodeId}
                        active={selectedPathIds.includes(nodeId)}
                      >
                        <PersonNode
                          nodeId={nodeId}
                          usuario={miembro.usuario}
                          selected={selectedNodeId === nodeId}
                          inSelectedPath={selectedPathIds.includes(nodeId)}
                          matched={isMatched(nodeId, viewModel)}
                          variant="global"
                          reducedMotion={reducedMotion}
                          onSelect={() => onSelectNode(nodeId)}
                          {...actionProps}
                        />
                      </TreeChild>
                    )
                  })}
                </div>
              </BranchContent>
            )}
          </div>

          <div className="space-y-micro">
            <HierarchyNode
              nodeId={ACADEMIC_ROOT_NODE_ID}
              variant="vicerrectoria"
              icon={<Landmark className="h-4 w-4" />}
              title="Vicerrectoría Académica"
              expandable
              expanded={academicRootExpanded}
              selected={selectedNodeId === ACADEMIC_ROOT_NODE_ID}
              inSelectedPath={selectedPathIds.includes(ACADEMIC_ROOT_NODE_ID)}
              matched={isMatched(ACADEMIC_ROOT_NODE_ID, viewModel)}
              reducedMotion={reducedMotion}
              onSelect={() => onSelectNode(ACADEMIC_ROOT_NODE_ID)}
              onToggle={() => onToggleExpanded(ACADEMIC_ROOT_NODE_ID)}
            />

            <BranchContent
              expanded={academicRootExpanded}
              reducedMotion={reducedMotion}
            >
              <div className="tree-branch">
                {vicerrectorMembers.map((miembro) => {
                  const nodeId = globalMemberNodeId(miembro)
                  return (
                    <TreeChild
                      key={nodeId}
                      active={selectedPathIds.includes(nodeId)}
                    >
                      <PersonNode
                        nodeId={nodeId}
                        usuario={miembro.usuario}
                        selected={selectedNodeId === nodeId}
                        inSelectedPath={selectedPathIds.includes(nodeId)}
                        matched={isMatched(nodeId, viewModel)}
                        variant="vicerrectoria"
                        reducedMotion={reducedMotion}
                        onSelect={() => onSelectNode(nodeId)}
                        {...actionProps}
                      />
                    </TreeChild>
                  )
                })}

                {jerarquia.facultades.length === 0 ? (
                  <TreeChild>
                    <p className="text-muted-foreground px-control py-relacionado rounded-md border border-dashed text-sm">
                      Aun no hay facultades o programas dentro de la jerarquia.
                    </p>
                  </TreeChild>
                ) : (
                  jerarquia.facultades.map((facultad) => (
                    <TreeChild
                      key={facultad.id}
                      active={selectedPathIds.includes(facultyNodeId(facultad))}
                    >
                      <FacultyNode
                        facultad={facultad}
                        selectedNodeId={selectedNodeId}
                        selectedPathIds={selectedPathIds}
                        viewModel={viewModel}
                        reducedMotion={reducedMotion}
                        isExpanded={isExpanded}
                        onToggleExpanded={onToggleExpanded}
                        onSelectNode={onSelectNode}
                        actionProps={actionProps}
                      />
                    </TreeChild>
                  ))
                )}
              </div>
            </BranchContent>
          </div>

          <div className="space-y-micro">
            <HierarchyNode
              nodeId={EXTERNAL_NODE_ID}
              variant="external"
              icon={<UserCircle className="h-4 w-4" />}
              eyebrow="Externos"
              title="Evaluadores y expertos invitados"
              expandable={jerarquia.externos.length > 0}
              expanded={externalExpanded}
              selected={selectedNodeId === EXTERNAL_NODE_ID}
              inSelectedPath={selectedPathIds.includes(EXTERNAL_NODE_ID)}
              matched={isMatched(EXTERNAL_NODE_ID, viewModel)}
              reducedMotion={reducedMotion}
              onSelect={() => onSelectNode(EXTERNAL_NODE_ID)}
              onToggle={() => onToggleExpanded(EXTERNAL_NODE_ID)}
            />

            {jerarquia.externos.length > 0 ? (
              <BranchContent
                expanded={externalExpanded}
                reducedMotion={reducedMotion}
              >
                <div className="tree-branch">
                  {jerarquia.externos.map((miembro) => {
                    const nodeId = externalMemberNodeId(miembro)
                    return (
                      <TreeChild
                        key={nodeId}
                        active={selectedPathIds.includes(nodeId)}
                      >
                        <PersonNode
                          nodeId={nodeId}
                          usuario={miembro.usuario}
                          selected={selectedNodeId === nodeId}
                          inSelectedPath={selectedPathIds.includes(nodeId)}
                          matched={isMatched(nodeId, viewModel)}
                          variant="external"
                          reducedMotion={reducedMotion}
                          onSelect={() => onSelectNode(nodeId)}
                          {...actionProps}
                        />
                      </TreeChild>
                    )
                  })}
                </div>
              </BranchContent>
            ) : (
              <p className="text-muted-foreground ml-region px-control py-relacionado rounded-md border border-dashed text-sm">
                Aun no hay expertos externos en la jerarquia.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// Grupo de personas embebido dentro de una tarjeta de facultad/carrera, bajo un
// rótulo (p. ej. "Dirección de la facultad"). No dibuja conectores: los miembros
// forman parte visual del nodo contenedor.
// Figura de liderazgo integrada en el encabezado de una facultad/carrera. No
// es una sub-tarjeta: es una fila-figura (avatar + nombre + chip de rol) que
// comunica "esta persona dirige esta unidad". Sigue siendo seleccionable.
function LeaderRow({
  nodeId,
  usuario,
  roleLabel,
  roleClave,
  accent,
  selected,
  inSelectedPath,
  matched,
  onSelect,
  canManageUsers,
  onAssignRole,
  onReasignar,
  onGestionarMaterias,
}: {
  nodeId: string
  usuario: Usuario
  roleLabel: string
  roleClave?: string
  accent: 'faculty' | 'head'
  selected: boolean
  inSelectedPath: boolean
  matched: boolean
  onSelect: () => void
} & ActionProps) {
  const status = getUsuarioStatus(usuario)
  const isBaja = status.key === 'baja'
  const RoleIcon = getLeaderRoleIcon(roleClave)

  return (
    <div
      data-hierarchy-node-id={nodeId}
      className={cn(
        // Mini-tarjeta de líder: tinte de acento siempre visible + barra de
        // acento a la izquierda, para que dirección/secretaría/jefatura resalten
        // como figuras de mando dentro de la tarjeta contenedora.
        'gap-control px-control py-control relative flex items-center rounded-lg border-l-[3px] shadow-xs transition-colors',
        leaderCardClasses[accent],
        inSelectedPath && !selected && 'bg-primary/8',
        matched && !selected && 'bg-primary/10',
        selected && 'ring-primary/40 bg-primary/10 ring-1',
        isBaja && !selected && 'opacity-60 grayscale',
      )}
    >
      {/* El avatar va fuera del botón de selección porque, siendo editable,
          contiene su propio control interactivo (subir foto). */}
      <UsuarioAvatar
        userId={usuario.id}
        nombre={usuario.nombre_completo}
        editable={canManageUsers}
        className={cn('h-11 w-11 ring-2', leaderAvatarRingClasses[accent])}
        fallbackClassName={leaderAvatarClasses[accent]}
        status={{ dotClass: status.dotClass, pulse: status.pulse }}
      />

      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Ver detalle de ${usuario.nombre_completo ?? 'usuario sin nombre'}`}
        className="focus-visible:ring-ring/60 gap-control flex min-w-0 flex-1 cursor-pointer items-center rounded-md text-left outline-none focus-visible:ring-2"
      >
        <span className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-sm font-bold">
            {usuario.nombre_completo ?? 'Sin nombre'}
          </span>
          <span className="text-muted-foreground block truncate text-xs">
            {usuario.email ?? 'Sin correo'}
          </span>
          <Badge
            variant="outline"
            className={cn(
              'mt-relacionado gap-micro px-relacionado py-micro inline-flex items-center rounded-full text-[11px] font-semibold tracking-wide uppercase',
              leaderChipClasses[accent],
            )}
          >
            <RoleIcon className="h-3 w-3" aria-hidden />
            {roleLabel}
          </Badge>
        </span>
      </button>

      <UsuarioAccionesMenu
        usuario={usuario}
        canManageUsers={
          usuario.gestion.puede_dar_baja ||
          usuario.gestion.puede_reactivar ||
          usuario.gestion.puede_reenviar_invitacion
        }
        canManageRoles={usuario.gestion.puede_asignar_roles}
        canReasignar={usuario.gestion.puede_reasignar}
        canManageResponsables={usuario.gestion.puede_gestionar_materias}
        onAssignRole={onAssignRole}
        onReasignar={onReasignar}
        onGestionarMaterias={onGestionarMaterias}
      />
    </div>
  )
}

function FacultyNode({
  facultad,
  selectedNodeId,
  selectedPathIds,
  viewModel,
  reducedMotion,
  isExpanded,
  onToggleExpanded,
  onSelectNode,
  actionProps,
}: {
  facultad: FacultadNodo
  selectedNodeId: string | null
  selectedPathIds: Array<string>
  viewModel: HierarchyViewModel
  reducedMotion: boolean
  isExpanded: (nodeId: string) => boolean
  onToggleExpanded: (nodeId: string) => void
  onSelectNode: (nodeId: string) => void
  actionProps: ActionProps
}) {
  const nodeId = facultyNodeId(facultad)
  const expanded = isExpanded(nodeId)

  // Líderes ordenados por jerarquía: dirección, secretaría y luego el resto.
  const lideres = [...facultad.miembros].sort(
    (a, b) =>
      leaderOrder(a.asignacion.roles?.clave) -
      leaderOrder(b.asignacion.roles?.clave),
  )

  return (
    <div className="space-y-micro">
      <HierarchyNode
        nodeId={nodeId}
        variant="faculty"
        icon={
          <FacultadIconPill
            facultad={{ color: facultad.color, icono: facultad.icono }}
          />
        }
        title={getFacultyDisplayName(facultad)}
        accentColor={facultad.color}
        expandable
        expanded={expanded}
        selected={selectedNodeId === nodeId}
        inSelectedPath={selectedPathIds.includes(nodeId)}
        matched={isMatched(nodeId, viewModel)}
        reducedMotion={reducedMotion}
        onSelect={() => onSelectNode(nodeId)}
        onToggle={() => onToggleExpanded(nodeId)}
      >
        {lideres.length === 0 ? (
          <p className="text-muted-foreground px-control py-relacionado rounded-md border border-dashed text-xs">
            Sin dirección ni secretaría académica asignadas.
          </p>
        ) : (
          <div className="space-y-relacionado">
            {lideres.map((miembro) => {
              const memberNodeId = facultyMemberNodeId(facultad, miembro)
              return (
                <LeaderRow
                  key={memberNodeId}
                  nodeId={memberNodeId}
                  usuario={miembro.usuario}
                  roleLabel={getLeaderRoleLabel(miembro.asignacion)}
                  roleClave={miembro.asignacion.roles?.clave ?? undefined}
                  accent="faculty"
                  selected={selectedNodeId === memberNodeId}
                  inSelectedPath={selectedPathIds.includes(memberNodeId)}
                  matched={isMatched(memberNodeId, viewModel)}
                  onSelect={() => onSelectNode(memberNodeId)}
                  {...actionProps}
                />
              )
            })}
          </div>
        )}
      </HierarchyNode>

      <BranchContent expanded={expanded} reducedMotion={reducedMotion}>
        <div className="tree-branch">
          {facultad.carreras.map((carrera) => (
            <TreeChild
              key={carrera.id}
              active={selectedPathIds.includes(careerNodeId(carrera))}
            >
              <CareerNode
                facultad={facultad}
                carrera={carrera}
                selectedNodeId={selectedNodeId}
                selectedPathIds={selectedPathIds}
                viewModel={viewModel}
                reducedMotion={reducedMotion}
                isExpanded={isExpanded}
                onToggleExpanded={onToggleExpanded}
                onSelectNode={onSelectNode}
                actionProps={actionProps}
              />
            </TreeChild>
          ))}
        </div>
      </BranchContent>
    </div>
  )
}

function CareerNode({
  facultad,
  carrera,
  selectedNodeId,
  selectedPathIds,
  viewModel,
  reducedMotion,
  isExpanded,
  onToggleExpanded,
  onSelectNode,
  actionProps,
}: {
  facultad: FacultadNodo
  carrera: CarreraNodo
  selectedNodeId: string | null
  selectedPathIds: Array<string>
  viewModel: HierarchyViewModel
  reducedMotion: boolean
  isExpanded: (nodeId: string) => boolean
  onToggleExpanded: (nodeId: string) => void
  onSelectNode: (nodeId: string) => void
  actionProps: ActionProps
}) {
  const nodeId = careerNodeId(carrera)
  const expanded = isExpanded(nodeId)

  return (
    <div className="space-y-micro">
      <HierarchyNode
        nodeId={nodeId}
        variant="career"
        icon={<GraduationCap className="h-4 w-4" />}
        title={formatCarreraNombre(carrera)}
        expandable
        expanded={expanded}
        selected={selectedNodeId === nodeId}
        inSelectedPath={selectedPathIds.includes(nodeId)}
        matched={isMatched(nodeId, viewModel)}
        reducedMotion={reducedMotion}
        onSelect={() => onSelectNode(nodeId)}
        onToggle={() => onToggleExpanded(nodeId)}
      >
        {carrera.miembros.length === 0 ? (
          <p className="text-muted-foreground px-control py-relacionado rounded-md border border-dashed text-xs">
            Sin jefatura de carrera asignada.
          </p>
        ) : (
          <div className="space-y-relacionado">
            {carrera.miembros.map((miembro) => {
              const memberNodeId = careerMemberNodeId(carrera, miembro)
              return (
                <LeaderRow
                  key={memberNodeId}
                  nodeId={memberNodeId}
                  usuario={miembro.usuario}
                  roleLabel={getLeaderRoleLabel(miembro.asignacion)}
                  roleClave={miembro.asignacion.roles?.clave ?? undefined}
                  accent="head"
                  selected={selectedNodeId === memberNodeId}
                  inSelectedPath={selectedPathIds.includes(memberNodeId)}
                  matched={isMatched(memberNodeId, viewModel)}
                  onSelect={() => onSelectNode(memberNodeId)}
                  {...actionProps}
                />
              )
            })}
          </div>
        )}
      </HierarchyNode>

      <BranchContent expanded={expanded} reducedMotion={reducedMotion}>
        {carrera.profesores.length > 0 ? (
          <div className="tree-branch">
            {carrera.profesores.map((profesor) => {
              const professorNodeId = professorNodeIdFor(carrera, profesor)
              return (
                <TreeChild
                  key={professorNodeId}
                  active={selectedPathIds.includes(professorNodeId)}
                >
                  <PersonNode
                    nodeId={professorNodeId}
                    usuario={profesor.usuario}
                    materias={profesor.materias}
                    selected={selectedNodeId === professorNodeId}
                    inSelectedPath={selectedPathIds.includes(professorNodeId)}
                    matched={isMatched(professorNodeId, viewModel)}
                    variant="professor"
                    reducedMotion={reducedMotion}
                    onSelect={() => onSelectNode(professorNodeId)}
                    {...actionProps}
                  />
                </TreeChild>
              )
            })}
          </div>
        ) : (
          <TreeChild>
            <p className="text-muted-foreground px-control py-relacionado rounded-md border border-dashed text-sm">
              Sin profesores responsables registrados en{' '}
              {getFacultyDisplayName(facultad)}.
            </p>
          </TreeChild>
        )}
      </BranchContent>
    </div>
  )
}

function HierarchyNode({
  nodeId,
  variant,
  icon,
  eyebrow,
  title,
  expandable,
  expanded = false,
  selected,
  inSelectedPath,
  matched,
  reducedMotion,
  accentColor,
  onSelect,
  onToggle,
  children,
}: {
  nodeId: string
  variant: NodeVariant
  icon: ReactNode
  eyebrow?: string
  title: string
  expandable?: boolean
  expanded?: boolean
  selected: boolean
  inSelectedPath: boolean
  matched: boolean
  reducedMotion: boolean
  // Color propio de la facultad: barra de acento a la izquierda de la tarjeta.
  accentColor?: string | null
  onSelect: () => void
  onToggle?: () => void
  // Contenido embebido dentro de la tarjeta (p. ej. dirección/secretaría de una
  // facultad o la jefatura de una carrera), bajo el encabezado.
  children?: ReactNode
}) {
  const nodeRef = useRef<HTMLDivElement>(null)
  const chevronRef = useRef<SVGSVGElement>(null)
  const { contextSafe } = useGSAP({ scope: nodeRef })
  const hasEyebrow = eyebrow !== undefined

  useGSAP(
    () => {
      if (!chevronRef.current || !expandable) return
      gsap.to(chevronRef.current, {
        rotate: expanded ? 90 : 0,
        transformOrigin: '50% 50%',
        duration: reducedMotion ? 0 : hierarchyGsap.durationBase,
        ease: hierarchyGsap.easeInOut,
      })
    },
    { scope: nodeRef, dependencies: [expanded, expandable, reducedMotion] },
  )

  const handleMouseEnter = contextSafe(() => {
    if (reducedMotion || !nodeRef.current) return
    gsap.to(nodeRef.current, {
      scale: hierarchyGsap.hoverScale,
      duration: hierarchyGsap.durationFast,
      ease: hierarchyGsap.easeStandard,
    })
  })

  const handleMouseLeave = contextSafe(() => {
    if (reducedMotion || !nodeRef.current) return
    gsap.to(nodeRef.current, {
      scale: 1,
      duration: hierarchyGsap.durationFast,
      ease: hierarchyGsap.easeStandard,
    })
  })

  const animateSelect = contextSafe(() => {
    if (reducedMotion || !nodeRef.current) return
    gsap
      .timeline()
      .to(nodeRef.current, {
        scale: hierarchyGsap.selectedScale,
        duration: 0.12,
        ease: hierarchyGsap.easeStandard,
      })
      .to(nodeRef.current, {
        scale: 1,
        duration: 0.12,
        ease: hierarchyGsap.easeStandard,
      })
  })

  const handleSelect = () => {
    onSelect()
    animateSelect()
  }

  return (
    <div
      ref={nodeRef}
      data-hierarchy-node-id={nodeId}
      className={cn(
        'hierarchy-node-card border-border bg-card/[0.86] relative flex min-h-20 flex-col rounded-lg border shadow-xs will-change-transform outline-none',
        nodeVariantClasses[variant],
        accentColor && 'border-l-[3px]',
        selected && 'border-primary/60 ring-primary/30 bg-card ring-2',
        inSelectedPath && !selected && 'border-primary/45 bg-primary/[0.055]',
        matched && 'border-primary/60 bg-primary/10',
      )}
      style={
        accentColor && !selected ? { borderLeftColor: accentColor } : undefined
      }
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={handleSelect}
          className={cn(
            'focus-visible:ring-ring/60 gap-control p-control sm:p-grupo flex min-w-0 flex-1 cursor-pointer rounded-lg text-left outline-none focus-visible:ring-2',
            // Sin eyebrow el título se centra con el icono; con eyebrow se
            // alinean por arriba para que el rótulo encabece la tarjeta.
            hasEyebrow ? 'items-start' : 'items-center',
          )}
          aria-pressed={selected}
        >
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
              hasEyebrow && 'mt-micro',
              nodeIconClasses[variant],
            )}
          >
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            {hasEyebrow && (
              <span className="text-muted-foreground block text-[11px] font-semibold tracking-wide uppercase">
                {eyebrow}
              </span>
            )}
            <span
              className={cn(
                'text-foreground block text-sm leading-snug font-bold sm:text-base',
                hasEyebrow && 'mt-micro',
              )}
            >
              {title}
            </span>
          </span>
          {matched && (
            <Badge className="bg-primary text-primary-foreground hidden shrink-0 md:inline-flex">
              Coincidencia
            </Badge>
          )}
        </button>

        {expandable && onToggle && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggle()
            }}
            className="focus-visible:ring-ring/60 text-muted-foreground hover:text-foreground mr-relacionado flex min-h-10 min-w-10 items-center justify-center self-center rounded-md outline-none focus-visible:ring-2"
            aria-label={expanded ? `Colapsar ${title}` : `Expandir ${title}`}
            aria-expanded={expanded}
          >
            <ChevronRight ref={chevronRef} className="h-4 w-4" />
          </button>
        )}
      </div>

      {children && (
        <div className="border-border/70 px-control pt-control pb-control sm:px-grupo border-t">
          {children}
        </div>
      )}
    </div>
  )
}

function PersonNode({
  nodeId,
  usuario,
  materias,
  variant,
  selected,
  inSelectedPath,
  matched,
  reducedMotion,
  onSelect,
  onAssignRole,
  onReasignar,
  onGestionarMaterias,
}: {
  nodeId: string
  usuario: Usuario
  materias?: number
  variant:
    | 'global'
    | 'vicerrectoria'
    | 'faculty'
    | 'head'
    | 'professor'
    | 'external'
  selected: boolean
  inSelectedPath: boolean
  matched: boolean
  reducedMotion: boolean
  onSelect: () => void
} & ActionProps) {
  const nodeRef = useRef<HTMLDivElement>(null)
  const { contextSafe } = useGSAP({ scope: nodeRef })
  const status = getUsuarioStatus(usuario)
  const isBaja = status.key === 'baja'

  const handleMouseEnter = contextSafe(() => {
    if (reducedMotion || !nodeRef.current) return
    gsap.to(nodeRef.current, {
      scale: hierarchyGsap.hoverScale,
      duration: hierarchyGsap.durationFast,
      ease: hierarchyGsap.easeStandard,
    })
  })

  const handleMouseLeave = contextSafe(() => {
    if (reducedMotion || !nodeRef.current) return
    gsap.to(nodeRef.current, {
      scale: 1,
      duration: hierarchyGsap.durationFast,
      ease: hierarchyGsap.easeStandard,
    })
  })

  const animateSelect = contextSafe(() => {
    if (reducedMotion || !nodeRef.current) return
    gsap
      .timeline()
      .to(nodeRef.current, {
        scale: hierarchyGsap.selectedScale,
        duration: 0.12,
        ease: hierarchyGsap.easeStandard,
      })
      .to(nodeRef.current, {
        scale: 1,
        duration: 0.12,
        ease: hierarchyGsap.easeStandard,
      })
  })

  const handleSelect = () => {
    onSelect()
    animateSelect()
  }

  return (
    <div
      ref={nodeRef}
      data-hierarchy-node-id={nodeId}
      className={cn(
        'hierarchy-node-card border-border bg-background/[0.82] gap-relacionado p-relacionado relative flex min-h-16 items-center rounded-lg border shadow-xs will-change-transform',
        personVariantClasses[variant],
        selected && 'border-primary/60 ring-primary/30 bg-card ring-2',
        inSelectedPath && !selected && 'border-primary/45 bg-primary/[0.055]',
        matched && 'border-primary/60 bg-primary/10',
        isBaja && !selected && 'opacity-60 grayscale',
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={handleSelect}
        className="focus-visible:ring-ring/60 gap-control p-micro flex min-w-0 flex-1 cursor-pointer items-center rounded-md text-left outline-none focus-visible:ring-2"
        aria-pressed={selected}
        aria-label={`Ver detalle de ${
          usuario.nombre_completo ?? 'usuario sin nombre'
        }`}
      >
        <UsuarioAvatar
          userId={usuario.id}
          nombre={usuario.nombre_completo}
          className="h-10 w-10"
          fallbackClassName="bg-primary/10 text-primary"
          status={{ dotClass: status.dotClass, pulse: status.pulse }}
        />

        <span className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-sm font-semibold">
            {usuario.nombre_completo ?? 'Sin nombre'}
          </span>
          <span className="text-muted-foreground block truncate text-xs">
            {usuario.email ?? 'Sin correo'}
          </span>
          <span className="mt-micro gap-relacionado flex min-w-0 flex-wrap items-center">
            {typeof materias === 'number' && (
              <Badge variant="outline" className="h-5 rounded-full text-[10px]">
                {materias} {materias === 1 ? 'materia' : 'materias'}
              </Badge>
            )}
          </span>
        </span>
      </button>

      <div className="gap-micro flex shrink-0 items-center">
        {matched && (
          <span className="bg-primary h-2 w-2 rounded-full" aria-hidden />
        )}
        <UsuarioAccionesMenu
          usuario={usuario}
          canManageUsers={
            usuario.gestion.puede_dar_baja ||
            usuario.gestion.puede_reactivar ||
            usuario.gestion.puede_reenviar_invitacion
          }
          canManageRoles={usuario.gestion.puede_asignar_roles}
          canReasignar={usuario.gestion.puede_reasignar}
          canManageResponsables={usuario.gestion.puede_gestionar_materias}
          onAssignRole={onAssignRole}
          onReasignar={onReasignar}
          onGestionarMaterias={onGestionarMaterias}
        />
      </div>
    </div>
  )
}

function HierarchyDetailPanel({
  selection,
  reducedMotion,
  canManageUsers,
  embedded = false,
}: {
  selection: HierarchySelection | null
  reducedMotion: boolean
  canManageUsers: boolean
  embedded?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const usuario = selection?.kind === 'person' ? selection.usuario : null
  const { data: relaciones, isLoading: relacionesLoading } =
    useUsuarioRelaciones(usuario?.id ?? null)

  useGSAP(
    () => {
      if (!panelRef.current || !selection) return
      if (reducedMotion) {
        gsap.set(panelRef.current, { opacity: 1, x: 0 })
        return
      }
      gsap.fromTo(
        panelRef.current,
        { opacity: 0, x: 24 },
        {
          opacity: 1,
          x: 0,
          duration: 0.32,
          ease: hierarchyGsap.easeSoft,
        },
      )
    },
    {
      scope: panelRef,
      dependencies: [selection?.nodeId, reducedMotion],
      revertOnUpdate: true,
    },
  )

  if (!selection) {
    return (
      <aside className="border-border/70 bg-card/[0.82] text-muted-foreground gap-control p-seccion flex h-full min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed text-center text-sm">
        <PanelRightOpen className="h-10 w-10" />
        <p>
          Selecciona un nodo o usuario para ver su rol, alcance y relaciones.
        </p>
      </aside>
    )
  }

  if (selection.kind === 'group') {
    return (
      <aside
        ref={panelRef}
        className={cn(
          'hierarchy-detail-panel border-border/70 bg-card/90 space-y-grupo p-grupo rounded-lg border shadow-sm',
          !embedded &&
            'sticky top-20 max-h-[calc(100vh-6rem)] self-start overflow-y-auto',
        )}
      >
        <DetailHeader
          title={selection.title}
          badge={selection.scopeLabel}
          subtitle={selection.description}
          pathLabel={selection.pathLabel}
          facultad={selection.facultad}
        />

        <div className="gap-relacionado grid sm:grid-cols-2 xl:grid-cols-1">
          <DetailMetric
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Rol del nodo"
            value={selection.roleLabel}
            helper={selection.scopeLabel}
          />
          <DetailMetric
            icon={<Route className="h-4 w-4" />}
            title="Alcance"
            value={selection.pathLabel.join(' / ')}
          />
        </div>

        <div className="gap-relacionado grid grid-cols-2">
          {selection.stats.map((stat) => (
            <div
              key={stat.label}
              className="border-border/70 bg-muted/30 px-control py-relacionado rounded-md border"
            >
              <p className="text-muted-foreground text-xs">{stat.label}</p>
              <p className="text-foreground text-lg font-bold">{stat.value}</p>
            </div>
          ))}
        </div>
      </aside>
    )
  }

  const roles = getUsuarioRoles(selection.usuario)
  const status = getUsuarioStatus(selection.usuario)
  const planes = Array.isArray(relaciones?.planes) ? relaciones.planes : []
  const materias = Array.isArray(relaciones?.materias)
    ? relaciones.materias
    : []
  const invitados = Array.isArray(relaciones?.invitados)
    ? relaciones.invitados
    : []

  const isBaja = status.key === 'baja'
  const isPendiente = status.key === 'pendiente'
  const hasRelaciones =
    relacionesLoading ||
    planes.length > 0 ||
    materias.length > 0 ||
    invitados.length > 0

  return (
    <aside
      ref={panelRef}
      className={cn(
        'hierarchy-detail-panel border-border/70 bg-card/90 space-y-grupo p-grupo overflow-hidden rounded-lg border shadow-sm',
        !embedded &&
          'sticky top-20 max-h-[calc(100vh-6rem)] self-start overflow-y-auto',
      )}
    >
      {/* Listón de estado: solo cuando el usuario está dado de baja. */}
      {isBaja && (
        <div className="border-destructive/25 bg-destructive/10 text-destructive -mx-grupo -mt-grupo mb-micro gap-relacionado px-grupo py-relacionado flex items-center border-b text-xs font-semibold">
          <Ban className="h-3.5 w-3.5 shrink-0" />
          Usuario dado de baja el{' '}
          {formatDate(selection.usuario.dado_de_baja_en)}
        </div>
      )}

      <DetailHeader
        title={selection.usuario.nombre_completo ?? 'Sin nombre'}
        badge={selection.usuario.externo ? 'Externo' : 'Interno'}
        subtitle={selection.usuario.email ?? 'Sin correo'}
        pathLabel={selection.pathLabel}
        facultad={selection.facultad}
        avatar={
          <UsuarioAvatar
            userId={selection.usuario.id}
            nombre={selection.usuario.nombre_completo}
            editable={canManageUsers}
            className="h-14 w-14"
            fallbackClassName="bg-primary/10 text-primary text-lg"
          />
        }
      />

      <div className="gap-control flex flex-wrap items-center">
        {isPendiente && (
          <span
            className={cn(
              'gap-relacionado px-relacionado py-micro inline-flex items-center rounded-full border text-xs font-medium',
              status.badgeClass,
            )}
          >
            {status.label}
          </span>
        )}
        <span className="text-muted-foreground gap-micro flex items-center text-xs">
          <Clock className="h-3 w-3" />
          Registro: {formatDate(selection.usuario.creado_en)}
        </span>
      </div>

      <DetailMetric
        icon={<ShieldCheck className="h-4 w-4" />}
        title="Rol en este nodo"
        value={selection.roleLabel}
        helper={
          selection.scope === 'asignatura' ? selection.scopeLabel : undefined
        }
      />

      <div className="space-y-relacionado">
        <p className="text-foreground gap-relacionado flex items-center text-sm font-medium">
          <Building2 className="h-4 w-4" />
          Roles y alcances
        </p>
        {roles.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin rol asignado.</p>
        ) : (
          <div className="gap-relacionado flex flex-wrap">
            {roles.map((asignacion) => (
              <Badge
                key={asignacion.id}
                variant="secondary"
                title={getScopeFullLabel(asignacion) ?? undefined}
                className={cn(
                  'gap-relacionado flex max-w-full min-w-0 items-center rounded-md border',
                  getScopeStyles(asignacion.roles?.alcance_default),
                )}
              >
                <ShieldCheck className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {getRoleName(asignacion)}
                  <span className="opacity-70">
                    {' · '}
                    {getScopeLabel(asignacion)}
                  </span>
                </span>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Relaciones: cada sección solo aparece si tiene elementos (o está
          cargando). Si no hay ninguna, el bloque entero se omite. */}
      {hasRelaciones && (
        <div className="space-y-control pt-control border-t">
          {(relacionesLoading || planes.length > 0) && (
            <SeccionRelacion
              icon={<FileText className="h-4 w-4" />}
              titulo="Planes en los que participa"
              loading={relacionesLoading}
              isEmpty={planes.length === 0}
              emptyText=""
            >
              {planes.map((plan) => (
                <div
                  key={plan.plan_estudio_id}
                  className="border-border/70 bg-background/65 px-control py-relacionado rounded-md border"
                >
                  <div className="gap-relacionado flex items-center justify-between">
                    <span className="text-foreground truncate text-sm">
                      {plan.plan_nombre ?? 'Plan sin nombre'}
                    </span>
                    <Badge
                      variant={plan.origen === 'dueño' ? 'default' : 'outline'}
                      className="shrink-0 text-[10px]"
                    >
                      {plan.origen === 'dueño' ? 'Dueño' : 'En revisión'}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {[plan.carrera_nombre, plan.estatus]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              ))}
            </SeccionRelacion>
          )}

          {(relacionesLoading || materias.length > 0) && (
            <SeccionRelacion
              icon={<BookOpen className="h-4 w-4" />}
              titulo="Materias donde es responsable"
              loading={relacionesLoading}
              isEmpty={materias.length === 0}
              emptyText=""
            >
              {materias.map((materia) => (
                <div
                  key={materia.responsable_id}
                  className="border-border/70 bg-background/65 px-control py-relacionado rounded-md border"
                >
                  <div className="gap-relacionado flex items-center justify-between">
                    <span className="text-foreground truncate text-sm">
                      {materia.asignatura_nombre ?? 'Materia sin nombre'}
                    </span>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {ROL_RESPONSABLE_LABEL[materia.rol] ?? materia.rol}
                    </Badge>
                  </div>
                  {materia.plan_nombre && (
                    <p className="text-muted-foreground truncate text-xs">
                      {materia.plan_nombre}
                    </p>
                  )}
                </div>
              ))}
            </SeccionRelacion>
          )}

          {(relacionesLoading || invitados.length > 0) && (
            <SeccionRelacion
              icon={<UserCircle className="h-4 w-4" />}
              titulo="Expertos invitados"
              loading={relacionesLoading}
              isEmpty={invitados.length === 0}
              emptyText=""
            >
              {invitados.map((invitado) => (
                <div
                  key={invitado.id}
                  className="border-border/70 bg-background/65 gap-relacionado px-control py-relacionado flex items-center justify-between rounded-md border"
                >
                  <span className="text-foreground truncate text-sm">
                    {invitado.nombre_completo ?? 'Sin nombre'}
                  </span>
                  {invitado.dado_de_baja_en && (
                    <Badge
                      variant="destructive"
                      className="shrink-0 text-[10px]"
                    >
                      Baja
                    </Badge>
                  )}
                </div>
              ))}
            </SeccionRelacion>
          )}
        </div>
      )}
    </aside>
  )
}

function DetailHeader({
  title,
  badge,
  subtitle,
  pathLabel,
  facultad,
  avatar,
}: {
  title: string
  badge: string
  subtitle: string
  pathLabel: Array<string>
  facultad?: { color: string | null; icono: string | null } | null
  avatar?: ReactNode
}) {
  return (
    <div className="space-y-relacionado">
      <DetailBreadcrumbs pathLabel={pathLabel} facultad={facultad} />
      <div className="gap-control flex items-start">
        {avatar}
        <div className="space-y-relacionado min-w-0 flex-1">
          <div className="gap-relacionado flex items-start justify-between">
            <h3 className="text-foreground text-base leading-snug font-semibold">
              {title}
            </h3>
            <Badge variant="outline" className="shrink-0">
              {badge}
            </Badge>
          </div>
          <p className="text-muted-foreground gap-relacionado flex items-center text-sm">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{subtitle}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

// Migaja de pan con la ruta hasta el nodo (sin incluirlo a él, ya que es el
// título). La facultad —cuando es ancestro— se muestra con su icono y color.
function DetailBreadcrumbs({
  pathLabel,
  facultad,
}: {
  pathLabel: Array<string>
  facultad?: { color: string | null; icono: string | null } | null
}) {
  const trail = pathLabel.slice(0, -1)
  if (trail.length === 0) return null

  return (
    <nav
      aria-label="Ruta en la jerarquía"
      className="text-muted-foreground gap-x-micro gap-y-micro flex flex-wrap items-center text-xs"
    >
      {trail.map((label, index) => {
        const isFaculty = index === 1 && !!facultad
        return (
          <span
            key={`${index}-${label}`}
            className="flex max-w-full items-center"
          >
            {index > 0 && (
              <ChevronRight className="text-muted-foreground/50 mx-micro h-3 w-3 shrink-0" />
            )}
            <span className="gap-micro flex min-w-0 items-center">
              {isFaculty && <FacultadIconPill facultad={facultad} />}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="max-w-56 truncate">{label}</span>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            </span>
          </span>
        )
      })}
    </nav>
  )
}

function DetailMetric({
  icon,
  title,
  value,
  helper,
}: {
  icon: ReactNode
  title: string
  value: string
  helper?: string
}) {
  return (
    <div className="border-border/70 bg-muted/25 px-control py-relacionado rounded-md border">
      <p className="text-muted-foreground gap-relacionado flex items-center text-xs">
        {icon}
        {title}
      </p>
      <p className="text-foreground mt-micro text-sm font-semibold">{value}</p>
      {helper && (
        <p className="text-muted-foreground mt-micro text-xs">{helper}</p>
      )}
    </div>
  )
}

function BranchContent({
  expanded,
  reducedMotion,
  className,
  children,
}: {
  expanded: boolean
  reducedMotion: boolean
  className?: string
  children: ReactNode
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const didMountRef = useRef(false)
  const [mounted, setMounted] = useState(expanded)

  useEffect(() => {
    if (expanded) setMounted(true)
  }, [expanded])

  useGSAP(
    () => {
      const element = contentRef.current
      if (!element) return

      if (!didMountRef.current) {
        didMountRef.current = true
        gsap.set(element, {
          height: expanded ? 'auto' : 0,
          opacity: expanded ? 1 : 0,
          y: 0,
          overflow: 'hidden',
        })
        if (!expanded) setMounted(false)
        return
      }

      if (reducedMotion) {
        gsap.set(element, {
          height: expanded ? 'auto' : 0,
          opacity: expanded ? 1 : 0,
          y: 0,
          overflow: 'hidden',
        })
        if (!expanded) setMounted(false)
        return
      }

      if (expanded) {
        gsap.fromTo(
          element,
          { height: 0, opacity: 0, y: -4, overflow: 'hidden' },
          {
            height: 'auto',
            opacity: 1,
            y: 0,
            duration: hierarchyGsap.durationBase,
            ease: hierarchyGsap.easeInOut,
          },
        )
      } else {
        gsap.to(element, {
          height: 0,
          opacity: 0,
          y: -4,
          overflow: 'hidden',
          duration: hierarchyGsap.durationBase,
          ease: hierarchyGsap.easeInOut,
          onComplete: () => setMounted(false),
        })
      }
    },
    {
      scope: contentRef,
      dependencies: [expanded, mounted, reducedMotion],
      revertOnUpdate: true,
    },
  )

  if (!mounted) return null

  return (
    <div
      ref={contentRef}
      className={cn('pt-relacionado overflow-hidden', className)}
      aria-hidden={!expanded}
    >
      {children}
    </div>
  )
}

function SeccionRelacion({
  icon,
  titulo,
  loading,
  isEmpty,
  emptyText,
  children,
}: {
  icon: ReactNode
  titulo: string
  loading: boolean
  isEmpty: boolean
  emptyText: string
  children: ReactNode
}) {
  return (
    <div className="space-y-relacionado">
      <p className="text-foreground gap-relacionado flex items-center text-sm font-medium">
        {icon}
        {titulo}
      </p>
      {loading ? (
        <div className="text-muted-foreground gap-relacionado flex items-center text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Cargando...
        </div>
      ) : isEmpty ? (
        <p className="text-muted-foreground text-xs">{emptyText}</p>
      ) : (
        <div className="space-y-micro">{children}</div>
      )}
    </div>
  )
}

function HierarchyLoadingState() {
  return (
    <div className="space-y-grupo p-grupo">
      <div className="gap-grupo grid xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-control p-grupo rounded-lg border">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <div className="space-y-relacionado pl-region">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <Skeleton className="hidden min-h-[420px] rounded-lg xl:block" />
      </div>
    </div>
  )
}

function HierarchyEmptyState() {
  return (
    <div className="gap-grupo px-seccion py-exhibicion flex flex-col items-center justify-center text-center">
      <div className="bg-primary/[0.07] border-primary/15 relative flex h-28 w-40 items-center justify-center rounded-lg border">
        <svg aria-hidden className="h-20 w-28" viewBox="0 0 112 80" fill="none">
          <path
            d="M56 14V32M56 32H24V48M56 32H88V48M24 48V64M88 48V64"
            stroke="var(--primary)"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.35"
          />
          <rect
            x="38"
            y="4"
            width="36"
            height="20"
            rx="6"
            fill="oklch(from var(--primary) l c h / 0.12)"
            stroke="oklch(from var(--primary) l c h / 0.35)"
          />
          <rect
            x="10"
            y="44"
            width="28"
            height="20"
            rx="6"
            fill="oklch(from var(--chart-4) l c h / 0.12)"
            stroke="oklch(from var(--chart-4) l c h / 0.35)"
          />
          <rect
            x="74"
            y="44"
            width="28"
            height="20"
            rx="6"
            fill="oklch(from var(--chart-5) l c h / 0.12)"
            stroke="oklch(from var(--chart-5) l c h / 0.35)"
          />
        </svg>
      </div>
      <div>
        <h2 className="text-foreground text-lg font-semibold">
          Sin usuarios en la jerarquia
        </h2>
        <p className="text-muted-foreground mt-micro max-w-md text-sm">
          No se encontraron participantes con roles o materias responsables para
          construir el mapa académico.
        </p>
      </div>
    </div>
  )
}

const ROL_RESPONSABLE_LABEL: Partial<Record<string, string>> = {
  PROFESOR_RESPONSABLE: 'Responsable',
  COAUTOR: 'Coautor',
  REVISOR: 'Revisor',
}

// Tarjetas de nodo planas: sin tinte decorativo por rol. El único color es el
// propio de cada facultad (su pill de icono + barra de acento), aplicado aparte.
const nodeVariantClasses: Record<NodeVariant, string> = {
  global: 'border-border bg-card shadow-sm',
  vicerrectoria: 'border-border bg-card',
  faculty: 'border-border bg-card',
  career: 'border-border bg-card',
  external: 'border-border bg-muted/30',
}

const nodeIconClasses: Record<NodeVariant, string> = {
  global: 'bg-primary/10 text-primary',
  vicerrectoria: 'bg-primary/10 text-primary',
  // Neutro: en facultad el color lo aporta el FacultadIconPill.
  faculty: 'bg-muted text-muted-foreground',
  career: 'bg-muted text-muted-foreground',
  external: 'bg-muted text-muted-foreground',
}

const personVariantClasses: Record<
  'global' | 'vicerrectoria' | 'faculty' | 'head' | 'professor' | 'external',
  string
> = {
  global: 'border-border',
  vicerrectoria: 'border-border',
  faculty: 'border-border',
  head: 'border-border',
  professor: 'border-border',
  external: 'border-border bg-muted/30',
}

// Mini-tarjeta de líder: plana, con barra de acento neutra a la izquierda
// (border-l). El acento de color, si aplica, lo da la facultad en su nodo.
const leaderCardClasses: Record<'faculty' | 'head', string> = {
  faculty: 'border-border bg-card hover:bg-muted/40',
  head: 'border-border bg-card hover:bg-muted/40',
}

const leaderAvatarClasses: Record<'faculty' | 'head', string> = {
  faculty: 'bg-muted text-muted-foreground',
  head: 'bg-muted text-muted-foreground',
}

const leaderAvatarRingClasses: Record<'faculty' | 'head', string> = {
  faculty: 'ring-border',
  head: 'ring-border',
}

const leaderChipClasses: Record<'faculty' | 'head', string> = {
  faculty: 'border-border bg-muted text-muted-foreground',
  head: 'border-border bg-muted text-muted-foreground',
}

// Orden de aparición de los líderes dentro de una facultad: primero la
// dirección, luego la secretaría académica y al final cualquier otro rol.
const LEADER_ORDER: Partial<Record<string, number>> = {
  DIRECTOR_FACULTAD: 0,
  SECRETARIO_ACADEMICO: 1,
  JEFE_POSGRADO: 2,
}

function leaderOrder(clave: string | undefined) {
  return LEADER_ORDER[clave ?? ''] ?? 3
}

// Etiqueta corta del puesto de jefatura para el chip de la figura de líder.
const LEADER_ROLE_LABEL: Partial<Record<string, string>> = {
  DIRECTOR_FACULTAD: 'Dirección',
  SECRETARIO_ACADEMICO: 'Secretaría Académica',
  JEFE_POSGRADO: 'Posgrado',
  JEFE_CARRERA: 'Jefatura',
}

function getLeaderRoleLabel(asignacion: UsuarioRol) {
  const clave = asignacion.roles?.clave
  return (clave && LEADER_ROLE_LABEL[clave]) || getRoleName(asignacion)
}

// Ícono del puesto de liderazgo para el chip de la figura de líder.
const LEADER_ROLE_ICON: Partial<Record<string, LucideIcon>> = {
  DIRECTOR_FACULTAD: Crown,
  SECRETARIO_ACADEMICO: ClipboardCheck,
  JEFE_POSGRADO: GraduationCap,
  JEFE_CARRERA: GraduationCap,
}

function getLeaderRoleIcon(clave: string | undefined): LucideIcon {
  return (clave && LEADER_ROLE_ICON[clave]) || ShieldCheck
}

function buildHierarchyViewModel(
  jerarquia: ReturnType<typeof construirJerarquia>,
  rawSearchTerm: string,
): HierarchyViewModel {
  const searchTerm = rawSearchTerm.trim()
  const hasSearch = searchTerm.length > 0
  const matchedNodeIds = new Set<string>()
  const branchMatchIds = new Set<string>()
  const matchedUserIds = new Set<string>()
  const selectableByNodeId = new Map<string, HierarchySelection>()
  const expandableIds = new Set<string>([
    ADMIN_SECTION_NODE_ID,
    ACADEMIC_ROOT_NODE_ID,
    EXTERNAL_NODE_ID,
  ])
  const forceExpandedIds = new Set<string>()

  const adminMembers = getGlobalRoleMembers(jerarquia.global, ADMIN_ROLE_KEY)
  const vicerrectorMembers = getGlobalRoleMembers(
    jerarquia.global,
    VICERRECTOR_ROLE_KEY,
  )
  const adminHasMatch = adminMembers.some((miembro) =>
    matchesMember(miembro.usuario, searchTerm),
  )
  const vicerrectorHasMatch = vicerrectorMembers.some((miembro) =>
    matchesMember(miembro.usuario, searchTerm),
  )
  const facultyMatchIds = new Set<string>()
  const careerMatchIds = new Set<string>()
  const externalHasMatch = jerarquia.externos.some((miembro) =>
    matchesMember(miembro.usuario, searchTerm),
  )

  for (const facultad of jerarquia.facultades) {
    const facultyId = facultyNodeId(facultad)
    const facultyHasDirectMatch = facultad.miembros.some((miembro) =>
      matchesMember(miembro.usuario, searchTerm),
    )
    let facultyHasMatch = facultyHasDirectMatch

    for (const carrera of facultad.carreras) {
      const careerId = careerNodeId(carrera)
      const careerHasMatch =
        carrera.miembros.some((miembro) =>
          matchesMember(miembro.usuario, searchTerm),
        ) ||
        carrera.profesores.some((profesor) =>
          matchesMember(profesor.usuario, searchTerm),
        )
      if (careerHasMatch) {
        careerMatchIds.add(careerId)
        facultyHasMatch = true
      }
    }

    if (facultyHasMatch) facultyMatchIds.add(facultyId)
  }

  if (hasSearch && adminHasMatch) {
    branchMatchIds.add(ADMIN_SECTION_NODE_ID)
    forceExpandedIds.add(ADMIN_SECTION_NODE_ID)
  }

  const academicBranchHasMatch = vicerrectorHasMatch || facultyMatchIds.size > 0
  if (hasSearch && academicBranchHasMatch) {
    branchMatchIds.add(ACADEMIC_ROOT_NODE_ID)
    forceExpandedIds.add(ACADEMIC_ROOT_NODE_ID)
  }

  if (hasSearch && externalHasMatch) {
    branchMatchIds.add(EXTERNAL_NODE_ID)
    forceExpandedIds.add(EXTERNAL_NODE_ID)
  }

  selectableByNodeId.set(ADMIN_SECTION_NODE_ID, {
    kind: 'group',
    nodeId: ADMIN_SECTION_NODE_ID,
    title: 'Administradores',
    roleLabel: 'Administración del sistema',
    scopeLabel: 'Sistema',
    description: 'Desarrolladores del programa con acceso total al sistema.',
    pathIds: [ADMIN_SECTION_NODE_ID],
    pathLabel: ['Administradores'],
    stats: [
      { label: 'Usuarios', value: String(adminMembers.length) },
      { label: 'Alcance', value: 'Sistema' },
    ],
    relationships: [
      'Zona técnica separada del gobierno académico.',
      'Agrupa exclusivamente roles ADMIN.',
      'No forma parte de la cadena académica de facultades y programas.',
    ],
  })

  for (const miembro of adminMembers) {
    const nodeId = globalMemberNodeId(miembro)
    const isMatch = matchesMember(miembro.usuario, searchTerm)
    if (isMatch) {
      matchedNodeIds.add(nodeId)
      matchedUserIds.add(miembro.usuario.id)
    }
    selectableByNodeId.set(nodeId, {
      kind: 'person',
      nodeId,
      usuario: miembro.usuario,
      roleLabel: getRoleNodeLabel(miembro.asignacion),
      scopeLabel: getHierarchyScopeLabel(miembro.asignacion),
      scope: miembro.asignacion.roles?.alcance_default ?? 'global',
      pathIds: [ADMIN_SECTION_NODE_ID, nodeId],
      pathLabel: [
        'Administradores',
        miembro.usuario.nombre_completo ?? 'Sin nombre',
      ],
    })
  }

  selectableByNodeId.set(ACADEMIC_ROOT_NODE_ID, {
    kind: 'group',
    nodeId: ACADEMIC_ROOT_NODE_ID,
    title: 'Vicerrectoría Académica',
    roleLabel: 'Gobierno académico',
    scopeLabel: 'Global',
    description:
      'Supervisión académica global de facultades, programas y responsables de materia.',
    pathIds: [ACADEMIC_ROOT_NODE_ID],
    pathLabel: ['Vicerrectoría Académica'],
    stats: [
      { label: 'Vicerrectores', value: String(vicerrectorMembers.length) },
      { label: 'Facultades', value: String(jerarquia.facultades.length) },
      { label: 'Carreras', value: String(countCareers(jerarquia.facultades)) },
      {
        label: 'Profesores',
        value: String(countProfessors(jerarquia.facultades)),
      },
    ],
    relationships: [
      'Raíz del mapa académico de responsabilidad curricular.',
      'Conecta con Dirección de Facultad y Secretaría Académica por alcance.',
      'Mantiene trazabilidad hacia carreras y profesores responsables.',
    ],
  })

  for (const miembro of vicerrectorMembers) {
    const nodeId = globalMemberNodeId(miembro)
    const isMatch = matchesMember(miembro.usuario, searchTerm)
    if (isMatch) {
      matchedNodeIds.add(nodeId)
      matchedUserIds.add(miembro.usuario.id)
    }
    selectableByNodeId.set(nodeId, {
      kind: 'person',
      nodeId,
      usuario: miembro.usuario,
      roleLabel: getRoleNodeLabel(miembro.asignacion),
      scopeLabel: getHierarchyScopeLabel(miembro.asignacion),
      scope: miembro.asignacion.roles?.alcance_default ?? 'global',
      pathIds: [ACADEMIC_ROOT_NODE_ID, nodeId],
      pathLabel: [
        'Vicerrectoría Académica',
        miembro.usuario.nombre_completo ?? 'Sin nombre',
      ],
    })
  }

  for (const facultad of jerarquia.facultades) {
    const facultyId = facultyNodeId(facultad)
    expandableIds.add(facultyId)

    if (facultyMatchIds.has(facultyId)) {
      branchMatchIds.add(facultyId)
      forceExpandedIds.add(facultyId)
    }

    selectableByNodeId.set(facultyId, {
      kind: 'group',
      nodeId: facultyId,
      title: getFacultyDisplayName(facultad),
      roleLabel: 'Facultad',
      scopeLabel: 'Facultad',
      description:
        'Unidad académica donde conviven dirección, secretaría académica y programas.',
      pathIds: [ACADEMIC_ROOT_NODE_ID, facultyId],
      pathLabel: ['Vicerrectoría Académica', getFacultyDisplayName(facultad)],
      facultad: { color: facultad.color, icono: facultad.icono },
      stats: [
        { label: 'Directivos', value: String(facultad.miembros.length) },
        { label: 'Carreras', value: String(facultad.carreras.length) },
        {
          label: 'Profesores',
          value: String(countFacultyProfessors(facultad)),
        },
        { label: 'Total', value: String(facultyTotal(facultad)) },
      ],
      relationships: [
        'Contiene Dirección de Facultad y Secretaría Académica.',
        'Agrupa carreras o programas con su jefatura correspondiente.',
        'Relaciona profesores responsables con las materias de sus planes.',
      ],
    })

    for (const miembro of facultad.miembros) {
      const nodeId = facultyMemberNodeId(facultad, miembro)
      const isMatch = matchesMember(miembro.usuario, searchTerm)
      if (isMatch) {
        matchedNodeIds.add(nodeId)
        matchedUserIds.add(miembro.usuario.id)
      }
      // Sin arista: el miembro va embebido dentro de la tarjeta de facultad.
      selectableByNodeId.set(nodeId, {
        kind: 'person',
        nodeId,
        usuario: miembro.usuario,
        roleLabel: getRoleNodeLabel(miembro.asignacion),
        scopeLabel: getHierarchyScopeLabel(miembro.asignacion),
        scope: miembro.asignacion.roles?.alcance_default ?? 'facultad',
        pathIds: [ACADEMIC_ROOT_NODE_ID, facultyId, nodeId],
        pathLabel: [
          'Vicerrectoría Académica',
          getFacultyDisplayName(facultad),
          miembro.usuario.nombre_completo ?? 'Sin nombre',
        ],
        facultad: { color: facultad.color, icono: facultad.icono },
      })
    }

    for (const carrera of facultad.carreras) {
      const careerId = careerNodeId(carrera)
      expandableIds.add(careerId)

      if (careerMatchIds.has(careerId)) {
        branchMatchIds.add(careerId)
        forceExpandedIds.add(careerId)
      }

      selectableByNodeId.set(careerId, {
        kind: 'group',
        nodeId: careerId,
        title: formatCarreraNombre(carrera),
        roleLabel: 'Carrera',
        scopeLabel: carrera.nivel,
        description:
          'Subarbol compacto de jefatura y profesores responsables de materia.',
        pathIds: [ACADEMIC_ROOT_NODE_ID, facultyId, careerId],
        pathLabel: [
          'Vicerrectoría Académica',
          getFacultyDisplayName(facultad),
          formatCarreraNombre(carrera),
        ],
        facultad: { color: facultad.color, icono: facultad.icono },
        stats: [
          { label: 'Jefatura', value: String(carrera.miembros.length) },
          { label: 'Profesores', value: String(carrera.profesores.length) },
          {
            label: 'Materias',
            value: String(
              carrera.profesores.reduce((sum, item) => sum + item.materias, 0),
            ),
          },
          { label: 'Total', value: String(careerTotal(carrera)) },
        ],
        relationships: [
          'Conecta Dirección y Secretaría Académica con el programa.',
          'Conecta Jefatura de Carrera con materias del plan.',
          'Los profesores se derivan de las materias donde son responsables.',
        ],
      })

      for (const miembro of carrera.miembros) {
        const nodeId = careerMemberNodeId(carrera, miembro)
        const isMatch = matchesMember(miembro.usuario, searchTerm)
        if (isMatch) {
          matchedNodeIds.add(nodeId)
          matchedUserIds.add(miembro.usuario.id)
        }
        // Sin arista: la jefatura va embebida dentro de la tarjeta de carrera.
        selectableByNodeId.set(nodeId, {
          kind: 'person',
          nodeId,
          usuario: miembro.usuario,
          roleLabel: getRoleNodeLabel(miembro.asignacion),
          scopeLabel: getHierarchyScopeLabel(miembro.asignacion),
          scope: miembro.asignacion.roles?.alcance_default ?? 'carrera',
          pathIds: [ACADEMIC_ROOT_NODE_ID, facultyId, careerId, nodeId],
          pathLabel: [
            'Vicerrectoría Académica',
            getFacultyDisplayName(facultad),
            formatCarreraNombre(carrera),
            miembro.usuario.nombre_completo ?? 'Sin nombre',
          ],
          facultad: { color: facultad.color, icono: facultad.icono },
        })
      }

      for (const profesor of carrera.profesores) {
        const nodeId = professorNodeIdFor(carrera, profesor)
        const isMatch = matchesMember(profesor.usuario, searchTerm)
        if (isMatch) {
          matchedNodeIds.add(nodeId)
          matchedUserIds.add(profesor.usuario.id)
        }
        selectableByNodeId.set(nodeId, {
          kind: 'person',
          nodeId,
          usuario: profesor.usuario,
          roleLabel: 'Profesor responsable',
          scopeLabel: `${profesor.materias} ${
            profesor.materias === 1 ? 'materia' : 'materias'
          }`,
          scope: 'asignatura',
          materias: profesor.materias,
          pathIds: [ACADEMIC_ROOT_NODE_ID, facultyId, careerId, nodeId],
          pathLabel: [
            'Vicerrectoría Académica',
            getFacultyDisplayName(facultad),
            formatCarreraNombre(carrera),
            profesor.usuario.nombre_completo ?? 'Sin nombre',
          ],
          facultad: { color: facultad.color, icono: facultad.icono },
        })
      }
    }
  }

  selectableByNodeId.set(EXTERNAL_NODE_ID, {
    kind: 'group',
    nodeId: EXTERNAL_NODE_ID,
    title: 'Evaluadores y expertos invitados',
    roleLabel: 'Revision externa',
    scopeLabel: 'Externo',
    description:
      'Zona separada para participantes externos que evalúan o enriquecen planes.',
    pathIds: [EXTERNAL_NODE_ID],
    pathLabel: ['Externos'],
    stats: [
      { label: 'Expertos', value: String(jerarquia.externos.length) },
      {
        label: 'Pendientes',
        value: String(
          jerarquia.externos.filter(
            (item) => item.usuario.externo && !item.usuario.email_confirmed,
          ).length,
        ),
      },
    ],
    relationships: [
      'Funciona como zona neutral separada de roles internos.',
      'Agrupa roles EVALUADOR_EXTERNO.',
      'Aporta revisión invitada sin ocupar un nodo de facultad o carrera.',
    ],
  })

  for (const miembro of jerarquia.externos) {
    const nodeId = externalMemberNodeId(miembro)
    const isMatch = matchesMember(miembro.usuario, searchTerm)
    if (isMatch) {
      matchedNodeIds.add(nodeId)
      matchedUserIds.add(miembro.usuario.id)
    }
    selectableByNodeId.set(nodeId, {
      kind: 'person',
      nodeId,
      usuario: miembro.usuario,
      roleLabel: getRoleNodeLabel(miembro.asignacion),
      scopeLabel: 'Externo',
      scope: 'externo',
      pathIds: [EXTERNAL_NODE_ID, nodeId],
      pathLabel: ['Externos', miembro.usuario.nombre_completo ?? 'Sin nombre'],
    })
  }

  return {
    hasSearch,
    searchTerm,
    matchedUserCount: matchedUserIds.size,
    matchedNodeIds,
    branchMatchIds,
    selectableByNodeId,
    expandableIds,
    forceExpandedIds,
    renderKey: [
      jerarquia.totalMiembros,
      jerarquia.facultades.length,
      jerarquia.externos.length,
      searchTerm,
    ].join(':'),
    totals: {
      global: jerarquia.global.length,
      facultades: jerarquia.facultades.length,
      carreras: countCareers(jerarquia.facultades),
      profesores: countProfessors(jerarquia.facultades),
      externos: jerarquia.externos.length,
    },
  }
}

function matchesMember(usuario: Usuario, searchTerm: string) {
  if (!searchTerm) return false
  return matchesSearch(usuario, searchTerm)
}

function getGlobalRoleMembers(
  miembros: Array<MiembroJerarquia>,
  roleKey: GlobalRoleKey,
) {
  return miembros.filter(
    (miembro) => miembro.asignacion.roles?.clave === roleKey,
  )
}

function getFacultyDisplayName(facultad: FacultadNodo) {
  if (!facultad.nombre.trim()) return 'Facultad sin nombre'
  return formatFacultadNombre(facultad)
}

function getHierarchyScopeLabel(asignacion: UsuarioRol) {
  if (asignacion.carreras) return formatCarreraNombre(asignacion.carreras)
  if (asignacion.facultades) return formatFacultadNombre(asignacion.facultades)
  return getScopeLabel(asignacion)
}

function isMatched(nodeId: string, viewModel: HierarchyViewModel) {
  if (!viewModel.hasSearch) return false
  return (
    viewModel.matchedNodeIds.has(nodeId) || viewModel.branchMatchIds.has(nodeId)
  )
}

function countCareers(facultades: Array<FacultadNodo>) {
  return facultades.reduce((sum, facultad) => sum + facultad.carreras.length, 0)
}

function countProfessors(facultades: Array<FacultadNodo>) {
  return facultades.reduce(
    (sum, facultad) => sum + countFacultyProfessors(facultad),
    0,
  )
}

function countFacultyProfessors(facultad: FacultadNodo) {
  return facultad.carreras.reduce(
    (sum, carrera) => sum + carrera.profesores.length,
    0,
  )
}

function facultyTotal(facultad: FacultadNodo) {
  return (
    facultad.miembros.length +
    facultad.carreras.reduce((sum, carrera) => sum + careerTotal(carrera), 0)
  )
}

function careerTotal(carrera: CarreraNodo) {
  return carrera.miembros.length + carrera.profesores.length
}

function facultyNodeId(facultad: FacultadNodo) {
  return `faculty-${facultad.id}`
}

function careerNodeId(carrera: CarreraNodo) {
  return `career-${carrera.id}`
}

function globalMemberNodeId(miembro: MiembroJerarquia) {
  return `global-member-${miembro.asignacion.id}`
}

function facultyMemberNodeId(
  facultad: FacultadNodo,
  miembro: MiembroJerarquia,
) {
  return `faculty-${facultad.id}-member-${miembro.asignacion.id}`
}

function careerMemberNodeId(carrera: CarreraNodo, miembro: MiembroJerarquia) {
  return `career-${carrera.id}-member-${miembro.asignacion.id}`
}

function professorNodeIdFor(carrera: CarreraNodo, profesor: ProfesorCarrera) {
  return `career-${carrera.id}-professor-${profesor.usuario.id}`
}

function externalMemberNodeId(miembro: MiembroJerarquia) {
  return `external-member-${miembro.asignacion.id}`
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    setMatches(media.matches)
    const listener = () => setMatches(media.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}

function usePrefersReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/* eslint-disable import/consistent-type-specifier-style */
/* eslint-disable import/order */
import {
  ReactFlow,
  Background,
  MarkerType,
  type Edge,
  type Node,
  ReactFlowProvider,
  useReactFlow,
  BackgroundVariant,
  type ColorMode,
} from '@xyflow/react'
import { useEffect, useMemo, useState } from 'react'

import type { Asignatura } from '@/types/plan'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import '@xyflow/react/dist/style.css'
import AsignaturaNode from './AsignaturaNode'

import dagre from 'dagre'

const nodeTypes = {
  asignatura: AsignaturaNode,
}

interface Props {
  asignatura: Asignatura | null
  todasLasAsignaturas: Array<Asignatura>
  lineas: Array<{ id: string; color: string }>
  isOpen: boolean
  onClose: () => void
}

function FlowContent({
  nodes,
  edges,
  colorMode,
}: {
  nodes: Array<Node>
  edges: Array<Edge>
  colorMode: ColorMode
}) {
  const { fitView } = useReactFlow()

  useEffect(() => {
    requestAnimationFrame(() => {
      fitView({ padding: 0.2 })
    })
  }, [nodes, fitView])

  const extent = useMemo<[[number, number], [number, number]]>(() => {
    if (nodes.length === 0)
      return [
        [-500, -500],
        [500, 500],
      ]

    const xs = nodes.map((n) => n.position.x)
    const ys = nodes.map((n) => n.position.y)

    const minX = Math.min(...xs) - 500
    const maxX = Math.max(...xs) + 500
    const minY = Math.min(...ys) - 500
    const maxY = Math.max(...ys) + 500

    return [
      [minX, minY],
      [maxX, maxY],
    ]
  }, [nodes])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable
      nodesConnectable={false}
      fitView
      minZoom={0.5}
      maxZoom={1.5}
      translateExtent={extent}
      colorMode={colorMode}
      style={{
        width: '100%',
        height: '100%',
        background: 'hsl(var(--background))',
      }}
    >
      <Background
        color="hsl(var(--border))"
        bgColor="hsl(var(--background))"
        gap={20}
        variant={BackgroundVariant.Dots}
      />
    </ReactFlow>
  )
}

const getFullTree = (
  start: Asignatura,
  todas: Array<Asignatura>,
): Array<Asignatura> => {
  const visited = new Set<string>()
  const result: Array<Asignatura> = []

  const dfs = (materia: Asignatura) => {
    if (visited.has(materia.id)) return
    visited.add(materia.id)
    result.push(materia)

    // 🔼 padre
    if (materia.prerrequisito_asignatura_id) {
      const parent = todas.find(
        (a) => a.id === materia.prerrequisito_asignatura_id,
      )
      if (parent) dfs(parent)
    }

    // 🔽 hijos
    const children = todas.filter(
      (a) => a.prerrequisito_asignatura_id === materia.id,
    )

    children.forEach((child) => dfs(child))
  }

  dfs(start)

  return result
}
const getLayoutedElements = (nodes: Array<Node>, edges: Array<Edge>) => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  dagreGraph.setGraph({
    rankdir: 'TB', // TOP -> BOTTOM (árbol)
    nodesep: 50,
    ranksep: 120,
  })

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 200, height: 180 })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  return {
    nodes: nodes.map((node) => {
      const pos = dagreGraph.node(node.id)
      return {
        ...node,
        position: {
          x: pos.x - 100,
          y: pos.y - 90,
        },
      }
    }),
    edges,
  }
}

export function VisualizadorSeriacionModal({
  asignatura,
  todasLasAsignaturas,
  isOpen,
  lineas,
  onClose,
}: Props) {
  const [isMounted, setIsMounted] = useState(false)
  const [colorMode, setColorMode] = useState<ColorMode>(() => {
    if (typeof document === 'undefined') return 'light'
    return document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light'
  })

  useEffect(() => {
    if (typeof document === 'undefined') return

    const el = document.documentElement
    const update = () => {
      setColorMode(el.classList.contains('dark') ? 'dark' : 'light')
    }

    update()

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          update()
          break
        }
      }
    })

    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setIsMounted(true), 100)
      return () => {
        clearTimeout(timer)
        setIsMounted(false)
      }
    }
  }, [isOpen])

  const lineasMap = useMemo(() => {
    const map: Record<string, string> = {}
    lineas.forEach((l) => {
      map[l.id] = l.color
    })
    return map
  }, [lineas])

  const { nodes, edges } = useMemo(() => {
    if (!asignatura) return { nodes: [], edges: [] }

    const computedNodes: Array<Node> = []
    const computedEdges: Array<Edge> = []

    const all = getFullTree(asignatura, todasLasAsignaturas)

    const niveles = new Map<number, Array<Asignatura>>()

    all.forEach((m) => {
      const nivel = m.ciclo || 0
      if (!niveles.has(nivel)) niveles.set(nivel, [])
      niveles.get(nivel)!.push(m)
    })

    Array.from(niveles.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([, materias]) => {
        materias.forEach((m) => {
          const id = m.id === asignatura.id ? 'current' : `node-${m.id}`

          computedNodes.push({
            id,
            type: 'asignatura',
            position: { x: 0, y: 0 }, // 🔥 IMPORTANTE
            data: {
              asignatura: m,
              lineaColor: m.lineaCurricularId
                ? lineasMap[m.lineaCurricularId] || '#1976d2'
                : '#1976d2',
              isActive: m.id === asignatura.id,
              onViewSeriacion: () => {},
              isModalOpen: isOpen,
              hasSeriacion:
                !!m.prerrequisito_asignatura_id ||
                todasLasAsignaturas.some(
                  (a) => a.prerrequisito_asignatura_id === m.id,
                ),
            },
          })

          if (m.prerrequisito_asignatura_id) {
            computedEdges.push({
              id: `e-${m.prerrequisito_asignatura_id}-${m.id}`,
              source:
                m.prerrequisito_asignatura_id === asignatura.id
                  ? 'current'
                  : `node-${m.prerrequisito_asignatura_id}`,
              target: id,
              markerEnd: { type: MarkerType.ArrowClosed },
            })
          }
        })
      })

    const layouted = getLayoutedElements(computedNodes, computedEdges)
    return layouted
  }, [asignatura, todasLasAsignaturas, lineasMap, isOpen])

  if (!asignatura) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex h-175 w-[95vw] max-w-none flex-col p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle>Seriación: {asignatura.nombre}</DialogTitle>
        </DialogHeader>

        <div className="flex-1">
          {isMounted && (
            <ReactFlowProvider>
              <FlowContent nodes={nodes} edges={edges} colorMode={colorMode} />
            </ReactFlowProvider>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

import { ArrowRight } from 'lucide-react'
import { Fragment, useMemo } from 'react'

import type { HistoryDisplayValue } from '@/lib/history-display'
import type { DiffOp } from '@/lib/text-diff'
import type { ReactElement } from 'react'

import { RichTextContent } from '@/components/editor/RichTextContent'
import { looksLikeHtml } from '@/components/editor/sanitize'
import { diffSequence, diffWords, htmlToPlainText } from '@/lib/text-diff'
import { cn } from '@/lib/utils'

/**
 * Render del historial de cambios.
 *
 * - Valores escalares → diff en línea (corto: «antes → después»; largo: diff
 *   palabra por palabra).
 * - Valores estructurados (objetos/listas) → vista lado a lado con filas
 *   alineadas: si un ítem se quitó o se agregó, la otra columna conserva el
 *   hueco, así el ojo empareja las dos versiones sin esfuerzo. Al vivir en un
 *   solo grid, el scroll de ambas columnas queda sincronizado por construcción.
 *
 * Nunca se muestra JSON crudo y el color se reserva para lo que cambió.
 */

const EMPTY_MARKERS = new Set([
  'Sin información',
  'Sin datos previos',
  'Sin información previa',
  'Vacío',
  'Lista vacía',
])

function isEmpty(value: HistoryDisplayValue): boolean {
  if (value === null || value === '') return true
  if (typeof value === 'string') return EMPTY_MARKERS.has(value)
  if (Array.isArray(value)) {
    return (
      value.length === 0 ||
      (value.length === 1 &&
        typeof value[0] === 'string' &&
        EMPTY_MARKERS.has(value[0]))
    )
  }
  return false
}

function isPlainObject(
  value: HistoryDisplayValue,
): value is Record<string, HistoryDisplayValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStructured(value: HistoryDisplayValue): boolean {
  return isPlainObject(value) || Array.isArray(value)
}

function toText(value: HistoryDisplayValue): string {
  if (value === null) return ''
  return String(value)
}

function plainText(value: HistoryDisplayValue): string {
  const text = toText(value)
  return looksLikeHtml(text) ? htmlToPlainText(text) : text
}

function areEqual(a: HistoryDisplayValue, b: HistoryDisplayValue): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/** «HorasEstimadas» → «Horas estimadas» (las claves ya vienen humanizadas). */
function prettyLabel(label: string): string {
  const spaced = label
    .replace(/([a-zà-ú\d])([A-ZÀ-Ú])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function EmptyText() {
  return (
    <span className="text-muted-foreground text-sm italic">
      Sin información
    </span>
  )
}

/* ────────────────────────────── Valor plano ────────────────────────────── */

/** Valor completo sin diff (creación / valor inicial / ítems sin cambios). */
export function HistoryValue({
  value,
}: {
  value: HistoryDisplayValue
}): ReactElement {
  if (isEmpty(value)) return <EmptyText />

  if (Array.isArray(value)) {
    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={index} className="border-border/50 border-l-2 pl-3">
            <HistoryValue value={item} />
          </div>
        ))}
      </div>
    )
  }

  if (isPlainObject(value)) {
    return (
      <div className="space-y-2.5">
        {Object.entries(value).map(([key, val]) => (
          <div key={key} className="space-y-0.5">
            <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              {prettyLabel(key)}
            </span>
            {isStructured(val) ? (
              <div className="border-border/40 border-l-2 pl-3">
                <HistoryValue value={val} />
              </div>
            ) : (
              <HistoryValue value={val} />
            )}
          </div>
        ))}
      </div>
    )
  }

  if (typeof value === 'string' && looksLikeHtml(value)) {
    return <RichTextContent html={value} />
  }

  return (
    <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
      {toText(value)}
    </p>
  )
}

/* ─────────────────────────── Diff de escalares ─────────────────────────── */

function InlineDiffTokens({ ops }: { ops: Array<DiffOp> }) {
  return (
    <>
      {ops.map((op, index) => {
        if (op.type === 'equal')
          return <Fragment key={index}>{op.value}</Fragment>
        if (op.type === 'delete') {
          return (
            <del
              key={index}
              className="text-destructive/70 decoration-destructive/40 rounded-sm line-through"
            >
              {op.value}
            </del>
          )
        }
        return (
          <ins
            key={index}
            className="rounded-sm bg-emerald-500/12 px-0.5 text-emerald-700 no-underline dark:text-emerald-300"
          >
            {op.value}
          </ins>
        )
      })}
    </>
  )
}

/** Diff de dos valores escalares (texto, número, HTML aplanado). */
function ScalarDiff({
  from,
  to,
}: {
  from: HistoryDisplayValue
  to: HistoryDisplayValue
}) {
  const before = plainText(from)
  const after = plainText(to)

  // Solo cambió el marcado, no el texto → mostramos la versión nueva.
  if (before === after) return <HistoryValue value={to} />

  const short =
    !before.includes('\n') &&
    !after.includes('\n') &&
    before.length <= 48 &&
    after.length <= 48

  // Valores cortos: «antes → después» se lee de un vistazo.
  if (short) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {isEmpty(from) ? (
          <EmptyText />
        ) : (
          <del className="text-muted-foreground decoration-border line-through">
            {before}
          </del>
        )}
        <ArrowRight className="text-muted-foreground/60 h-3.5 w-3.5 shrink-0" />
        {isEmpty(to) ? (
          <EmptyText />
        ) : (
          <span className="text-foreground font-medium">{after}</span>
        )}
      </div>
    )
  }

  if (isEmpty(from)) return <HistoryValue value={to} />
  if (isEmpty(to)) {
    return (
      <div className="border-destructive/40 border-l-2 pl-3 opacity-75">
        <HistoryValue value={from} />
      </div>
    )
  }

  return (
    <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
      <InlineDiffTokens ops={diffWords(before, after)} />
    </p>
  )
}

/* ──────────────────────── Vista lado a lado (split) ────────────────────── */

type PairState = 'equal' | 'changed' | 'removed' | 'added'

type SplitRow =
  | { kind: 'label'; label: string; depth: number; changed: boolean }
  | { kind: 'spacer' }
  | {
      kind: 'pair'
      depth: number
      state: PairState
      left: HistoryDisplayValue | null
      right: HistoryDisplayValue | null
      /** Diff por palabra cuando ambos lados son texto. */
      ops?: Array<DiffOp>
    }

function stableKey(value: HistoryDisplayValue | null): string {
  return JSON.stringify(value ?? null)
}

function pushLeaf(
  rows: Array<SplitRow>,
  from: HistoryDisplayValue,
  to: HistoryDisplayValue,
  depth: number,
) {
  const fromEmpty = isEmpty(from)
  const toEmpty = isEmpty(to)

  if (fromEmpty && toEmpty) {
    rows.push({ kind: 'pair', depth, state: 'equal', left: null, right: null })
    return
  }
  if (areEqual(from, to)) {
    rows.push({ kind: 'pair', depth, state: 'equal', left: from, right: to })
    return
  }
  if (fromEmpty) {
    rows.push({ kind: 'pair', depth, state: 'added', left: null, right: to })
    return
  }
  if (toEmpty) {
    rows.push({
      kind: 'pair',
      depth,
      state: 'removed',
      left: from,
      right: null,
    })
    return
  }

  const bothText = !isStructured(from) && !isStructured(to)
  rows.push({
    kind: 'pair',
    depth,
    state: 'changed',
    left: from,
    right: to,
    ops: bothText ? diffWords(plainText(from), plainText(to)) : undefined,
  })
}

function buildArrayRows(
  rows: Array<SplitRow>,
  from: Array<HistoryDisplayValue>,
  to: Array<HistoryDisplayValue>,
  depth: number,
) {
  const fromKeys = from.map(stableKey)
  const toKeys = to.map(stableKey)

  // Alineamos los ítems con LCS y emparejamos borrado+insertado adyacentes
  // como «modificado» para que un ítem editado no se lea como dos ítems.
  type Group = {
    from: HistoryDisplayValue | null
    to: HistoryDisplayValue | null
    state: PairState
  }
  const groups: Array<Group> = []
  const pendingFrom: Array<number> = []
  const pendingTo: Array<number> = []

  const flush = () => {
    const paired = Math.min(pendingFrom.length, pendingTo.length)
    for (let k = 0; k < paired; k++) {
      groups.push({
        from: from[pendingFrom[k]],
        to: to[pendingTo[k]],
        state: 'changed',
      })
    }
    for (let k = paired; k < pendingFrom.length; k++) {
      groups.push({ from: from[pendingFrom[k]], to: null, state: 'removed' })
    }
    for (let k = paired; k < pendingTo.length; k++) {
      groups.push({ from: null, to: to[pendingTo[k]], state: 'added' })
    }
    pendingFrom.length = 0
    pendingTo.length = 0
  }

  for (const op of diffSequence(fromKeys, toKeys)) {
    if (op.type === 'equal') {
      flush()
      groups.push({
        from: from[op.aIndex as number],
        to: to[op.bIndex as number],
        state: 'equal',
      })
    } else if (op.type === 'delete') {
      pendingFrom.push(op.aIndex as number)
    } else {
      pendingTo.push(op.bIndex as number)
    }
  }
  flush()

  groups.forEach((group, index) => {
    const structured = isStructured(group.from) || isStructured(group.to)
    if (index > 0 && structured) rows.push({ kind: 'spacer' })

    if (
      group.state === 'changed' &&
      group.from !== null &&
      group.to !== null &&
      isStructured(group.from) &&
      isStructured(group.to)
    ) {
      buildRows(rows, group.from, group.to, depth)
    } else if (group.state === 'changed') {
      pushLeaf(rows, group.from ?? null, group.to ?? null, depth)
    } else {
      rows.push({
        kind: 'pair',
        depth,
        state: group.state,
        left: group.from,
        right: group.to,
      })
    }
  })
}

function buildRows(
  rows: Array<SplitRow>,
  from: HistoryDisplayValue,
  to: HistoryDisplayValue,
  depth: number,
) {
  const fromEmpty = isEmpty(from)
  const toEmpty = isEmpty(to)

  if (!fromEmpty && !toEmpty && isPlainObject(from) && isPlainObject(to)) {
    const keys = [
      ...Object.keys(from),
      ...Object.keys(to).filter((key) => !(key in from)),
    ]
    for (const key of keys) {
      const fromVal = key in from ? from[key] : null
      const toVal = key in to ? to[key] : null
      rows.push({
        kind: 'label',
        label: key,
        depth,
        changed: !areEqual(fromVal, toVal),
      })
      buildRows(rows, fromVal, toVal, depth + 1)
    }
    return
  }

  if (!fromEmpty && !toEmpty && Array.isArray(from) && Array.isArray(to)) {
    buildArrayRows(rows, from, to, depth)
    return
  }

  pushLeaf(rows, from, to, depth)
}

function SideTokens({
  ops,
  side,
}: {
  ops: Array<DiffOp>
  side: 'left' | 'right'
}) {
  return (
    <>
      {ops.map((op, index) => {
        if (op.type === 'equal')
          return <Fragment key={index}>{op.value}</Fragment>
        if (side === 'left' && op.type === 'delete') {
          return (
            <del
              key={index}
              className="bg-destructive/10 text-destructive decoration-destructive/40 rounded-sm px-0.5 line-through"
            >
              {op.value}
            </del>
          )
        }
        if (side === 'right' && op.type === 'insert') {
          return (
            <ins
              key={index}
              className="rounded-sm bg-emerald-500/15 px-0.5 text-emerald-700 no-underline dark:text-emerald-300"
            >
              {op.value}
            </ins>
          )
        }
        return null
      })}
    </>
  )
}

function SideCell({
  row,
  side,
}: {
  row: Extract<SplitRow, { kind: 'pair' }>
  side: 'left' | 'right'
}) {
  const value = side === 'left' ? row.left : row.right
  const absent =
    (side === 'left' && row.state === 'added') ||
    (side === 'right' && row.state === 'removed')
  const indent = row.depth > 0 ? { paddingLeft: row.depth * 12 } : undefined

  // Hueco: el ítem no existe en esta versión, pero conserva el espacio para
  // que ambas columnas queden alineadas fila a fila.
  if (absent) {
    return (
      <div style={indent} aria-hidden="true">
        <div className="border-border/60 h-full min-h-7 rounded-md border border-dashed opacity-40" />
      </div>
    )
  }

  const rail =
    row.state === 'removed'
      ? 'border-destructive/40 border-l-2 pl-3 opacity-80'
      : row.state === 'added'
        ? 'border-l-2 border-emerald-500/50 pl-3'
        : row.state === 'changed' && !row.ops
          ? side === 'left'
            ? 'border-destructive/40 border-l-2 pl-3 opacity-80'
            : 'border-l-2 border-emerald-500/50 pl-3'
          : ''

  return (
    <div
      style={indent}
      className={cn(row.state === 'equal' && 'opacity-60', rail)}
    >
      {row.ops ? (
        <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
          <SideTokens ops={row.ops} side={side} />
        </p>
      ) : (
        <HistoryValue value={value ?? null} />
      )}
    </div>
  )
}

/** Comparación lado a lado con filas alineadas y scroll compartido. */
function SplitDiff({
  from,
  to,
}: {
  from: HistoryDisplayValue
  to: HistoryDisplayValue
}) {
  const rows = useMemo(() => {
    const built: Array<SplitRow> = []
    buildRows(built, from, to, 0)
    return built
  }, [from, to])

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
      <div className="bg-background text-muted-foreground sticky top-0 z-10 col-span-2 grid grid-cols-2 gap-x-8 border-b pb-2 text-[10px] font-semibold tracking-widest uppercase">
        <span>Anterior</span>
        <span>Nuevo</span>
      </div>
      {rows.map((row, index) => {
        if (row.kind === 'spacer') {
          return (
            <div
              key={index}
              className="border-border/40 col-span-2 my-1 border-t"
            />
          )
        }
        if (row.kind === 'label') {
          return (
            <p
              key={index}
              className={cn(
                'col-span-2 mt-2 text-[10px] font-semibold tracking-wider uppercase',
                row.changed ? 'text-foreground' : 'text-muted-foreground',
              )}
              style={
                row.depth > 0 ? { paddingLeft: row.depth * 12 } : undefined
              }
            >
              {prettyLabel(row.label)}
            </p>
          )
        }
        return (
          <Fragment key={index}>
            <SideCell row={row} side="left" />
            <SideCell row={row} side="right" />
          </Fragment>
        )
      })}
    </div>
  )
}

/* ────────────────────────────── Punto de entrada ───────────────────────── */

export function HistoryDiff({
  from,
  to,
}: {
  from: HistoryDisplayValue
  to: HistoryDisplayValue
}): ReactElement {
  if (isEmpty(from) && isEmpty(to)) return <EmptyText />

  if (isStructured(from) || isStructured(to)) {
    return <SplitDiff from={from} to={to} />
  }

  return <ScalarDiff from={from} to={to} />
}

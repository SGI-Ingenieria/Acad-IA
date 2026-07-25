import { ArrowRight, Columns2, Rows3 } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'

import type { HistoryDisplayValue } from '@/lib/history-display'
import type { DiffOp } from '@/lib/text-diff'
import type { ReactElement } from 'react'

import { RichTextContent } from '@/components/editor/RichTextContent'
import { looksLikeHtml } from '@/components/editor/sanitize'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { isEmptyHistoryValue } from '@/lib/history-display'
import {
  diffLines,
  diffSequence,
  diffWords,
  htmlToPlainText,
} from '@/lib/text-diff'
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

const isEmpty = isEmptyHistoryValue

/** Etiquetas de las dos versiones. «Actual» se evita a propósito: la versión
 * nueva de un cambio del historial no tiene por qué ser la vigente hoy. */
const VERSION_LABELS = {
  before: 'Versión original',
  after: 'Versión de este cambio',
} as const

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

/** Valor corto o numérico: se lee de un vistazo, así que va grande y centrado. */
function ShortValueDiff({ before, after }: { before: string; after: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8 sm:flex-row sm:gap-6">
      <div className="text-center">
        <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
          {VERSION_LABELS.before}
        </p>
        <p className="text-muted-foreground mt-1 text-2xl font-medium line-through decoration-1">
          {before}
        </p>
      </div>
      <ArrowRight className="text-muted-foreground/50 size-5 shrink-0 rotate-90 sm:rotate-0" />
      <div className="text-center">
        <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
          {VERSION_LABELS.after}
        </p>
        <p className="text-foreground mt-1 text-2xl font-semibold">{after}</p>
      </div>
    </div>
  )
}

/* ─────────────────── Texto largo: inline / dos columnas ─────────────────── */

type TextDiffView = 'inline' | 'split'

/** Vista unificada tipo GitHub: líneas quitadas y agregadas, una tras otra. */
function UnifiedTextDiff({ before, after }: { before: string; after: string }) {
  const rows = useMemo(() => diffLines(before, after), [before, after])

  return (
    <div className="overflow-hidden rounded-md border text-sm">
      {rows.map((row, index) => {
        if (row.type === 'equal') {
          return (
            <p
              key={index}
              className="text-muted-foreground px-3 py-1 leading-relaxed whitespace-pre-wrap"
            >
              <span aria-hidden="true" className="mr-3 opacity-40 select-none">
                &nbsp;
              </span>
              {row.after ?? row.before}
            </p>
          )
        }

        const lines: Array<{
          sign: '-' | '+'
          content: ReactElement | string
        }> = []
        if (row.type === 'delete' || row.type === 'replace') {
          lines.push({
            sign: '-',
            content: row.ops ? (
              <SideTokens ops={row.ops} side="left" />
            ) : (
              (row.before ?? '')
            ),
          })
        }
        if (row.type === 'insert' || row.type === 'replace') {
          lines.push({
            sign: '+',
            content: row.ops ? (
              <SideTokens ops={row.ops} side="right" />
            ) : (
              (row.after ?? '')
            ),
          })
        }

        return (
          <Fragment key={index}>
            {lines.map((line) => (
              <p
                key={line.sign}
                className={cn(
                  'px-3 py-1 leading-relaxed whitespace-pre-wrap',
                  line.sign === '-'
                    ? 'bg-destructive/10 text-foreground'
                    : 'bg-emerald-500/10',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'mr-3 font-mono select-none',
                    line.sign === '-'
                      ? 'text-destructive'
                      : 'text-emerald-700 dark:text-emerald-400',
                  )}
                >
                  {line.sign}
                </span>
                {line.content}
              </p>
            ))}
          </Fragment>
        )
      })}
    </div>
  )
}

/** Vista de dos columnas para el mismo texto. */
function SplitTextDiff({ before, after }: { before: string; after: string }) {
  const ops = useMemo(() => diffWords(before, after), [before, after])

  return (
    <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
      <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
        {VERSION_LABELS.before}
      </p>
      <p className="text-muted-foreground hidden text-[10px] font-semibold tracking-widest uppercase md:block">
        {VERSION_LABELS.after}
      </p>
      <p className="border-destructive/40 border-l-2 pl-3 text-sm leading-relaxed whitespace-pre-wrap">
        <SideTokens ops={ops} side="left" />
      </p>
      <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase md:hidden">
        {VERSION_LABELS.after}
      </p>
      <p className="border-l-2 border-emerald-500/50 pl-3 text-sm leading-relaxed whitespace-pre-wrap">
        <SideTokens ops={ops} side="right" />
      </p>
    </div>
  )
}

function TextDiff({ before, after }: { before: string; after: string }) {
  const [view, setView] = useState<TextDiffView>('inline')

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-1">
        {(
          [
            { value: 'inline', icon: Rows3, label: 'Ver cambios en línea' },
            { value: 'split', icon: Columns2, label: 'Ver en dos columnas' },
          ] as const
        ).map((option) => (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant={view === option.value ? 'secondary' : 'ghost'}
                aria-label={option.label}
                aria-pressed={view === option.value}
                onClick={() => setView(option.value)}
              >
                <option.icon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{option.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      {view === 'inline' ? (
        <UnifiedTextDiff before={before} after={after} />
      ) : (
        <SplitTextDiff before={before} after={after} />
      )}
    </div>
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

  // Valores cortos (números, códigos, nombres): la comparación directa se
  // entiende sola y no necesita diff palabra por palabra.
  const short =
    !before.includes('\n') &&
    !after.includes('\n') &&
    before.length <= 48 &&
    after.length <= 48

  if (short) return <ShortValueDiff before={before} after={after} />

  return <TextDiff before={before} after={after} />
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
        <span>{VERSION_LABELS.before}</span>
        <span>{VERSION_LABELS.after}</span>
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

  // Alta o baja: no hay dos versiones que comparar, así que se muestra el
  // único contenido que existe en lugar de contrastarlo contra «sin
  // información», que no aporta nada.
  if (isEmpty(from)) {
    return (
      <div className="border-l-2 border-emerald-500/50 pl-3">
        <HistoryValue value={to} />
      </div>
    )
  }

  if (isEmpty(to)) {
    return (
      <div className="border-destructive/40 border-l-2 pl-3 opacity-80">
        <HistoryValue value={from} />
      </div>
    )
  }

  if (isStructured(from) || isStructured(to)) {
    return <SplitDiff from={from} to={to} />
  }

  return <ScalarDiff from={from} to={to} />
}

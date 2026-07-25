/**
 * Diff textual mínimo (LCS) para el historial de cambios.
 *
 * En lugar de mostrar dos versiones lado a lado, calculamos qué se quitó y qué
 * se agregó y lo mostramos en una sola línea de lectura: lo eliminado tachado,
 * lo nuevo resaltado. Sin dependencias externas.
 */

export type DiffOpType = 'equal' | 'insert' | 'delete'

export type DiffOp = {
  type: DiffOpType
  value: string
}

export type SequenceOp = {
  type: DiffOpType
  /** índice en la secuencia "antes" (delete/equal) */
  aIndex: number | null
  /** índice en la secuencia "después" (insert/equal) */
  bIndex: number | null
}

// Cota de seguridad: entradas patológicas caen a un reemplazo total en vez de
// construir una matriz LCS gigantesca.
const MAX_TOKENS = 6000

function lcsLengths(a: Array<string>, b: Array<string>): Array<Array<number>> {
  const m = a.length
  const n = b.length
  const dp: Array<Array<number>> = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  )

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  return dp
}

/** Ops con índices (para diffear secuencias de objetos/ítems, no solo texto). */
export function diffSequence(
  a: Array<string>,
  b: Array<string>,
): Array<SequenceOp> {
  if (a.length + b.length > MAX_TOKENS) {
    return [
      ...a.map((_, i) => ({
        type: 'delete' as const,
        aIndex: i,
        bIndex: null,
      })),
      ...b.map((_, j) => ({
        type: 'insert' as const,
        aIndex: null,
        bIndex: j,
      })),
    ]
  }

  const dp = lcsLengths(a, b)
  const ops: Array<SequenceOp> = []
  let i = 0
  let j = 0

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ type: 'equal', aIndex: i, bIndex: j })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'delete', aIndex: i, bIndex: null })
      i++
    } else {
      ops.push({ type: 'insert', aIndex: null, bIndex: j })
      j++
    }
  }
  while (i < a.length) ops.push({ type: 'delete', aIndex: i++, bIndex: null })
  while (j < b.length) ops.push({ type: 'insert', aIndex: null, bIndex: j++ })

  return ops
}

function coalesce(ops: Array<DiffOp>): Array<DiffOp> {
  const merged: Array<DiffOp> = []
  for (const op of ops) {
    const last = merged.at(-1)
    if (last && last.type === op.type) last.value += op.value
    else merged.push({ ...op })
  }
  return merged
}

function diffTokens(a: Array<string>, b: Array<string>): Array<DiffOp> {
  const seq = diffSequence(a, b)
  const ops: Array<DiffOp> = seq.map((op) =>
    op.type === 'insert'
      ? { type: 'insert', value: b[op.bIndex as number] }
      : op.type === 'delete'
        ? { type: 'delete', value: a[op.aIndex as number] }
        : { type: 'equal', value: a[op.aIndex as number] },
  )
  return coalesce(ops)
}

// Palabras y espacios como tokens independientes: así una palabra cambiada no
// arrastra el espacio contiguo al resaltado.
function tokenizeWords(value: string): Array<string> {
  return value.match(/(\s+|[^\s]+)/g) ?? []
}

/** Diff palabra por palabra entre dos textos. */
export function diffWords(before: string, after: string): Array<DiffOp> {
  return diffTokens(tokenizeWords(before), tokenizeWords(after))
}

export type LineDiffRow = {
  type: DiffOpType | 'replace'
  before: string | null
  after: string | null
  /** Diff palabra por palabra cuando la línea se reemplazó por otra. */
  ops?: Array<DiffOp>
}

/**
 * Diff por líneas al estilo GitHub: las líneas borradas e insertadas contiguas
 * se emparejan como «modificada» para poder resaltar la palabra que cambió.
 */
export function diffLines(before: string, after: string): Array<LineDiffRow> {
  const a = before.split('\n')
  const b = after.split('\n')
  const rows: Array<LineDiffRow> = []
  const pendingA: Array<string> = []
  const pendingB: Array<string> = []

  const flush = () => {
    const paired = Math.min(pendingA.length, pendingB.length)
    for (let i = 0; i < paired; i++) {
      rows.push({
        type: 'replace',
        before: pendingA[i],
        after: pendingB[i],
        ops: diffWords(pendingA[i], pendingB[i]),
      })
    }
    for (let i = paired; i < pendingA.length; i++) {
      rows.push({ type: 'delete', before: pendingA[i], after: null })
    }
    for (let i = paired; i < pendingB.length; i++) {
      rows.push({ type: 'insert', before: null, after: pendingB[i] })
    }
    pendingA.length = 0
    pendingB.length = 0
  }

  for (const op of diffSequence(a, b)) {
    if (op.type === 'equal') {
      flush()
      rows.push({
        type: 'equal',
        before: a[op.aIndex as number],
        after: b[op.bIndex as number],
      })
    } else if (op.type === 'delete') {
      pendingA.push(a[op.aIndex as number])
    } else {
      pendingB.push(b[op.bIndex as number])
    }
  }
  flush()

  return rows
}

/** Convierte HTML enriquecido a texto plano legible para poder diffearlo. */
export function htmlToPlainText(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6]|ul|ol|blockquote|pre|tr)\s*>/gi, '\n')

  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(withBreaks, 'text/html')
    const text = (doc.body.textContent as string | null) ?? ''
    return text.replace(/\n{3,}/g, '\n\n').trim()
  }

  return withBreaks
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

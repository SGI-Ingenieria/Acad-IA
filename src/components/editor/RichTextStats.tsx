import type { Editor } from '@tiptap/react'

function countSentences(text: string) {
  const matches = text.match(/[^.!?¿¡]+[.!?]+|[^.!?¿¡]+$/g)
  return matches?.filter((s) => s.trim().length > 0).length ?? 0
}

function formatDuration(minutes: number) {
  if (minutes <= 0) return '0 min'
  if (minutes < 1) return '< 1 min'
  return `${Math.ceil(minutes)} min`
}

export function getRichTextStats(editor: Editor | null) {
  const text = editor?.getText() ?? ''
  const trimmed = text.trim()
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0
  const lines = text ? text.split(/\n/).length : 0
  const paragraphs = trimmed
    ? text.split(/\n{2,}/).filter((p) => p.trim().length > 0).length || 1
    : 0

  return {
    chars: text.length,
    charsNoSpaces: text.replace(/\s/g, '').length,
    words,
    lines,
    paragraphs,
    sentences: trimmed ? countSentences(trimmed) : 0,
    readingTime: formatDuration(words / 225),
    speakingTime: formatDuration(words / 155),
  }
}

export function RichTextStats({ editor }: { editor: Editor | null }) {
  const stats = getRichTextStats(editor)
  const items = [
    ['Caracteres', stats.chars],
    ['Sin espacios', stats.charsNoSpaces],
    ['Palabras', stats.words],
    ['Lineas', stats.lines],
    ['Parrafos', stats.paragraphs],
    ['Oraciones', stats.sentences],
    ['Lectura', stats.readingTime],
    ['Habla', stats.speakingTime],
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="border-border rounded-lg border p-3">
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <p className="text-foreground mt-1 text-lg font-semibold tabular-nums">
            {value}
          </p>
        </div>
      ))}
    </div>
  )
}

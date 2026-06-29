import { Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'

import { RichTextContent } from './RichTextContent'
import { sanitizeHtml } from './sanitize'

import type { DraftEntity } from '@/data/api/drafts.api'
import type { Editor } from '@tiptap/react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAIImproveField } from '@/data/hooks/useAI'
import { notify } from '@/lib/toast'

export function IACampoPanel({
  editor,
  entidad,
  entidadId,
  clave,
  campoSchema,
  esRichtext,
}: {
  editor: Editor | null
  entidad: DraftEntity
  entidadId: string
  clave: string
  campoSchema?: Record<string, unknown>
  esRichtext: boolean
}) {
  const improve = useAIImproveField()
  const [prompt, setPrompt] = useState('')
  const [preview, setPreview] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!editor || !prompt.trim()) return

    try {
      const result = await improve.mutateAsync({
        entidad,
        entidad_id: entidadId,
        clave,
        campo_schema: campoSchema ?? null,
        contenido_actual: sanitizeHtml(editor.getHTML()),
        prompt_usuario: prompt.trim(),
        es_richtext: esRichtext,
      })
      setPreview(sanitizeHtml(result.contenido_mejorado))
    } catch (error) {
      notify.error(error, {
        description: 'No se pudo generar la mejora del campo.',
      })
    }
  }

  const handleApply = () => {
    if (!editor || !preview) return
    editor.commands.setContent(sanitizeHtml(preview))
    setPreview(null)
    notify.success('Mejora aplicada al editor')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="space-y-2">
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe el ajuste que quieres aplicar..."
          className="min-h-24 text-sm"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={!editor || !prompt.trim() || improve.isPending}
          >
            {improve.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generar mejora
          </Button>
        </div>
      </div>

      {preview && (
        <div className="border-border bg-muted/30 min-h-0 flex-1 overflow-auto rounded-lg border p-4">
          <RichTextContent html={preview} />
        </div>
      )}

      {preview && (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setPreview(null)}
          >
            Descartar
          </Button>
          <Button type="button" onClick={handleApply}>
            Aplicar al editor
          </Button>
        </div>
      )}
    </div>
  )
}

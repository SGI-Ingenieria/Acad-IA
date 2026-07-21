import { useState } from 'react'

import { RichTextContent } from './RichTextContent'
import { sanitizeHtml } from './sanitize'

import type { DraftEntity } from '@/data/api/drafts.api'
import type { Editor } from '@tiptap/react'

import { AIRequestComposer } from '@/components/ia/AIRequestComposer'
import { Button } from '@/components/ui/button'
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
    if (!editor || !prompt.trim() || improve.isPending) return

    try {
      const result = await improve.mutateAsync({
        entidad,
        entidad_id: entidadId,
        clave,
        campo_schema: campoSchema ?? null,
        contenido_actual: sanitizeHtml(editor.getHTML()),
        prompt_usuario: prompt.trim(),
        es_richtext: esRichtext,
        // Edición puntual de campo: sin referencias y sin razonamiento para una
        // respuesta inmediata (el modelo GPT-5.6 admite reasoning "none").
        reasoning_effort: 'none',
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
      <AIRequestComposer
        value={prompt}
        onChange={setPrompt}
        webSearchEnabled={false}
        onWebSearchEnabledChange={() => undefined}
        showWebSearch={false}
        showAttachments={false}
        showReasoning={false}
        showVoice
        placeholder="Describe el ajuste que quieres aplicar..."
        disabled={improve.isPending || !editor}
        compact
        onSubmit={() => void handleGenerate()}
        submitting={improve.isPending}
        submitDisabled={!editor}
      />

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

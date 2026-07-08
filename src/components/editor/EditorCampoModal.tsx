import { useEditor } from '@tiptap/react'
import { Loader2, Save, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { IACampoPanel } from './IACampoPanel'
import { RichTextEditor, richTextExtensions } from './RichTextEditor'
import { RichTextStats } from './RichTextStats'
import { htmlFromPossiblyPlainText, sanitizeHtml } from './sanitize'

import type { BorradorCampo, DraftEntity } from '@/data/api/drafts.api'

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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  useDeleteFieldDraft,
  useUpsertFieldDraft,
} from '@/data/hooks/useDrafts'
import {
  getOrganicMotion,
  gsap,
  organicDuration,
  organicEase,
  useGSAP,
} from '@/lib/animations'
import { notify } from '@/lib/toast'

type EditorTab = 'editor' | 'stats' | 'ia'

export function EditorCampoModal({
  open,
  onOpenChange,
  entidad,
  entidadId,
  clave,
  title,
  description,
  valorActual,
  borrador,
  campoSchema,
  canUseIA,
  initialTab = 'editor',
  onAplicar,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entidad: DraftEntity
  entidadId: string
  clave: string
  title: string
  description?: string
  valorActual: unknown
  borrador?: BorradorCampo | null
  campoSchema?: Record<string, unknown>
  canUseIA?: boolean
  initialTab?: EditorTab
  onAplicar: (html: string) => Promise<void> | void
}) {
  const upsertDraft = useUpsertFieldDraft()
  const deleteDraft = useDeleteFieldDraft()
  const [tab, setTab] = useState<EditorTab>(initialTab)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [, setEditorVersion] = useState(0)
  const loadedHtmlRef = useRef('')
  const skipDraftOnCloseRef = useRef(false)
  const contentRef = useRef<HTMLDivElement | null>(null)

  const editor = useEditor({
    extensions: richTextExtensions,
    content: '<p></p>',
    immediatelyRender: false,
    onUpdate: () => setEditorVersion((version) => version + 1),
  })

  useEffect(() => {
    if (!open || !editor) return

    skipDraftOnCloseRef.current = false
    setTab(initialTab)

    const initialHtml = sanitizeHtml(
      borrador?.contenido_html ?? htmlFromPossiblyPlainText(valorActual),
    )
    editor.commands.setContent(initialHtml || '<p></p>')
    loadedHtmlRef.current = sanitizeHtml(editor.getHTML())
    setEditorVersion((version) => version + 1)
  }, [borrador?.contenido_html, editor, initialTab, open, valorActual])

  useGSAP(
    () => {
      if (!open || !contentRef.current || !getOrganicMotion()) return

      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 12, scale: 0.99 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: organicDuration.base,
          ease: organicEase,
          overwrite: 'auto',
        },
      )
    },
    { scope: contentRef, dependencies: [open, tab] },
  )

  const currentHtml = () => sanitizeHtml(editor?.getHTML() ?? '')

  const closeWithDraftIfNeeded = async () => {
    if (!editor) {
      onOpenChange(false)
      return
    }

    if (!skipDraftOnCloseRef.current) {
      const html = currentHtml()
      if (html !== loadedHtmlRef.current) {
        await upsertDraft.mutateAsync({
          entidad,
          entidadId,
          clave,
          contenidoHtml: html,
        })
        notify.success('Borrador guardado')
      }
    }

    onOpenChange(false)
  }

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true)
      return
    }

    void closeWithDraftIfNeeded().catch((error) => {
      notify.error(error, { description: 'No se pudo guardar el borrador.' })
    })
  }

  const handleApply = async () => {
    if (!editor) return

    try {
      setIsApplying(true)
      const html = currentHtml()
      await onAplicar(html)
      await deleteDraft.mutateAsync({ entidad, entidadId, clave })
      loadedHtmlRef.current = html
      skipDraftOnCloseRef.current = true
      notify.success('Campo actualizado')
      onOpenChange(false)
    } catch (error) {
      notify.error(error, {
        description: 'No se pudieron aplicar los cambios.',
      })
    } finally {
      setIsApplying(false)
    }
  }

  const handleDiscard = async () => {
    try {
      await deleteDraft.mutateAsync({ entidad, entidadId, clave })
      const initialHtml = sanitizeHtml(htmlFromPossiblyPlainText(valorActual))
      editor?.commands.setContent(initialHtml || '<p></p>')
      loadedHtmlRef.current = sanitizeHtml(editor?.getHTML() ?? initialHtml)
      skipDraftOnCloseRef.current = true
      notify.success('Edición descartada')
      setDiscardOpen(false)
      onOpenChange(false)
    } catch (error) {
      notify.error(error, { description: 'No se pudo descartar la edición.' })
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>

          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as EditorTab)}
            className="min-h-0 flex-1"
          >
            <TabsList className="w-full justify-start">
              <TabsTrigger value="editor">Editor</TabsTrigger>
              <TabsTrigger value="stats">Estadisticas</TabsTrigger>
              <TabsTrigger value="ia" disabled={!canUseIA}>
                Mejorar con IA
              </TabsTrigger>
            </TabsList>

            <div ref={contentRef} className="min-h-0 flex-1">
              <TabsContent value="editor" className="mt-3 min-h-0">
                <RichTextEditor editor={editor} />
              </TabsContent>
              <TabsContent value="stats" className="mt-3 min-h-0">
                <RichTextStats editor={editor} />
              </TabsContent>
              <TabsContent value="ia" className="mt-3 min-h-0">
                <IACampoPanel
                  editor={editor}
                  entidad={entidad}
                  entidadId={entidadId}
                  clave={clave}
                  campoSchema={campoSchema}
                  esRichtext
                />
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="border-border border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDiscardOpen(true)}
              disabled={deleteDraft.isPending || isApplying}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button type="button" onClick={handleApply} disabled={isApplying}>
              {isApplying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar esta edición?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el borrador guardado y los cambios actuales. Esta
              acción no tiene vuelta atrás.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void handleDiscard()
              }}
            >
              Descartar edición
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

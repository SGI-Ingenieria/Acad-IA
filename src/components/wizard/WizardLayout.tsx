import { X } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'

import { CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

export function WizardLayout({
  title,
  description,
  onClose,
  headerActions,
  headerSlot,
  footerSlot,
  contentKey,
  children,
}: {
  title: string
  description?: string
  onClose: () => void
  headerActions?: React.ReactNode
  headerSlot?: React.ReactNode
  footerSlot?: React.ReactNode
  /** Identifica la vista visible para devolver su área desplazable al inicio. */
  contentKey?: React.Key
  children: React.ReactNode
}) {
  const contentRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0 })
  }, [contentKey])

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        spacing="flush"
        showCloseButton={false}
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden sm:max-w-4xl"
        onInteractOutside={(e) => {
          e.preventDefault()
        }}
      >
        <div className="bg-card dark:bg-background z-10 flex-none border-b shadow-xs dark:shadow-none">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {description ?? `${title}: completa los pasos del asistente.`}
          </DialogDescription>
          <CardHeader className="gap-grupo p-seccion pb-control flex flex-row items-center justify-between">
            <CardTitle aria-hidden="true">{title}</CardTitle>
            <div className="gap-micro flex items-center">
              {headerActions}
              <button
                onClick={onClose}
                className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Cerrar</span>
              </button>
            </div>
          </CardHeader>

          {headerSlot ? (
            <div className="px-seccion pb-control">{headerSlot}</div>
          ) : null}
        </div>

        <div
          ref={contentRef}
          className="bg-secondary/35 dark:bg-muted/20 px-grupo py-seccion xl:px-seccion flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          {children}
        </div>

        {footerSlot ? (
          <div className="bg-card dark:bg-background p-seccion flex-none border-t">
            {footerSlot}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

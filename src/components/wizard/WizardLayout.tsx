import * as Icons from 'lucide-react'

import { CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'

export function WizardLayout({
  title,
  onClose,
  headerSlot,
  footerSlot,
  children,
}: {
  title: string
  onClose: () => void
  headerSlot?: React.ReactNode
  footerSlot?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex h-[90vh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
        onInteractOutside={(e) => {
          e.preventDefault()
        }}
      >
        <div className="bg-background z-10 flex-none border-b">
          <CardHeader className="flex flex-row items-center justify-between gap-4 p-6 pb-3">
            <CardTitle>{title}</CardTitle>
            <button
              onClick={onClose}
              className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none"
            >
              <Icons.X className="h-4 w-4" />
              <span className="sr-only">Cerrar</span>
            </button>
          </CardHeader>

          {headerSlot ? <div className="px-6 pb-3">{headerSlot}</div> : null}
        </div>

        <div className="bg-muted/20 flex-1 overflow-y-auto px-4 py-3 xl:px-6">
          {children}
        </div>

        {footerSlot ? (
          <div className="bg-background flex-none border-t p-6">
            {footerSlot}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

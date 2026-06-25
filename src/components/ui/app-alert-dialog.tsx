import { useEffect, useMemo, useRef, useState } from 'react'

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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type DialogVariant = 'default' | 'destructive'

type AlertRequest = {
  kind: 'alert'
  title: string
  description?: string
  confirmLabel?: string
  variant?: DialogVariant
  resolve: () => void
}

type ConfirmRequest = {
  kind: 'confirm'
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: DialogVariant
  resolve: (confirmed: boolean) => void
}

type PromptRequest = {
  kind: 'prompt'
  title: string
  description?: string
  label?: string
  placeholder?: string
  initialValue?: string
  confirmLabel?: string
  cancelLabel?: string
  required?: boolean
  variant?: DialogVariant
  resolve: (value: string | null) => void
}

type DialogRequest = AlertRequest | ConfirmRequest | PromptRequest

type DialogOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: DialogVariant
}

type PromptOptions = DialogOptions & {
  label?: string
  placeholder?: string
  initialValue?: string
  required?: boolean
}

let openDialog: ((request: DialogRequest) => void) | null = null

function unavailable<T>(fallback: T) {
  console.error('No hay proveedor de AlertDialog montado para la confirmacion.')
  return fallback
}

export function showAppAlert(options: DialogOptions): Promise<void> {
  return new Promise((resolve) => {
    if (!openDialog) {
      resolve(unavailable(undefined))
      return
    }

    openDialog({
      kind: 'alert',
      title: options.title,
      description: options.description,
      confirmLabel: options.confirmLabel,
      variant: options.variant,
      resolve,
    })
  })
}

export function showAppConfirm(options: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!openDialog) {
      resolve(unavailable(false))
      return
    }

    openDialog({
      kind: 'confirm',
      title: options.title,
      description: options.description,
      confirmLabel: options.confirmLabel,
      cancelLabel: options.cancelLabel,
      variant: options.variant,
      resolve,
    })
  })
}

export function showAppPrompt(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    if (!openDialog) {
      resolve(unavailable(null))
      return
    }

    openDialog({
      kind: 'prompt',
      title: options.title,
      description: options.description,
      label: options.label,
      placeholder: options.placeholder,
      initialValue: options.initialValue,
      confirmLabel: options.confirmLabel,
      cancelLabel: options.cancelLabel,
      required: options.required,
      variant: options.variant,
      resolve,
    })
  })
}

export function AppAlertDialogProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [request, setRequest] = useState<DialogRequest | null>(null)
  const [promptValue, setPromptValue] = useState('')
  const resolvedRef = useRef(false)
  const promptRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    openDialog = (nextRequest) => {
      resolvedRef.current = false
      setPromptValue(
        nextRequest.kind === 'prompt' ? (nextRequest.initialValue ?? '') : '',
      )
      setRequest(nextRequest)
    }

    return () => {
      openDialog = null
    }
  }, [])

  useEffect(() => {
    if (request?.kind !== 'prompt') return
    const frame = window.requestAnimationFrame(() => {
      promptRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [request])

  const isPromptInvalid = useMemo(() => {
    if (request?.kind !== 'prompt') return false
    return Boolean(request.required && promptValue.trim().length === 0)
  }, [promptValue, request])

  const close = () => setRequest(null)

  const resolveCancel = () => {
    if (!request || resolvedRef.current) return
    resolvedRef.current = true
    if (request.kind === 'alert') request.resolve()
    if (request.kind === 'confirm') request.resolve(false)
    if (request.kind === 'prompt') request.resolve(null)
    close()
  }

  const resolveConfirm = () => {
    if (!request || resolvedRef.current) return
    resolvedRef.current = true
    if (request.kind === 'alert') request.resolve()
    if (request.kind === 'confirm') request.resolve(true)
    if (request.kind === 'prompt') request.resolve(promptValue.trim())
    close()
  }

  const confirmLabel =
    request?.confirmLabel ??
    (request?.kind === 'alert'
      ? 'Entendido'
      : request?.kind === 'prompt'
        ? 'Continuar'
        : 'Confirmar')

  return (
    <>
      {children}
      <AlertDialog
        open={Boolean(request)}
        onOpenChange={(open) => {
          if (!open) resolveCancel()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.title}</AlertDialogTitle>
            {request?.description && (
              <AlertDialogDescription>
                {request.description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>

          {request?.kind === 'prompt' && (
            <div className="grid gap-2">
              <Label htmlFor="app-alert-dialog-prompt">
                {request.label ?? 'Motivo'}
              </Label>
              <Textarea
                id="app-alert-dialog-prompt"
                ref={promptRef}
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                placeholder={request.placeholder}
                className="min-h-24"
              />
              {isPromptInvalid && (
                <p className="text-destructive text-xs font-medium">
                  Este campo es obligatorio.
                </p>
              )}
            </div>
          )}

          <AlertDialogFooter>
            {request?.kind !== 'alert' && (
              <AlertDialogCancel onClick={resolveCancel}>
                {request?.cancelLabel ?? 'Cancelar'}
              </AlertDialogCancel>
            )}
            <AlertDialogAction
              disabled={isPromptInvalid}
              onClick={(event) => {
                if (isPromptInvalid) {
                  event.preventDefault()
                  return
                }
                resolveConfirm()
              }}
              className={
                request?.variant === 'destructive'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

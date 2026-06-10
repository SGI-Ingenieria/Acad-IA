import { toast as sonner } from 'sonner'

import type { ExternalToast } from 'sonner'

type ToastId = string | number

type ActionConfig = {
  label: string
  onClick: () => void
}

type CommonOptions = {
  id?: ToastId
  description?: string
  duration?: number
  action?: ActionConfig
}

type PromiseMessages<T> = {
  loading: string
  success: string | ((data: T) => string)
  error?: string | ((err: unknown) => string)
}

const extractErrorMessage = (err: unknown): string => {
  if (!err) return 'Ocurrió un error inesperado.'
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  if (typeof err === 'object') {
    const anyErr = err as Record<string, unknown>
    if (typeof anyErr.message === 'string') return anyErr.message
    if (typeof anyErr.error === 'string') return anyErr.error
    if (typeof anyErr.error_description === 'string')
      return anyErr.error_description
    if (typeof anyErr.hint === 'string') return anyErr.hint
  }
  return 'Ocurrió un error inesperado.'
}

const toSonnerOptions = (opts?: CommonOptions): ExternalToast | undefined => {
  if (!opts) return undefined
  const { id, description, duration, action } = opts
  const out: ExternalToast = {}
  if (id !== undefined) out.id = id
  if (description !== undefined) out.description = description
  if (duration !== undefined) out.duration = duration
  if (action) out.action = { label: action.label, onClick: action.onClick }
  return out
}

export const notify = {
  success(message: string, opts?: CommonOptions): ToastId {
    return sonner.success(message, toSonnerOptions(opts))
  },

  error(message: string | unknown, opts?: CommonOptions): ToastId {
    const finalMessage =
      typeof message === 'string' ? message : extractErrorMessage(message)
    return sonner.error(finalMessage, toSonnerOptions(opts))
  },

  info(message: string, opts?: CommonOptions): ToastId {
    return sonner.info(message, toSonnerOptions(opts))
  },

  warning(message: string, opts?: CommonOptions): ToastId {
    return sonner.warning(message, toSonnerOptions(opts))
  },

  loading(message: string, opts?: CommonOptions): ToastId {
    return sonner.loading(message, toSonnerOptions(opts))
  },

  /**
   * Wraps a promise with loading → success/error transitions.
   * Reuses a single toast slot so the UI doesn't pile up notifications.
   */
  promise<T>(
    promise: Promise<T> | (() => Promise<T>),
    messages: PromiseMessages<T>,
    opts?: Omit<CommonOptions, 'description'>,
  ): ToastId {
    const p = typeof promise === 'function' ? promise() : promise
    return sonner.promise(p, {
      loading: messages.loading,
      success: messages.success,
      error: (err) =>
        typeof messages.error === 'function'
          ? messages.error(err)
          : (messages.error ?? extractErrorMessage(err)),
      ...toSonnerOptions(opts),
    }) as ToastId
  },

  dismiss(id?: ToastId): void {
    if (id === undefined) sonner.dismiss()
    else sonner.dismiss(id)
  },
}

export { extractErrorMessage }

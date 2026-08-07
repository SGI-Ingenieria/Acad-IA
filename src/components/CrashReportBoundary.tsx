import { Component } from 'react'

import type { ErrorInfo, ReactNode } from 'react'

import { reportFrontendCrash } from '@/lib/crash-reporter'

type CrashReportBoundaryProps = {
  children: ReactNode
}

type CrashReportBoundaryState = {
  hasError: boolean
}

export class CrashReportBoundary extends Component<
  CrashReportBoundaryProps,
  CrashReportBoundaryState
> {
  state: CrashReportBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(): CrashReportBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    reportFrontendCrash({
      error,
      componentStack: errorInfo.componentStack,
      source: 'react.error-boundary',
      severity: 'fatal',
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="bg-background text-foreground p-seccion flex min-h-screen items-center justify-center">
          <section className="border-border bg-card p-seccion max-w-md rounded-lg border text-center shadow-sm">
            <h1 className="text-xl font-semibold">Algo salió mal</h1>
            <p className="text-muted-foreground mt-relacionado text-sm">
              El error quedó registrado. Recarga la página para continuar.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-seccion px-grupo py-relacionado rounded-md text-sm font-medium transition-colors"
            >
              Recargar
            </button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

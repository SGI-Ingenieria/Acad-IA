import { TanStackDevtools } from '@tanstack/react-devtools'
import { useQueryClient } from '@tanstack/react-query'
import {
  Outlet,
  createRootRouteWithContext,
  redirect,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { useEffect, useRef } from 'react'

import Header from '../components/Header'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import type { QueryClient } from '@tanstack/react-query'

import { ConnectivityBanner } from '@/components/observability/ConnectivityBanner'
import { AppAlertDialogProvider } from '@/components/ui/app-alert-dialog'
import { NotFoundPage } from '@/components/ui/NotFoundPage'
import { qk } from '@/data/query/keys'
import { resumePersistedGenerations } from '@/data/realtime/watchAIGeneration'
import { supabaseBrowser } from '@/data/supabase/client'
import { AgenteAurora, AgenteDock, AgenteProvider } from '@/features/agente'
import { PlanCommentsProvider } from '@/features/comentarios/PlanCommentsContext'
import { reportFrontendCrash } from '@/lib/crash-reporter'

interface MyRouterContext {
  queryClient: QueryClient
}

function RootComponent() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const isFullScreenChat = useRouterState({
    select: (state) =>
      state.matches.some(
        (match) =>
          match.routeId === '/planes/$planId/_detalle/iaplan_/chat' ||
          match.routeId ===
            '/planes/$planId/asignaturas/$asignaturaId/iaasignatura_/chat',
      ),
  })

  const resumedRef = useRef(false)
  useEffect(() => {
    if (resumedRef.current) return
    resumedRef.current = true
    resumePersistedGenerations({
      queryClient,
      navigate: (path, opts) =>
        navigate({
          to: path,
          state: { showConfetti: opts?.showConfetti },
        } as any),
    })
  }, [queryClient, navigate])

  return (
    <AppAlertDialogProvider>
      {/* El modo agente vive en el root, no en los layouts de ruta: tiene que
          sobrevivir a moverse entre pestañas del plan, entrar a una asignatura
          y volver — el mismo motivo por el que aquí se reanudan los watchers
          de generación. El chat a pantalla completa es la excepción: ahí la IA
          ya es la interfaz entera. */}
      <AgenteProvider>
        <PlanCommentsProvider>
          {!isFullScreenChat && <Header />}
          {!isFullScreenChat && <ConnectivityBanner />}
          <Outlet />
        </PlanCommentsProvider>
        {!isFullScreenChat && <AgenteAurora />}
        {!isFullScreenChat && <AgenteDock />}
      </AgenteProvider>
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'Tanstack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
          TanStackQueryDevtools,
        ]}
      />
    </AppAlertDialogProvider>
  )
}

function RootErrorComponent({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  useEffect(() => {
    reportFrontendCrash({
      error,
      source: 'router.error-component',
      severity: 'error',
      context: {
        route: window.location.pathname,
      },
    })
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4 p-6 text-center">
      <h2 className="text-destructive text-2xl font-bold">
        ¡Ups! Algo salió mal
      </h2>
      <p className="text-muted-foreground max-w-md">
        Ocurrió un error inesperado al cargar esta sección.
      </p>

      <pre className="border-border bg-muted background-foreground max-w-full overflow-auto rounded-md border p-4 text-left text-xs">
        {error.message}
      </pre>

      <button
        onClick={reset}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 transition-colors"
      >
        Intentar de nuevo
      </button>
    </div>
  )
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ context, location }) => {
    if (
      location.pathname === '/login' ||
      location.pathname === '/update-password' ||
      location.pathname === '/registro'
    )
      return

    const session = await context.queryClient.ensureQueryData({
      queryKey: qk.session(),
      queryFn: async () => {
        const { data } = await supabaseBrowser().auth.getSession()
        return data.session ?? null
      },
      staleTime: 60_000,
    })

    if (!session) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
  component: RootComponent,

  notFoundComponent: () => <NotFoundPage />,

  errorComponent: RootErrorComponent,
})

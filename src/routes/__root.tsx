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

import { NotFoundPage } from '@/components/ui/NotFoundPage'
import { qk } from '@/data/query/keys'
import { resumePersistedGenerations } from '@/data/realtime/watchAIGeneration'
import { supabaseBrowser } from '@/data/supabase/client'

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
    <>
      {!isFullScreenChat && <Header />}
      <Outlet />
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
    </>
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

  errorComponent: ({ error, reset }) => {
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
  },
})

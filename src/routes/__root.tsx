import { TanStackDevtools } from '@tanstack/react-devtools'
import {
  Outlet,
  createRootRouteWithContext,
  redirect,
  useLocation,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

import Header from '../components/Header'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import type { QueryClient } from '@tanstack/react-query'

import { NotFoundPage } from '@/components/ui/NotFoundPage'
import { qk } from '@/data/query/keys'
import { supabaseBrowser } from '@/data/supabase/client'

interface MyRouterContext {
  queryClient: QueryClient
}

function RootComponent() {
  const location = useLocation()
  const isFullScreenChat = /^\/planes\/[^/]+\/iaplan\/chat$/.test(
    location.pathname,
  )

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
    if (location.pathname === '/login') return

    const session = await context.queryClient.ensureQueryData({
      queryKey: qk.session(),
      queryFn: async () => {
        const { data } = await supabaseBrowser().auth.getSession()
        return data.session ?? null
      },
      staleTime: 0,
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
        <h2 className="text-2xl font-bold text-red-600">
          ¡Ups! Algo salió mal
        </h2>
        <p className="max-w-md text-gray-600">
          Ocurrió un error inesperado al cargar esta sección.
        </p>

        <pre className="max-w-full overflow-auto rounded border border-gray-300 bg-gray-100 p-4 text-left text-xs">
          {error.message}
        </pre>

        <button
          onClick={reset}
          className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
        >
          Intentar de nuevo
        </button>
      </div>
    )
  },
})

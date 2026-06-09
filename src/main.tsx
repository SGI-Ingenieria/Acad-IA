import {
  RouterProvider,
  createRouteMask,
  createRouter,
} from '@tanstack/react-router'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'sonner'

import reportWebVitals from './reportWebVitals.ts'
import { routeTree } from './routeTree.gen'

import * as TanStackQueryProvider from '@/data/query/queryClient.tsx'

import './styles.css'

// Create a new router instance

const TanStackQueryProviderContext = TanStackQueryProvider.getContext()
const planIaplanChatMask = createRouteMask({
  routeTree,
  from: '/planes/$planId/_detalle/iaplan_/chat',
  to: '/planes/$planId/iaplan',
  params: (prev) => ({
    planId: prev.planId,
  }),
})

const router = createRouter({
  routeTree,
  context: {
    ...TanStackQueryProviderContext,
  },
  routeMasks: [planIaplanChatMask],
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
  interface HistoryState {
    showConfetti?: boolean
  }
}

// Render the app
const rootElement = document.getElementById('app')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <TanStackQueryProvider.Provider {...TanStackQueryProviderContext}>
        <Toaster
          richColors
          closeButton
          position="top-right"
          expand
          duration={5000}
        />
        <RouterProvider router={router} />
      </TanStackQueryProvider.Provider>
    </StrictMode>,
  )
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()

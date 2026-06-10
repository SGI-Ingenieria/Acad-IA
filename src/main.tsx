import {
  RouterProvider,
  createRouteMask,
  createRouter,
} from '@tanstack/react-router'
import { StrictMode, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'sonner'

import reportWebVitals from './reportWebVitals.ts'
import { routeTree } from './routeTree.gen'

import * as TanStackQueryProvider from '@/data/query/queryClient.tsx'

import './styles.css'

// Create a new router instance
type ThemeMode = 'light' | 'dark' | 'system'

const themeStorageKey = 'acad-ia-theme'
const themeChangeEvent = 'acad-ia-theme-change'

function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system'

  const stored = window.localStorage.getItem(themeStorageKey)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }

  return 'system'
}

function AppToaster() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme())

  useEffect(() => {
    const syncStoredTheme = () => setThemeMode(getStoredTheme())
    const handleThemeChange = (event: Event) => {
      const nextTheme = (event as CustomEvent<unknown>).detail
      if (
        nextTheme === 'light' ||
        nextTheme === 'dark' ||
        nextTheme === 'system'
      ) {
        setThemeMode(nextTheme)
        return
      }

      syncStoredTheme()
    }

    window.addEventListener('storage', syncStoredTheme)
    window.addEventListener(themeChangeEvent, handleThemeChange)

    return () => {
      window.removeEventListener('storage', syncStoredTheme)
      window.removeEventListener(themeChangeEvent, handleThemeChange)
    }
  }, [])

  return (
    <Toaster
      theme={themeMode}
      closeButton
      position="top-right"
      expand
      duration={5000}
    />
  )
}

const TanStackQueryProviderContext = TanStackQueryProvider.getContext()
const planIaplanChatMask = createRouteMask({
  routeTree,
  from: '/planes/$planId/_detalle/iaplan_/chat',
  to: '/planes/$planId/iaplan',
  params: (prev) => ({
    planId: prev.planId,
  }),
})
const subjectIaChatMask = createRouteMask({
  routeTree,
  from: '/planes/$planId/asignaturas/$asignaturaId/iaasignatura_/chat',
  to: '/planes/$planId/asignaturas/$asignaturaId/iaasignatura',
  params: (prev) => ({
    planId: prev.planId,
    asignaturaId: prev.asignaturaId,
  }),
})

const router = createRouter({
  routeTree,
  context: {
    ...TanStackQueryProviderContext,
  },
  routeMasks: [planIaplanChatMask, subjectIaChatMask],
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
        <AppToaster />
        <RouterProvider router={router} />
      </TanStackQueryProvider.Provider>
    </StrictMode>,
  )
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()

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

import { CrashReportBoundary } from '@/components/CrashReportBoundary.tsx'
import * as TanStackQueryProvider from '@/data/query/queryClient.tsx'
import { installCrashReporter } from '@/lib/crash-reporter.ts'

import './styles.css'

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
  from: '/planes/$planId/iaplan/chat',
  to: '/planes/$planId/iaplan',
  params: (prev) => ({
    planId: prev.planId,
  }),
})
const subjectIaChatMask = createRouteMask({
  routeTree,
  from: '/planes/$planId/asignaturas/$asignaturaId/iaasignatura/chat',
  to: '/planes/$planId/asignaturas/$asignaturaId/iaasignatura',
  params: (prev) => ({
    planId: prev.planId,
    asignaturaId: prev.asignaturaId,
  }),
})

const router = createRouter({
  routeTree,
  // Mantiene las rutas SPA bajo /Acad-IA/ en GitHub Pages y bajo / en Azure.
  basepath: import.meta.env.BASE_URL,
  context: {
    ...TanStackQueryProviderContext,
  },
  routeMasks: [planIaplanChatMask, subjectIaChatMask],
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
  // Cada ruta renderiza su propio shell de inmediato y muestra skeletons solo
  // en las zonas que dependen de datos.
  defaultPendingMs: 0,
})

installCrashReporter()

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
  interface HistoryState {
    showConfetti?: boolean
    reopenContextualPanel?: 'plan-ia' | 'subject-ia'
  }
}

// Render the app
const rootElement = document.getElementById('app')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <CrashReportBoundary>
        <TanStackQueryProvider.Provider {...TanStackQueryProviderContext}>
          <AppToaster />
          <RouterProvider router={router} />
        </TanStackQueryProvider.Provider>
      </CrashReportBoundary>
    </StrictMode>,
  )
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()

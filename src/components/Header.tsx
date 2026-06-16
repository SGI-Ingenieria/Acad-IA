import { Link, useNavigate } from '@tanstack/react-router'
import {
  BookOpenText,
  LaptopMinimal,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Moon,
  SunMedium,
  MonitorCog,
  X,
  Users,
  Building2,
  Layers,
  GitBranch,
  Archive,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { useSession } from '@/data/hooks/useAuth'
import { supabaseBrowser } from '@/data/supabase/client'

type ThemeMode = 'light' | 'dark' | 'system'

const protectedNavItems = [
  {
    to: '/',
    label: 'Inicio',
    description: 'Resumen general',
    icon: LayoutDashboard,
  },
  {
    to: '/planes',
    label: 'Planes',
    description: 'Catálogo y revisión',
    icon: BookOpenText,
  },
  {
    to: '/referencias',
    label: 'Archivos',
    description: 'Gestión de archivos y documentos',
    icon: Archive,
  },
  {
    to: '/usuarios',
    label: 'Usuarios',
    description: 'Gestión de usuarios',
    icon: Users,
  },
  {
    to: '/facultades',
    label: 'Facultades y Carreras',
    description: 'Gestión de facultades y carreras',
    icon: Building2,
  },
  {
    to: '/estructuras',
    label: 'Estructuras',
    description: 'Estructuras curriculares',
    icon: Layers,
  },
  {
    to: '/flujos-estados',
    label: 'Flujos y Estados',
    description: 'Flujos de aprobación',
    icon: GitBranch,
  },
] as const

const loginNavItem = {
  to: '/login',
  label: 'Acceso',
  description: 'Entrar al sistema',
  icon: LogIn,
} as const

const linkClassName =
  'organic-interactive group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground'

const activeLinkClassName =
  'organic-interactive group flex items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground'

const themeStorageKey = 'acad-ia-theme'
const themeChangeEvent = 'acad-ia-theme-change'

const themeOptions: Array<{
  value: ThemeMode
  label: string
  icon: typeof SunMedium
}> = [
  {
    value: 'light',
    label: 'Claro',
    icon: SunMedium,
  },
  {
    value: 'system',
    label: 'Sistema',
    icon: MonitorCog,
  },
  {
    value: 'dark',
    label: 'Oscuro',
    icon: Moon,
  },
]

function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'system'
  }

  const stored = window.localStorage.getItem(themeStorageKey)

  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }

  return 'system'
}

export default function Header() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme())
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { data: session } = useSession()
  const navigate = useNavigate()
  const isAuthenticated = !!session

  const handleLogout = async () => {
    setIsOpen(false)
    await supabaseBrowser().auth.signOut()
    navigate({ to: '/login', replace: true, search: { redirect: '/' } })
  }

  const navItems = isAuthenticated ? protectedNavItems : [loginNavItem]

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement

    if (themeMode === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', isDark)
    } else {
      root.classList.toggle('dark', themeMode === 'dark')
    }
  }, [mounted, themeMode])

  useEffect(() => {
    if (!isOpen) return undefined

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  useEffect(() => {
    window.localStorage.setItem(themeStorageKey, themeMode)
    window.dispatchEvent(
      new CustomEvent(themeChangeEvent, {
        detail: themeMode,
      }),
    )
  }, [themeMode])

  return (
    <>
      <header className="border-border/80 bg-background/85 text-foreground sticky top-0 z-50 border-b shadow-[0_10px_30px_rgba(2,6,23,0.08)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 lg:px-8">
          <button
            onClick={() => setIsOpen(true)}
            className="organic-interactive border-border bg-background/80 hover:bg-accent hover:text-accent-foreground inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border sm:h-11 sm:w-11 sm:rounded-2xl"
            aria-label="Open navigation menu"
          >
            <Menu size={22} />
          </button>

          <Link
            to="/"
            className="organic-interactive hover:bg-accent/60 mx-auto flex max-w-3xl min-w-0 flex-none items-center gap-2 rounded-xl px-1.5 py-1.5 sm:gap-3 sm:rounded-2xl sm:px-2"
            onClick={() => setIsOpen(false)}
          >
            {/* Cambia el logo según el modo de tema (usa mounted para soportar SSR) */}
            <img
              src={
                mounted &&
                (themeMode === 'light' ||
                  (themeMode === 'system' &&
                    window.matchMedia('(prefers-color-scheme: light)').matches))
                  ? '/lasalle-logo-light.svg'
                  : '/lasalle-logo.svg'
              }
              alt="La Salle"
              className="bg-background/80 ring-border h-9 w-9 shrink-0 rounded-lg p-1 ring-1 sm:h-10 sm:w-10 sm:rounded-xl"
            />

            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-semibold tracking-wide">
                Acad-IA
              </p>

              <p className="text-muted-foreground hidden truncate text-xs sm:block">
                Gestión académica y revisión de planes
              </p>
            </div>
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            {themeOptions.map((option) => {
              const Icon = option.icon
              const isActive = themeMode === option.value

              return (
                <button
                  key={option.value}
                  onClick={() => setThemeMode(option.value)}
                  className={`organic-interactive inline-flex h-9 w-9 items-center justify-center gap-2 rounded-full text-xs font-medium sm:w-auto sm:px-3 sm:py-1.5 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                  aria-pressed={isActive}
                  aria-label={`Cambiar a modo ${option.label.toLowerCase()}`}
                  title={option.label}
                >
                  <Icon size={14} />
                  <span className="hidden xl:inline">{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {isOpen ? (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="bg-foreground/20 fixed inset-0 z-40 backdrop-blur-[2px]"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      <aside
        className={`organic-surface border-border bg-background/95 text-foreground fixed top-0 left-0 z-50 flex h-full w-[min(22rem,92vw)] transform flex-col border-r shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-border flex items-center justify-between border-b p-4">
          <div>
            <p className="text-foreground text-sm font-semibold">Acad-IA</p>
            <p className="text-muted-foreground text-xs">
              Universidad La Salle
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="organic-interactive border-border bg-background/80 hover:bg-accent hover:text-accent-foreground inline-flex h-9 w-9 items-center justify-center rounded-lg border"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={linkClassName}
                  activeProps={{ className: activeLinkClassName }}
                  onClick={() => setIsOpen(false)}
                >
                  <Icon size={20} />
                  <div className="flex-1 text-left">
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs opacity-60">{item.description}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </nav>

        {isAuthenticated && (
          <div className="border-border border-t px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-foreground truncate text-xs font-medium">
                  {session.user.email}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-2 flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition"
              >
                <LogOut size={14} />
                Salir
              </button>
            </div>
          </div>
        )}

        <div className="border-border border-t p-4">
          <div className="text-foreground mb-3 flex items-center gap-2 text-sm font-medium">
            <LaptopMinimal size={16} />
            Tema
          </div>
          <div className="flex gap-2">
            {themeOptions.map((option) => {
              const Icon = option.icon
              const isActive = themeMode === option.value

              return (
                <button
                  key={option.value}
                  onClick={() => setThemeMode(option.value)}
                  className={`organic-interactive inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                  aria-pressed={isActive}
                  aria-label={`Cambiar a modo ${option.label.toLowerCase()}`}
                >
                  <Icon size={14} />
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </aside>
    </>
  )
}

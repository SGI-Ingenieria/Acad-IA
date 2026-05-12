import { Link } from '@tanstack/react-router'
import {
  BookOpenText,
  LaptopMinimal,
  LayoutDashboard,
  LogIn,
  Menu,
  Moon,
  SunMedium,
  MonitorCog,
  X,
  Users,
  Building2,
  Layers,
  GitBranch,
  // Logo para archivos
  Archive,
} from 'lucide-react'
import { useEffect, useState } from 'react'

type ThemeMode = 'light' | 'dark' | 'system'

const navItems = [
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
    to: '/archivos',
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
  {
    to: '/login',
    label: 'Acceso',
    description: 'Entrar al sistema',
    icon: LogIn,
  },
] as const

const linkClassName =
  'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-accent-foreground'

const activeLinkClassName =
  'group flex items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground'

const themeStorageKey = 'acad-ia-theme'

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
  }, [themeMode])

  return (
    <>
      <header className="border-border/80 bg-background/85 text-foreground sticky top-0 z-50 border-b shadow-[0_10px_30px_rgba(2,6,23,0.08)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <button
            onClick={() => setIsOpen(true)}
            className="border-border bg-background/80 hover:bg-accent hover:text-accent-foreground inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition"
            aria-label="Open navigation menu"
          >
            <Menu size={22} />
          </button>

          <Link
            to="/"
            className="hover:bg-accent/60 flex min-w-0 items-center gap-3 rounded-2xl px-2 py-1.5 transition"
            onClick={() => setIsOpen(false)}
          >
            <img
              src="/lasalle-logo.svg"
              alt="La Salle"
              className="bg-background/80 ring-border h-10 w-10 shrink-0 rounded-xl p-1 ring-1"
            />
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-semibold tracking-wide">
                Acad-IA
              </p>
              <p className="text-muted-foreground truncate text-xs">
                Gestión académica y revisión de planes
              </p>
            </div>
          </Link>

          <div className="flex flex-1 items-center justify-center">
            <nav className="border-border bg-muted/40 flex items-center gap-1 rounded-full border p-1">
              {navItems.slice(0, 3).map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={linkClassName}
                    activeProps={{ className: activeLinkClassName }}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {themeOptions.map((option) => {
              const Icon = option.icon
              const isActive = themeMode === option.value

              return (
                <button
                  key={option.value}
                  onClick={() => setThemeMode(option.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                  aria-pressed={isActive}
                  aria-label={`Cambiar a modo ${option.label.toLowerCase()}`}
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
        className={`border-border bg-background/95 text-foreground fixed top-0 left-0 z-50 flex h-full w-[min(22rem,92vw)] transform flex-col border-r shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-in-out ${
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
            className="border-border bg-background/80 hover:bg-accent hover:text-accent-foreground inline-flex h-9 w-9 items-center justify-center rounded-lg border transition"
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
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
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

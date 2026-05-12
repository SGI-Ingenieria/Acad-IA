import { Link } from '@tanstack/react-router'
import {
  BookOpenText,
  LaptopMinimal,
  LayoutDashboard,
  LogIn,
  Menu,
  PanelsTopLeft,
  Moon,
  SunMedium,
  MonitorCog,
  X,
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
    to: '/dashboard',
    label: 'Panel',
    description: 'Vista operativa',
    icon: PanelsTopLeft,
  },
  {
    to: '/planes',
    label: 'Planes',
    description: 'Catálogo y revisión',
    icon: BookOpenText,
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

  const storedTheme = window.localStorage.getItem(themeStorageKey)

  return storedTheme === 'light' ||
    storedTheme === 'dark' ||
    storedTheme === 'system'
    ? storedTheme
    : 'system'
}

function applyTheme(themeMode: ThemeMode) {
  const root = document.documentElement
  const systemPrefersDark = window.matchMedia(
    '(prefers-color-scheme: dark)',
  ).matches
  const shouldUseDark =
    themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark)

  root.classList.toggle('dark', shouldUseDark)
  root.style.colorScheme = shouldUseDark ? 'dark' : 'light'
}

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredTheme)

  useEffect(() => {
    applyTheme(themeMode)

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleThemeChange = () => {
      if (themeMode === 'system') {
        applyTheme('system')
      }
    }

    mediaQuery.addEventListener('change', handleThemeChange)

    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange)
    }
  }, [themeMode])

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
            className="border-border bg-background/80 hover:bg-accent hover:text-accent-foreground inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition md:hidden"
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

          <div className="hidden flex-1 items-center justify-center lg:flex">
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

          <div className="ml-auto hidden items-center gap-3 sm:flex">
            <div className="border-border bg-background flex items-center overflow-hidden rounded-full border p-1 shadow-sm">
              {themeOptions.map((option) => {
                const Icon = option.icon
                const isActive = option.value === themeMode

                return (
                  <button
                    key={option.value}
                    type="button"
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
        </div>
      </header>

      {isOpen ? (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="bg-foreground/20 fixed inset-0 z-40 backdrop-blur-[2px] md:hidden"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      <aside
        className={`border-border bg-background/95 text-foreground fixed top-0 left-0 z-50 flex h-full w-[min(22rem,92vw)] transform flex-col border-r shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-border flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Navegación</h2>
            <p className="text-muted-foreground text-sm">
              Accesos rápidos a las secciones principales
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="border-border bg-background/80 hover:bg-accent hover:text-accent-foreground inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition"
            aria-label="Close navigation menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setIsOpen(false)}
                className={linkClassName}
                activeProps={{ className: activeLinkClassName }}
              >
                <span className="bg-muted text-primary group-data-[status=active]:bg-primary-foreground/15 group-data-[status=active]:text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="group-data-[status=active]:text-primary-foreground block truncate">
                    {item.label}
                  </span>
                  <span className="text-muted-foreground group-data-[status=active]:text-primary-foreground/80 block truncate text-xs">
                    {item.description}
                  </span>
                </span>
              </Link>
            )
          })}

          <div className="border-border bg-muted/40 mt-4 rounded-3xl border p-4 lg:hidden">
            <div className="text-foreground mb-3 flex items-center gap-2 text-sm font-medium">
              <LaptopMinimal size={16} />
              Tema
            </div>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((option) => {
                const Icon = option.icon
                const isActive = option.value === themeMode

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setThemeMode(option.value)}
                    className={`inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                    aria-pressed={isActive}
                  >
                    <Icon size={16} />
                    <span>{option.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </nav>
      </aside>
    </>
  )
}

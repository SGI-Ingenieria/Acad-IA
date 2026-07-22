import { Link, useNavigate } from '@tanstack/react-router'
import {
  Activity,
  BookOpenText,
  GraduationCap,
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
  Settings2,
  Archive,
  FileCheck2,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import type { AppPermission } from '@/data/auth/permissions'

import { RoleSimulationControl } from '@/components/authz/RoleSimulationControl'
import { useSession } from '@/data/hooks/useAuth'
import { usePermissions } from '@/data/hooks/usePermissions'
import { supabaseBrowser } from '@/data/supabase/client'

type ThemeMode = 'light' | 'dark' | 'system'

type ProtectedNavItem = {
  to: string
  label: string
  description: string
  icon: typeof LayoutDashboard
  permissions?: Array<AppPermission>
  allowBootstrap?: boolean
  adminOnly?: boolean
}

const protectedNavItems: Array<ProtectedNavItem> = [
  {
    to: '/',
    label: 'Inicio',
    icon: LayoutDashboard,
  },
  {
    to: '/planes',
    label: 'Planes',
    icon: BookOpenText,
    permissions: ['planes.ver'],
  },
  {
    to: '/registros-oficiales',
    label: 'Registros SEP',
    icon: FileCheck2,
    permissions: ['planes.ver'],
  },
  {
    to: '/asignaturas',
    label: 'Asignaturas',
    icon: GraduationCap,
    permissions: ['asignaturas.ver', 'planes.ver'],
  },
  {
    to: '/referencias',
    label: 'Archivos',
    icon: Archive,
    permissions: ['archivos.ver', 'archivos.gestionar'],
  },
  {
    to: '/usuarios',
    label: 'Usuarios',
    icon: Users,
    permissions: ['usuarios.ver', 'usuarios.gestionar'],
    allowBootstrap: true,
  },
  {
    to: '/facultades',
    label: 'Facultades y Carreras',
    icon: Building2,
  },
  {
    to: '/estructuras',
    label: 'Estructuras',
    icon: Layers,
    permissions: ['catalogos.gestionar'],
  },
  {
    to: '/flujos-estados',
    label: 'Administración',
    icon: Settings2,
    permissions: ['catalogos.gestionar'],
  },
  {
    to: '/observabilidad',
    label: 'Observabilidad',
    icon: Activity,
    adminOnly: true,
  },
]

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
  const permissions = usePermissions()
  const navigate = useNavigate()
  const isAuthenticated = !!session

  const handleLogout = async () => {
    setIsOpen(false)
    await supabaseBrowser().auth.signOut()
    navigate({ to: '/login', replace: true, search: { redirect: '/' } })
  }

  const navItems = isAuthenticated
    ? protectedNavItems.filter((item) => {
        if (item.adminOnly && !permissions.isAdmin) return false
        if (item.allowBootstrap && permissions.hasBootstrapAccess()) return true
        if (!item.permissions) return true
        return permissions.hasAny(item.permissions)
      })
    : [loginNavItem]

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
          {isAuthenticated ? <RoleSimulationControl /> : null}
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

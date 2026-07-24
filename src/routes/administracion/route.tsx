import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { Settings2 } from 'lucide-react'

import { usePermissions } from '@/data/hooks/usePermissions'
import {
  adminSections,
  canSeeAdminSection,
} from '@/features/administracion/sections'

export const Route = createFileRoute('/administracion')({
  component: AdministracionLayout,
})

/**
 * Layout de administración: encabezado + pestañas hacia cada área de gestión.
 * Las pestañas son enlaces (URL compartible, back/forward) y cada área conserva
 * su propio guard de permisos en su ruta hija.
 */
function AdministracionLayout() {
  const permissions = usePermissions()

  const visibleSections = adminSections.filter((section) =>
    canSeeAdminSection(
      {
        isAdmin: permissions.isAdmin,
        permissions: permissions.permissions,
        hasBootstrapAccess: permissions.hasBootstrapAccess(),
      },
      section,
    ),
  )

  // Las páginas hijas renderizan su propio `<main>`, por eso el layout usa un
  // contenedor neutro solo con el encabezado y las pestañas.
  return (
    <div className="bg-background min-h-screen w-full">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pt-6 md:px-6 lg:px-8 lg:pt-8">
        <div className="flex items-center gap-3">
          <div className="text-primary bg-primary/10 rounded-lg p-2">
            <Settings2 className="h-6 w-6" />
          </div>
          <h1 className="text-foreground text-3xl font-bold">Administración</h1>
        </div>

        <nav
          aria-label="Secciones de administración"
          className="bg-muted text-muted-foreground flex w-full items-center gap-1 rounded-md p-1"
        >
          {visibleSections.map((section) => {
            const Icon = section.icon
            return (
              <Link
                key={section.to}
                to={section.to}
                className="hover:text-foreground flex flex-1 items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors"
                activeProps={{
                  className:
                    'bg-background text-foreground flex flex-1 items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap shadow-sm',
                }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {section.label}
              </Link>
            )
          })}
        </nav>
      </div>

      <Outlet />
    </div>
  )
}

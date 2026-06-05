import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { Clock3, Folder, Search, Upload } from 'lucide-react'
import { useState } from 'react'

import { Button } from '../ui/button'
import { Input } from '../ui/input'

import { UploadFilesModal } from './modal/UploadFilesModal'

export function ReferencesLayout() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const location = useLocation()
  const isArchivos = location.pathname.startsWith('/referencias/archivos')
  const navItems = [
    {
      to: '/referencias/repositorios',
      label: 'Repositorios',
      icon: Folder,
    },
    {
      to: '/referencias/archivos',
      label: 'Archivos',
      icon: Upload,
    },
    {
      to: '/referencias/recientes',
      label: 'Recientes',
      icon: Clock3,
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">Referencias</h1>
          <p className="text-muted-foreground text-sm">
            Gestiona tu biblioteca de documentos para IA
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isArchivos && (
            <Button onClick={() => setIsUploadModalOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Subir archivo
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <nav className="bg-card/60 flex w-full flex-wrap items-center gap-2 rounded-2xl border p-1 sm:w-auto">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <Link
                key={item.to}
                to={item.to}
                className="text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition"
                activeProps={{
                  className:
                    'bg-primary text-primary-foreground shadow-sm hover:text-primary-foreground',
                }}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar archivos o repositorios"
            className="pl-9"
          />
        </div>
      </div>

      <Outlet />

      <UploadFilesModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </div>
  )
}

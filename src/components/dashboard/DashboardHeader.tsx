import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

interface DashboardHeaderProps {
  nombre: string
  rol: string
  facultad: string
  saludo?: string
}

export default function DashboardHeader({
  nombre,
  rol,
  facultad,
  saludo = 'Buenas noches,',
}: DashboardHeaderProps) {
  // Generamos la URL de DiceBear dinámicamente con el nombre
  const dicebearUrl = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(nombre)}`

  // Calculamos iniciales de respaldo por si falla la imagen
  const initials = nombre
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="gap-grupo p-seccion flex flex-col justify-between rounded-xl border shadow-md md:flex-row md:items-center">
      <div className="gap-grupo flex flex-row items-center">
        {/* 1. Avatar de DiceBear usando el componente de Shadcn */}
        <Avatar className="border-background h-12 w-12 border-2 shadow-sm">
          <AvatarImage src={dicebearUrl} alt={nombre} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>

        <div className="flex flex-col">
          {/* Saludo con texto secundario */}
          <p className="text-muted-foreground text-sm">{saludo}</p>

          {/* Nombre destacado */}
          <h2 className="text-foreground text-lg font-bold tracking-tight">
            {nombre}
          </h2>

          <div className="mt-micro gap-relacionado flex flex-wrap items-center">
            {/* 2. El "Banner" (Badge) para el puesto */}
            <Badge
              variant="secondary"
              className="px-relacionado rounded-md py-0 text-xs font-semibold"
            >
              {rol}
            </Badge>

            {/* Departamento */}
            <span className="text-muted-foreground text-xs font-medium">
              {facultad}
            </span>
          </div>
        </div>
      </div>
      <div className="gap-seccion flex flex-row flex-wrap sm:flex-nowrap">
        <div className="bg-muted gap-control px-grupo py-relacionado flex flex-row items-center rounded-lg">
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
            Icono
          </div>
          <div>
            <p>4</p>
            <p>Planes activos</p>
          </div>
        </div>
        <div className="bg-muted gap-control px-grupo py-relacionado flex flex-row items-center rounded-lg">
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-sm">
            Icono
          </div>
          <div>
            <p>3</p>
            <p>Revisiones pendientes</p>
          </div>
        </div>
      </div>
    </div>
  )
}

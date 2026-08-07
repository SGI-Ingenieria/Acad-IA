import { cn } from '@/lib/utils'

interface CircularProgressProps {
  current: number
  total: number
  className?: string
}

export function CircularProgress({
  current,
  total,
  className,
}: CircularProgressProps) {
  // Configuración interna del SVG (Coordenadas 100x100)
  const center = 50
  const strokeWidth = 8 // Grosor de la línea
  const radius = 40 // Radio (dejamos margen para el borde)
  const circumference = 2 * Math.PI * radius

  // Cálculo del porcentaje inverso (para que se llene correctamente)
  const percentage = (current / total) * 100
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    // CAMBIO CLAVE 1: 'size-24' (96px) da mucho más aire que 'size-16'
    <div
      className={cn(
        'relative flex size-20 items-center justify-center',
        className,
      )}
    >
      {/* CAMBIO CLAVE 2: Contenedor de texto con inset-0 para centrado perfecto */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="mb-micro text-sm leading-none font-medium text-slate-500">
          Paso
        </span>
        <span className="text-base leading-none font-bold text-slate-900">
          {current}{' '}
          <span className="text-base font-normal text-slate-400">
            / {total}
          </span>
        </span>
      </div>

      {/* SVG con viewBox para escalar automáticamente */}
      <svg className="size-full -rotate-90" viewBox="0 0 100 100">
        {/* Círculo de Fondo (Gris claro) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-slate-100"
        />
        {/* Círculo de Progreso (Verde/Color principal) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-primary transition-all duration-500 ease-out"
          // Nota: usa text-primary para tomar el color de tu tema, o pon text-green-500
        />
      </svg>
    </div>
  )
}

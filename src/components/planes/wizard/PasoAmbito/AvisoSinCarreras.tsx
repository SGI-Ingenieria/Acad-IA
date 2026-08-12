import { Link } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'

/**
 * Estado vacío del ámbito: no hay ninguna carrera en la que este usuario pueda
 * crear un plan. Distingue las dos causas —todavía no se han dado de alta
 * carreras, o el usuario no tiene ámbito asignado— porque la salida es
 * distinta: crear la carrera o pedir acceso.
 */
export function AvisoSinCarreras({
  puedeGestionarCarreras,
}: {
  puedeGestionarCarreras: boolean
}) {
  return (
    <div className="border-warning/30 bg-warning/5 gap-control p-seccion flex items-start rounded-lg border">
      <AlertTriangle className="text-warning mt-micro h-5 w-5 shrink-0" />
      <div className="gap-relacionado flex flex-col">
        <p className="text-foreground text-sm font-semibold">
          Sin carreras asignadas
        </p>
        <p className="text-muted-foreground text-sm">
          {puedeGestionarCarreras
            ? 'No tienes carreras configuradas aún en tu facultad. Crea una carrera primero para poder continuar.'
            : 'Tu usuario no tiene ninguna carrera o facultad asignada. Contacta al administrador para configurar tu acceso.'}
        </p>
        {puedeGestionarCarreras && (
          <Link
            to="/administracion/facultades/$tipo/nuevo"
            params={{ tipo: 'carrera' }}
            search={{}}
            className="text-primary text-sm font-medium underline underline-offset-2"
          >
            Ir a crear carrera →
          </Link>
        )}
      </div>
    </div>
  )
}

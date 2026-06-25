import type { Rol, Usuario } from '@/data/api/usuarios.api'

/**
 * Helpers visuales del Directorio de Usuarios (Organic Aurora · La Salle).
 *
 * Centraliza el mapeo estado → color/pulso y alcance de rol → tinte, para que
 * la fila y el panel de detalle compartan exactamente la misma semántica.
 */

export type UsuarioStatusKey = 'activo' | 'pendiente' | 'baja'

export interface UsuarioStatus {
  key: UsuarioStatusKey
  label: string
  /** Color del punto de estado (fondo). */
  dotClass: string
  /** Si el punto debe respirar (solo usuarios activos). */
  pulse: boolean
  /** Clases para el pill de estado. */
  badgeClass: string
}

/**
 * Deriva el estado visual a partir del modelo de datos:
 *  - `dado_de_baja_en` → Baja (rojo, sin pulso)
 *  - externo sin confirmar correo → Pendiente (ámbar, sin pulso)
 *  - resto → Activo (verde, con pulso)
 */
export function getUsuarioStatus(usuario: Usuario): UsuarioStatus {
  if (usuario.dado_de_baja_en) {
    return {
      key: 'baja',
      label: 'Baja',
      dotClass: 'bg-destructive',
      pulse: false,
      badgeClass: 'border-destructive/20 bg-destructive/10 text-destructive',
    }
  }
  if (usuario.externo && !usuario.email_confirmed) {
    return {
      key: 'pendiente',
      label: 'Pendiente',
      dotClass: 'bg-amber-500',
      pulse: false,
      badgeClass:
        'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    }
  }
  return {
    key: 'activo',
    label: 'Activo',
    dotClass: 'bg-emerald-500',
    pulse: true,
    badgeClass:
      'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  }
}

/**
 * Tinte del badge de rol según su alcance. Usa solo tokens del design system
 * (primary / chart / accent) para no introducir colores fuera de la paleta.
 */
export function getScopeStyles(
  alcance: Rol['alcance_default'] | undefined,
): string {
  switch (alcance) {
    case 'facultad':
      return 'border-chart-4/25 bg-chart-4/10 text-chart-4'
    case 'carrera':
      return 'border-chart-5/25 bg-chart-5/10 text-chart-5'
    case 'asignatura':
      return 'border-accent/30 bg-accent/30 text-accent-foreground'
    case 'externo':
      return 'border-border bg-muted/50 text-muted-foreground'
    case 'global':
    default:
      return 'border-primary/25 bg-primary/10 text-primary'
  }
}

const NOMBRES_BLOQUE_AREA_COMUN: Record<string, string> = {
  'Humanismo Sociedad': 'Humanismo y Sociedad',
  'Emprendimiento Sustentabilidad': 'Emprendimiento y Sostenibilidad',
  'Emprendimiento Sostenibilidad': 'Emprendimiento y Sostenibilidad',
}

export function nombreBloqueAreaComun(
  bloque: string | null | undefined,
): string | null {
  const nombre = bloque?.trim()
  if (!nombre) return null
  return NOMBRES_BLOQUE_AREA_COMUN[nombre] ?? nombre
}

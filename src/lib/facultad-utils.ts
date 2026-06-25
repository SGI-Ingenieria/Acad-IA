export function formatFacultadNombre(facultad: {
  nombre: string
  prefijo?: string | null
}): string {
  const prefijo = facultad.prefijo?.trim()
  return prefijo
    ? `Facultad ${prefijo} de ${facultad.nombre}`
    : `Facultad de ${facultad.nombre}`
}

/**
 * Nombre estándar de una carrera: `{nivel} en {nombre}`, salvo que el nivel sea
 * "Otro" (o esté vacío), en cuyo caso se muestra solo el nombre. El check es
 * insensible a mayúsculas porque el enum se guarda capitalizado ("Otro").
 */
export function formatCarreraNombre(carrera: {
  nombre: string
  nivel?: string | null
}): string {
  const nivel = carrera.nivel?.trim()
  if (!nivel || nivel.toLowerCase() === 'otro') return carrera.nombre
  return `${nivel} en ${carrera.nombre}`
}

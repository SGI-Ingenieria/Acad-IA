export function formatFacultadNombre(facultad: {
  nombre: string
  prefijo?: string | null
}): string {
  const prefijo = facultad.prefijo?.trim()
  return prefijo
    ? `Facultad ${prefijo} de ${facultad.nombre}`
    : `Facultad de ${facultad.nombre}`
}

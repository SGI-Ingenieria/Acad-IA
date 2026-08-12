const MESES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

type EstructuraVigente = {
  tipo: string | null
  estado_publicacion?:
    | 'BORRADOR'
    | 'ARCHIVADA'
    | 'PUBLICADA'
    | 'RETIRADA'
    | null
  aplicable_desde?: string | null
  aplicable_hasta?: string | null
}

export function recomendarEstructuraVigente<T extends EstructuraVigente>(
  estructuras: Array<T>,
  tipo: 'CURRICULAR' | 'NO_CURRICULAR',
  fecha: string | null,
): T | null {
  const candidatas = estructuras
    .filter(
      (estructura) =>
        estructura.tipo === tipo &&
        (!estructura.estado_publicacion ||
          estructura.estado_publicacion === 'PUBLICADA'),
    )
    .filter((estructura) => {
      if (tipo !== 'CURRICULAR' || !fecha) return true
      return (
        (!estructura.aplicable_desde || estructura.aplicable_desde <= fecha) &&
        (!estructura.aplicable_hasta || estructura.aplicable_hasta >= fecha)
      )
    })
    .sort((a, b) =>
      String(b.aplicable_desde ?? '').localeCompare(
        String(a.aplicable_desde ?? ''),
      ),
    )

  return candidatas[0] ?? null
}

/**
 * Las dos mitades del nombre curricular: la parte derivada de la carrera y el
 * mes de impartición.
 *
 * Se exponen por separado para poder escribir el nombre como una frase con la
 * fecha accionable dentro —es el único trozo que el usuario decide— en lugar
 * de pedirla en un campo aparte y repetir el resultado debajo.
 */
export function partesNombrePlanCurricular(
  nivel: string | null | undefined,
  nombreCarrera: string,
  fechaInicioImparticion: string | Date,
): { prefijo: string; fecha: string } {
  const fecha = parseFechaMes(fechaInicioImparticion)
  const nivelLimpio = (nivel ?? '').trim()
  const base =
    !nivelLimpio || nivelLimpio.toLowerCase() === 'otro'
      ? nombreCarrera.trim()
      : `${nivelLimpio} en ${nombreCarrera.trim()}`

  return {
    prefijo: `${base} - Plan `,
    fecha: `${MESES_ES[fecha.getMonth()]} ${fecha.getFullYear()}`,
  }
}

export function formatNombrePlanCurricular(
  nivel: string | null | undefined,
  nombreCarrera: string,
  fechaInicioImparticion: string | Date,
): string {
  const { prefijo, fecha } = partesNombrePlanCurricular(
    nivel,
    nombreCarrera,
    fechaInicioImparticion,
  )
  return `${prefijo}${fecha}`
}

export function parseFechaMes(fecha: string | Date): Date {
  return typeof fecha === 'string' ? new Date(`${fecha}T00:00:00`) : fecha
}

export function formatMesAnioEs(
  fechaInicioImparticion: string | Date | null | undefined,
): string {
  if (!fechaInicioImparticion) return ''

  const fecha = parseFechaMes(fechaInicioImparticion)
  if (isNaN(fecha.getTime())) return ''

  return `${MESES_ES[fecha.getMonth()]} ${fecha.getFullYear()}`
}

export function toMonthStartDateString(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`
}

export function isFechaCurricularPasada(
  fechaInicioImparticion: string | Date | null | undefined,
): boolean {
  if (!fechaInicioImparticion) return false

  const fecha = parseFechaMes(fechaInicioImparticion)
  if (isNaN(fecha.getTime())) return false

  const hoy = new Date()
  const mesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1).getTime()
  const mesSeleccionado = new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    1,
  ).getTime()

  return mesSeleccionado < mesActual
}

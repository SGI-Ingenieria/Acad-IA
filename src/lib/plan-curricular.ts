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

export function formatNombrePlanCurricular(
  nivel: string | null | undefined,
  nombreCarrera: string,
  fechaInicioImparticion: string | Date,
): string {
  const fecha = parseFechaMes(fechaInicioImparticion)

  const mes = MESES_ES[fecha.getMonth()]
  const anio = fecha.getFullYear()
  const nivelLimpio = (nivel ?? '').trim()

  if (!nivelLimpio || nivelLimpio.toLowerCase() === 'otro') {
    return `${nombreCarrera.trim()} - Plan ${mes} ${anio}`
  }

  return `${nivelLimpio} en ${nombreCarrera.trim()} - Plan ${mes} ${anio}`
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

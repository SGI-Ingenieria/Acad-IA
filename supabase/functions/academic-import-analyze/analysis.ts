import ExcelJS from 'npm:exceljs@4.4.0'

export type RolArchivoAcademico =
  | 'PLAN'
  | 'MAPA'
  | 'PROGRAMA'
  | 'RESOLUCION'
  | 'OTRO'

export type ArchivoClasificable = {
  nombre: string
  mime: string
}

export type AsignaturaMapa = {
  id_externo: string
  codigo: string | null
  nombre: string
  tipo: 'OBLIGATORIA' | 'OPTATIVA'
  numero_ciclo: number | null
  orden_celda: number
  horas_academicas: number | null
  horas_independientes: number | null
  instalacion: 'AULA' | 'LABORATORIO' | 'OTRA'
  datos: Record<string, never>
  contenido_tematico: Array<never>
  criterios_de_evaluacion: Array<never>
  bibliografia: Array<never>
}

export type ResultadoMapa = {
  asignaturas: Array<AsignaturaMapa>
  hojas: Array<{ nombre: string; filas: number; formulas: number }>
  incidencias: Array<{ codigo: string; campo?: string; detalle: string }>
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export function clasificarArchivoAcademico(archivo: ArchivoClasificable): {
  rol: RolArchivoAcademico
  confianza: number
  evidencia: Array<string>
} {
  const name = normalize(archivo.nombre)
  const isXlsx =
    archivo.mime.includes('spreadsheet') ||
    /\.(xlsx|xls|csv)$/i.test(archivo.nombre)
  if (isXlsx) {
    return { rol: 'MAPA', confianza: 0.98, evidencia: ['formato_tabular'] }
  }
  if (/resolucion|rvoe|acuerdo|autorizacion|dictamen/.test(name)) {
    return {
      rol: 'RESOLUCION',
      confianza: 0.9,
      evidencia: ['nombre_resolucion'],
    }
  }
  if (/programa|asignatura|materia|unidad de aprendizaje|anexo 3/.test(name)) {
    return {
      rol: 'PROGRAMA',
      confianza: 0.88,
      evidencia: ['nombre_programa'],
    }
  }
  if (/plan|curricular|anexo 1/.test(name)) {
    return { rol: 'PLAN', confianza: 0.86, evidencia: ['nombre_plan'] }
  }
  return { rol: 'OTRO', confianza: 0.35, evidencia: ['sin_huella_suficiente'] }
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (typeof value === 'object') {
    if ('result' in value && value.result != null) return String(value.result)
    if ('text' in value && value.text != null) return String(value.text)
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('')
    }
  }
  return String(value)
}

const HEADER_ALIASES: Record<string, Array<string>> = {
  codigo: ['clave', 'codigo', 'clave asignatura'],
  nombre: ['asignatura', 'materia', 'unidad de aprendizaje', 'nombre'],
  ciclo: ['ciclo', 'semestre', 'cuatrimestre', 'trimestre'],
  horasAcademicas: [
    'horas docente',
    'horas academicas',
    'horas bajo conduccion',
    'horas teoricas',
  ],
  horasIndependientes: [
    'horas independientes',
    'horas autonomas',
    'horas practicas',
  ],
  instalacion: ['instalacion', 'instalaciones', 'aula laboratorio'],
  tipo: ['tipo', 'caracter', 'obligatoria optativa'],
}

function headerKey(value: string): string | null {
  const source = normalize(value)
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some((alias) => source.includes(alias))) return key
  }
  return null
}

function integer(value: string): number | null {
  const match = value.replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? Math.round(parsed) : null
}

function installation(value: string): AsignaturaMapa['instalacion'] {
  const text = normalize(value)
  if (text === 'l' || text.includes('laboratorio')) return 'LABORATORIO'
  if (text === 'o' || text.includes('otra')) return 'OTRA'
  return 'AULA'
}

function subjectType(value: string): AsignaturaMapa['tipo'] {
  return /optativa|electiva/i.test(value) ? 'OPTATIVA' : 'OBLIGATORIA'
}

function externalId(sheet: string, row: number, code: string, name: string) {
  return `${normalize(sheet)}:${row}:${normalize(code || name)}`
}

export async function leerMapaCurricularXlsx(
  bytes: Uint8Array,
): Promise<ResultadoMapa> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer)
  const asignaturas: Array<AsignaturaMapa> = []
  const incidencias: ResultadoMapa['incidencias'] = []
  const hojas: ResultadoMapa['hojas'] = []

  workbook.eachSheet((sheet) => {
    let formulas = 0
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.type === ExcelJS.ValueType.Formula) formulas += 1
      })
    })
    hojas.push({ nombre: sheet.name, filas: sheet.rowCount, formulas })

    let headerRow = 0
    let columns = new Map<string, number>()
    for (
      let rowNumber = 1;
      rowNumber <= Math.min(sheet.rowCount, 30);
      rowNumber += 1
    ) {
      const candidate = new Map<string, number>()
      sheet
        .getRow(rowNumber)
        .eachCell({ includeEmpty: false }, (cell, column) => {
          const key = headerKey(cellText(cell.value))
          if (key && !candidate.has(key)) candidate.set(key, column)
        })
      if (candidate.has('nombre') && candidate.size >= 2) {
        headerRow = rowNumber
        columns = candidate
        break
      }
    }
    if (!headerRow) return

    for (
      let rowNumber = headerRow + 1;
      rowNumber <= sheet.rowCount;
      rowNumber += 1
    ) {
      const row = sheet.getRow(rowNumber)
      const read = (key: string) => {
        const column = columns.get(key)
        return column ? cellText(row.getCell(column).value).trim() : ''
      }
      const nombre = read('nombre')
      const codigo = read('codigo')
      if (!nombre || normalize(nombre) === 'total') continue
      const horasAcademicas = integer(read('horasAcademicas'))
      const horasIndependientes = integer(read('horasIndependientes'))
      asignaturas.push({
        id_externo: externalId(sheet.name, rowNumber, codigo, nombre),
        codigo: codigo || null,
        nombre,
        tipo: subjectType(read('tipo')),
        numero_ciclo: integer(read('ciclo')),
        orden_celda: asignaturas.length,
        horas_academicas: horasAcademicas,
        horas_independientes: horasIndependientes,
        instalacion: installation(read('instalacion')),
        datos: {},
        contenido_tematico: [],
        criterios_de_evaluacion: [],
        bibliografia: [],
      })
    }
  })

  if (!asignaturas.length) {
    incidencias.push({
      codigo: 'MAPA_SIN_TABLA_RECONOCIBLE',
      detalle: 'No se encontró una tabla de asignaturas reconocible.',
    })
  }
  for (const subject of asignaturas) {
    if (!subject.codigo) {
      incidencias.push({
        codigo: 'ASIGNATURA_SIN_CLAVE',
        campo: subject.nombre,
        detalle: 'La asignatura no tiene clave en el mapa.',
      })
    }
    if (
      subject.horas_academicas == null &&
      subject.horas_independientes == null
    ) {
      incidencias.push({
        codigo: 'ASIGNATURA_SIN_HORAS',
        campo: subject.nombre,
        detalle: 'La asignatura no tiene horas reconocibles.',
      })
    }
  }
  return { asignaturas, hojas, incidencias }
}

export function combinarAsignaturas(
  mapa: Array<Record<string, unknown>>,
  programas: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const byIdentity = new Map<string, Record<string, unknown>>()
  const identity = (subject: Record<string, unknown>) =>
    normalize(
      String(subject.codigo || subject.nombre || subject.id_externo || ''),
    )
  for (const subject of mapa) byIdentity.set(identity(subject), subject)
  for (const program of programas) {
    const key = identity(program)
    const mapped = byIdentity.get(key)
    if (mapped)
      byIdentity.set(key, {
        ...mapped,
        ...program,
        id_externo: mapped.id_externo,
      })
    else byIdentity.set(key, program)
  }
  return Array.from(byIdentity.values()).filter((subject) =>
    Boolean(subject.nombre),
  )
}

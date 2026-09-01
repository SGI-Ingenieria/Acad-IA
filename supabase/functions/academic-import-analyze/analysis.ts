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
  contenido?: string
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
  const content = normalize(archivo.contenido ?? '')
  const isXlsx =
    archivo.mime.includes('spreadsheet') ||
    /\.(xlsx|xls|csv)$/i.test(archivo.nombre)
  if (
    /resolucion|rvoe|acuerdo|dictamen|reconocimiento de validez/.test(content)
  ) {
    return {
      rol: 'RESOLUCION',
      confianza: 0.96,
      evidencia: ['contenido_normativo'],
    }
  }
  if (
    /mapa curricular|malla curricular|clave de la asignatura|horas academicas/.test(
      content,
    ) &&
    /ciclo|semestre|asignatura|materia/.test(content)
  ) {
    return {
      rol: 'MAPA',
      confianza: 0.93,
      evidencia: ['contenido_mapa_curricular'],
    }
  }
  if (
    /programa de asignatura|contenido tematico|unidad de aprendizaje|objetivo general/.test(
      content,
    )
  ) {
    return {
      rol: 'PROGRAMA',
      confianza: 0.93,
      evidencia: ['contenido_programa_asignatura'],
    }
  }
  if (
    /plan de estudios|perfil de egreso|perfil de ingreso|malla curricular/.test(
      content,
    )
  ) {
    return {
      rol: 'PLAN',
      confianza: 0.9,
      evidencia: ['contenido_plan_estudios'],
    }
  }
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
    'horas',
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

const CYCLE_WORDS: Record<string, number> = {
  primer: 1,
  primero: 1,
  segundo: 2,
  tercer: 3,
  tercero: 3,
  cuarto: 4,
  quinto: 5,
  sexto: 6,
  septimo: 7,
  octavo: 8,
  noveno: 9,
  decimo: 10,
}

function cycleNumber(value: string): number | null {
  const numeric = positiveInteger(value)
  if (numeric !== null) return numeric
  const normalized = normalize(value)
  const word = Object.keys(CYCLE_WORDS).find((candidate) =>
    new RegExp(`\\b${candidate}\\b`).test(normalized),
  )
  return word ? CYCLE_WORDS[word] : null
}

function isAdministrativeRow(value: string): boolean {
  const text = normalize(value)
  return /^(administracion del plan|organizacion del plan|requerimientos|horas bajo conduccion|creditos|total de asignaturas|tipo de asignatura|sumas totales|optativas?)\b/.test(
    text,
  )
}

function looksLikeSubjectCode(value: string): boolean {
  return /^[a-z]{2,}[a-z0-9-]*\d[a-z0-9-]*$/i.test(value.trim())
}

function positiveInteger(value: string): number | null {
  const parsed = integer(value)
  return parsed !== null && parsed >= 1 ? parsed : null
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

function leerMapaRigido(sheet: ExcelJS.Worksheet): Array<AsignaturaMapa> {
  const asignaturas: Array<AsignaturaMapa> = []
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const cycle = cycleNumber(cellText(row.getCell(1).value))
    if (cycle === null) continue

    const codeColumns: Array<number> = []
    row.eachCell({ includeEmpty: false }, (cell, column) => {
      if (looksLikeSubjectCode(cellText(cell.value))) codeColumns.push(column)
    })
    for (const codeColumn of codeColumns) {
      const codigo = cellText(row.getCell(codeColumn).value).trim()
      const nombre = cellText(
        sheet.getRow(rowNumber + 1).getCell(codeColumn).value,
      ).trim()
      if (!nombre || isAdministrativeRow(nombre)) continue

      const dataRow = sheet.getRow(rowNumber + 4)
      const horasAcademicas = integer(
        cellText(dataRow.getCell(codeColumn).value),
      )
      const horasIndependientes = integer(
        cellText(dataRow.getCell(codeColumn + 2).value),
      )
      const instalacion = cellText(dataRow.getCell(codeColumn + 4).value)
      const type = cellText(row.getCell(codeColumn + 4).value)
      asignaturas.push({
        id_externo: externalId(sheet.name, rowNumber, codigo, nombre),
        codigo,
        nombre,
        tipo: subjectType(type),
        numero_ciclo: cycle,
        orden_celda: asignaturas.length,
        horas_academicas: horasAcademicas,
        horas_independientes: horasIndependientes,
        instalacion: installation(instalacion),
        datos: {},
        contenido_tematico: [],
        criterios_de_evaluacion: [],
        bibliografia: [],
      })
    }
  }
  return asignaturas
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

    const rigidSubjects = leerMapaRigido(sheet)
    if (rigidSubjects.length) {
      asignaturas.push(...rigidSubjects)
      return
    }

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

    let currentCycle: number | null = null
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
      if (!nombre || isAdministrativeRow(nombre)) continue
      const rowCycle = cycleNumber(read('ciclo'))
      if (rowCycle !== null) currentCycle = rowCycle
      const horasAcademicas = integer(read('horasAcademicas'))
      const horasIndependientes = integer(read('horasIndependientes'))
      asignaturas.push({
        id_externo: externalId(sheet.name, rowNumber, codigo, nombre),
        codigo: codigo || null,
        nombre,
        tipo: subjectType(read('tipo')),
        numero_ciclo: currentCycle,
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
  for (const subject of mapa) {
    const key = identity(subject)
    if (!byIdentity.has(key)) byIdentity.set(key, subject)
  }
  for (const program of programas) {
    const key = identity(program)
    const mapped = byIdentity.get(key)
    if (mapped) {
      const combined = {
        ...mapped,
        ...program,
        id_externo: mapped.id_externo,
      }
      const mappedCycle = mapped.numero_ciclo
      const combinedCycle = combined.numero_ciclo
      if (
        typeof combinedCycle !== 'number' ||
        !Number.isInteger(combinedCycle) ||
        combinedCycle < 1
      ) {
        combined.numero_ciclo =
          typeof mappedCycle === 'number' &&
          Number.isInteger(mappedCycle) &&
          mappedCycle >= 1
            ? mappedCycle
            : null
      }
      byIdentity.set(key, combined)
    } else {
      const cycle = program.numero_ciclo
      byIdentity.set(key, {
        ...program,
        numero_ciclo:
          typeof cycle === 'number' && Number.isInteger(cycle) && cycle >= 1
            ? cycle
            : null,
      })
    }
  }
  return Array.from(byIdentity.values()).filter((subject) =>
    Boolean(subject.nombre),
  )
}

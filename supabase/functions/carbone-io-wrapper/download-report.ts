import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { corsHeaders } from '../_shared/cors.ts'
import type { Database, Json } from '../_shared/database.types.ts'
import { HttpError } from '../_shared/utils.ts'
import { CarboneClient } from './carbone.ts'
import { Workbook } from '@cj-tech-master/excelts'
import {
  applyColumnWidthPattern,
  applyMergePattern,
} from './CombinateCells/excelUtils.ts'
import { Buffer } from 'node:buffer'
import {
  CAMPOS_SIEMPRE_ASIGNATURA,
  CAMPOS_SIEMPRE_PLAN,
  construirDatos,
  construirMetadata,
  type FieldMeta,
} from '../_shared/camposDocumento.ts'

const DownloadReportBodySchema = z.record(z.unknown()).optional().default({})

const DownloadReportPlanSchema = z
  .object({
    action: z.literal('downloadReport'),
    plan_estudio_id: z.string().min(1),
    body: DownloadReportBodySchema,
  })
  .strict()

const DownloadReportAsignaturaSchema = z
  .object({
    action: z.literal('downloadReport'),
    asignatura_id: z.string().min(1),
    body: DownloadReportBodySchema,
  })
  .strict()

export const DownloadReportSchema = z.union([
  DownloadReportPlanSchema,
  DownloadReportAsignaturaSchema,
])

export type DownloadReportInput = z.infer<typeof DownloadReportSchema>

type SupabaseClient = ReturnType<typeof createClient<Database>>

type CarboneDownload = {
  buffer: Uint8Array
  contentType: string | null
  contentDisposition: string | null
}

async function prepararDatosParaExcel(
  supabase: SupabaseClient,
  planEstudioId: string,
) {
  const { data: plan, error: planError } = await supabase
    .from('planes_estudio')
    .select('*, estructura:estructuras_plan(*)')
    .eq('id', planEstudioId)
    .single()

  const { data: asignaturas, error: asigError } = await supabase
    .from('asignaturas')
    .select('*, linea:lineas_plan(nombre)')
    .eq('plan_estudio_id', planEstudioId)
    .order('numero_ciclo', { ascending: true })

  if (planError || asigError)
    throw new Error('Error obteniendo datos de la base de datos.')

  // --- MAPA DE BÚSQUEDA PARA PRERREQUISITOS ---
  const mapaClaves = asignaturas.reduce(
    (acc, asig) => {
      acc[asig.id] = asig.codigo
      return acc
    },
    {} as Record<string, string>,
  )

  // 1. Cálculo de métricas de estructura
  const materiasPorCiclo = Array.from(
    { length: plan.numero_ciclos },
    (_, i) => asignaturas.filter((a) => a.numero_ciclo === i + 1).length,
  )
  const maxMaterias = Math.max(...materiasPorCiclo)

  // 2. Transformación de Semestres (con datos por materia)
  const semestres = Array.from({ length: plan.numero_ciclos }, (_, i) => {
    const materiasDelCiclo = asignaturas.filter((a) => a.numero_ciclo === i + 1)

    const totalHi = materiasDelCiclo.reduce(
      (sum, a) => sum + (a.horas_independientes || 0),
      0,
    )
    const totalHp = materiasDelCiclo.reduce(
      (sum, a) => sum + (a.horas_academicas || 0),
      0,
    )
    const totalCreditos = materiasDelCiclo.reduce(
      (sum, a) => sum + (Number(a.creditos) || 0),
      0,
    )

    const listaMaterias = materiasDelCiclo.map((a) => {
      const idPrerrequisito = a.prerrequisito_asignatura_id
      const clavePrerrequisito = idPrerrequisito
        ? mapaClaves[idPrerrequisito] || null
        : null

      return {
        clave: a.codigo,
        nombre: a.nombre,
        clave_prerrequisito: clavePrerrequisito,
        tipo: a.tipo,
        instalacion: (a.datos as any)?.instalacion || 'Aula',
        creditos: Number(a.creditos),
        hi: a.horas_independientes,
        hp: a.horas_academicas,
      }
    })

    const materiasRellenas = [
      ...listaMaterias,
      ...Array(maxMaterias - listaMaterias.length).fill(null),
    ]

    return {
      nombre:
        [
          'Primer',
          'Segundo',
          'Tercer',
          'Cuarto',
          'Quinto',
          'Sexto',
          'Séptimo',
          'Octavo',
          'Noveno',
          'Décimo',
        ][i] || `Ciclo ${i + 1}`,
      creditos: totalCreditos,
      hi: totalHi,
      hp: totalHp,
      materias: materiasRellenas,
    }
  })

  // --- CÁLCULO DE TOTALES GLOBALES ---
  const totalPlanCreditos = semestres.reduce((sum, s) => sum + s.creditos, 0)
  const totalPlanHi = semestres.reduce((sum, s) => sum + s.hi, 0)
  const totalPlanHp = semestres.reduce((sum, s) => sum + s.hp, 0)

  // --- OPTATIVAS AGRUPADAS POR CICLO (para pestaña 2) ---
  const cicloNames = [
    'Primer', 'Segundo', 'Tercer', 'Cuarto', 'Quinto',
    'Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo',
  ]
  const optativasPorCiclo = Array.from({ length: plan.numero_ciclos }, (_, i) =>
    asignaturas.filter((a) => a.numero_ciclo === i + 1 && a.tipo === 'OPTATIVA'),
  )
  const maxOptativas = Math.max(...optativasPorCiclo.map((m) => m.length), 1)

  const semestresOptativas = Array.from({ length: plan.numero_ciclos }, (_, i) => {
    const cicloMaterias = optativasPorCiclo[i]
    const listaMaterias = cicloMaterias.map((a) => ({
      clave: a.codigo,
      nombre: a.nombre,
      clave_prerrequisito: a.prerrequisito_asignatura_id
        ? mapaClaves[a.prerrequisito_asignatura_id] || null
        : null,
      instalacion: (a.datos as any)?.instalacion || 'Aula',
      creditos: Number(a.creditos),
      hi: a.horas_independientes,
      hp: a.horas_academicas,
    }))
    return {
      nombre: cicloNames[i] || `Ciclo ${i + 1}`,
      materias: [
        ...listaMaterias,
        ...Array(maxOptativas - listaMaterias.length).fill(null),
      ],
    }
  })

  // --- ASIGNATURAS POR LÍNEA CURRICULAR (para pestaña 3) ---
  // Solo incluir asignaturas que tienen línea curricular asignada
  const lineasMap = new Map<string, typeof asignaturas>()
  for (const a of asignaturas) {
    const linea = (a.linea as any)?.nombre
    if (!linea) continue // ignorar asignaturas sin línea curricular
    if (!lineasMap.has(linea)) lineasMap.set(linea, [])
    lineasMap.get(linea)!.push(a)
  }
  const lineas = Array.from(lineasMap.entries()).map(([nombre, mats]) => ({
    nombre,
    materias: mats.map((a) => ({
      clave: a.codigo,
      nombre: a.nombre,
      clave_prerrequisito: a.prerrequisito_asignatura_id
        ? mapaClaves[a.prerrequisito_asignatura_id] || null
        : null,
      instalacion: (a.datos as any)?.instalacion || 'Aula',
      creditos: Number(a.creditos),
      hi: a.horas_independientes,
      hp: a.horas_academicas,
    })),
  }))

  // --- RETORNO DEL JSON FINAL ---
  return {
    nombre_plan: plan.nombre, // Tomado de planes_estudio.nombre
    tipo_ciclo: plan.tipo_ciclo,
    modalidad: 'Presencial', // Valor default solicitado
    semestres,
    semestres_optativas: semestresOptativas,
    lineas_plan: [...lineasMap.keys()].map((n) => ({ nombre: n })),
    lineas,
    creditos: totalPlanCreditos,
    hi: totalPlanHi,
    hp: totalPlanHp,
    // Estos se usan para el post-procesado de celdas
    config: {
      ciclos: plan.numero_ciclos,
      maxMaterias: maxMaterias,
      maxOptativas,
      optativasPorCiclo: optativasPorCiclo.map((m) => m.length),
      lineas: lineas.map((l) => ({ nombre: l.nombre, count: l.materias.length })),
    },
  }
}
type LineaConMaterias = {
  nombre: string
  materias: Array<{
    clave: string
    nombre: string
    clave_prerrequisito: string | null
    instalacion: string
    creditos: number
    hi: number
    hp: number
  }>
}

export async function postProcessExcel(
  buffer: Uint8Array,
  config: {
    ciclos: number
    maxMaterias: number
    maxOptativas?: number
    optativasPorCiclo?: number[]
    lineas?: Array<{ nombre: string; count: number }>
    lineasCompletas?: LineaConMaterias[]
  },
) {
  const workbook = new Workbook()
  await workbook.xlsx.load(buffer as any)

  // ── Pestaña 1: RÍGIDO ───────────────────────────────────────────────────
  const sheet1 = workbook.getWorksheet('RÍGIDO-Anexo 2 (A)')
  if (sheet1) {
    const { ciclos, maxMaterias } = config

    applyMergePattern(sheet1, {
      startColumn: 'C',
      numberOfColumns: maxMaterias,
      firstStartRow: 8,
      mergeWidthInColumns: 5,
      mergeHeightInRows: 3,
      mergeBlockCount: ciclos,
      rowStepBetweenBlocks: 14 - 8,
    } as const)
    applyMergePattern(sheet1, {
      startColumn: 'A',
      numberOfColumns: 1,
      firstStartRow: 7,
      mergeWidthInColumns: 1,
      mergeHeightInRows: 5,
      mergeBlockCount: ciclos,
      rowStepBetweenBlocks: 13 - 7,
    } as const)
    applyMergePattern(sheet1, {
      startColumn: 'C',
      numberOfColumns: maxMaterias,
      firstStartRow: 7,
      mergeWidthInColumns: 3,
      mergeHeightInRows: 1,
      mergeBlockCount: ciclos,
      columnStepBetweenBlocks: 3,
      rowStepBetweenBlocks: 14 - 8,
    } as const)
    applyColumnWidthPattern(sheet1, {
      fromColumn: 'I',
      numberOfBlocks: maxMaterias - 1,
      columnStepBetweenBlocks: 5 + 1,
      rowStepBetweenBlocks: 14 - 8,
      widths: [4, 0.25, 4, 7.29, 13.57, 2.43],
    } as const)

    // Combinar el título del cuadro de totales (primera celda que contiene
    // "TOTAL" y cuya celda vecina derecha está vacía)
    mergeTotalBoxTitle(sheet1)
  }

  // ── Pestaña 2: OPTATIVAS ────────────────────────────────────────────────
  const sheet2 = workbook.getWorksheet('OPTATIVAS-Anexo 2 (A)')
  if (sheet2) {
    mergeColumnByContent(sheet2, 1, 7)
    // Anchos de columna para que el texto no se trunque
    sheet2.getColumn(1).width = 22
    sheet2.getColumn(2).width = 32
  }

  // ── Pestaña 3: FLEXIBLE ─────────────────────────────────────────────────
  const sheet3 = workbook.getWorksheet('FLEXIBLE-Anexo 2 (B)')
  if (sheet3) {
    if (config.lineasCompletas && config.lineasCompletas.length > 0) {
      writeLineasToFlexibleSheet(sheet3, config.lineasCompletas)
    } else {
      mergeColumnByContent(sheet3, 1, 7)
    }
    sheet3.getColumn(1).width = 22
    sheet3.getColumn(2).width = 32
  }

  return await workbook.xlsx.writeBuffer()
}

/** Busca la primera celda con texto "TOTAL" en las primeras 10 columnas
 *  y la combina con la celda a su derecha (el título del cuadro de totales). */
function mergeTotalBoxTitle(sheet: any) {
  for (let r = 1; r <= sheet.rowCount; r++) {
    for (let c = 1; c <= 10; c++) {
      const cell = sheet.getCell(r, c)
      const val = cell.value
      if (val && typeof val === 'string' && val.toUpperCase().includes('TOTAL')) {
        const right = sheet.getCell(r, c + 1)
        if (!right.value || right.value === '') {
          try { sheet.mergeCells(r, c, r, c + 1) } catch { /* ya combinada */ }
        }
        return
      }
    }
  }
}

/** Combina celdas consecutivas con el mismo valor no-vacío en la columna
 *  indicada, comenzando desde `dataStartRow`. */
function mergeColumnByContent(sheet: any, colNum: number, dataStartRow: number) {
  if (sheet.rowCount < dataStartRow) return

  let groupStart = dataStartRow
  let currentVal = cellText(sheet, dataStartRow, colNum)

  for (let r = dataStartRow + 1; r <= sheet.rowCount + 1; r++) {
    const val = r <= sheet.rowCount ? cellText(sheet, r, colNum) : null

    if (val !== currentVal || r > sheet.rowCount) {
      if (r - groupStart > 1 && currentVal) {
        try { sheet.mergeCells(groupStart, colNum, r - 1, colNum) } catch { /* ya combinada */ }
      }
      groupStart = r
      currentVal = val
    }
  }
}

function cellText(sheet: any, row: number, col: number): string | null {
  const cell = sheet.getCell(row, col)
  // type === 1 (Merge) = celda esclava — su .value retorna el master, ignorar
  if (cell.type === 1) return null
  const val = cell.value
  if (val === null || val === undefined || val === '') return null
  return String(val).trim() || null
}

/** Escribe los datos de líneas curriculares en la pestaña FLEXIBLE.
 *
 * El template tiene placeholders "AAA", "BBB", "CCC" hardcodeados. Esta función:
 * 1. Encuentra todos los placeholders y calcula el rango de cada grupo ANTES de modificar.
 * 2. Procesa los grupos en ORDEN INVERSO para que las inserciones de filas no
 *    desplacen los índices de los grupos ya procesados.
 * 3. Inserta filas (spliceRows) cuando una línea tiene más asignaturas que las
 *    predefinidas en el template, expandiendo el grupo hacia abajo. */
function writeLineasToFlexibleSheet(sheet: any, lineas: LineaConMaterias[]) {
  const PLACEHOLDER_RE = /^[A-Z]{2,10}$/
  const HEADER_WORDS = /ÁREA|MÓDULO|ASIGNATURA|CLAVE|SERIACIÓN|HORAS|CRÉDITOS|INSTALACIONES/i

  const orgRow = findOrganizacionRow(sheet)
  const sheetEnd = orgRow ? orgRow - 1 : sheet.rowCount

  // ── 1. Encontrar placeholders y calcular rangos ──────────────────────────
  type Group = { startRow: number; endRow: number; lineaCol: number; dataCol: number }

  const rawGroups: Array<{ startRow: number; lineaCol: number; dataCol: number }> = []
  for (let r = 1; r <= sheetEnd; r++) {
    for (let c = 1; c <= 8; c++) {
      const val = cellText(sheet, r, c)
      if (val && PLACEHOLDER_RE.test(val) && !HEADER_WORDS.test(val)) {
        rawGroups.push({ startRow: r, lineaCol: c, dataCol: c + 1 })
        break
      }
    }
  }

  if (rawGroups.length === 0) {
    if (orgRow) fillOrganizacionTable(sheet, orgRow, lineas)
    return
  }

  const findEndRow = (startRow: number, lineaCol: number): number => {
    for (let r = startRow + 1; r <= sheetEnd; r++) {
      const v = cellText(sheet, r, lineaCol)
      if (v && (PLACEHOLDER_RE.test(v) || /ÁREA|MÓDULO/i.test(v))) return r - 1
      for (let c = 1; c <= 8; c++) {
        const cv = cellText(sheet, r, c)
        if (cv && /ÁREA \(O MÓDULO\)/i.test(cv)) return r - 1
      }
    }
    return sheetEnd
  }

  // Calcular todos los endRows ANTES de cualquier modificación
  const groups: Group[] = rawGroups.map(g => ({ ...g, endRow: findEndRow(g.startRow, g.lineaCol) }))

  // ── 2. Procesar en ORDEN INVERSO (último primero) ────────────────────────
  // Al insertar filas al final de cada grupo, los índices de los grupos anteriores
  // (números de fila menores) no se ven afectados.
  for (let gi = groups.length - 1; gi >= 0; gi--) {
    const { startRow, endRow, lineaCol, dataCol } = groups[gi]
    const linea = gi < lineas.length ? lineas[gi] : null
    const subjectCount = linea?.materias.length ?? 0
    const templateRows = endRow - startRow + 1

    // Capturar estilo del placeholder row ANTES de cualquier cambio
    const rowStyle = captureRowCellStyles(sheet, startRow, lineaCol + 7)
    const rowHeight = sheet.getRow(startRow).height

    // Insertar filas extra si la línea tiene más asignaturas que el template
    if (subjectCount > templateRows) {
      const toInsert = subjectCount - templateRows
      for (let k = 0; k < toInsert; k++) {
        try {
          // Insertar fila vacía justo después del último renglon del grupo
          sheet.spliceRows(endRow + 1 + k, 0, [])
        } catch { /* si spliceRows no está disponible, el overflow se ignorará */ }
      }
    }

    // Desmerge en la columna de área dentro del rango efectivo
    const writeRows = Math.max(subjectCount, templateRows)
    for (let r = startRow; r < startRow + writeRows; r++) {
      for (let span = startRow + writeRows - r - 1; span >= 1; span--) {
        try { sheet.unMergeCells(r, lineaCol, r + span, lineaCol) } catch {}
      }
    }

    // Limpiar valores (preservar estilos)
    for (let r = startRow; r < startRow + writeRows; r++) {
      for (let c = lineaCol; c <= lineaCol + 7; c++) {
        try { sheet.getCell(r, c).value = null } catch {}
      }
    }

    if (!linea || subjectCount === 0) continue

    // Escribir asignaturas de esta línea
    for (let j = 0; j < subjectCount; j++) {
      const mat = linea.materias[j]
      const row = startRow + j

      // Aplicar estilo clonado a filas insertadas (más allá del template original)
      if (j >= templateRows) {
        applyRowCellStyles(sheet, row, rowStyle, lineaCol + 7)
        sheet.getRow(row).height = rowHeight
      }

      sheet.getCell(row, lineaCol).value = j === 0 ? linea.nombre : null
      sheet.getCell(row, dataCol).value = mat.nombre
      sheet.getCell(row, dataCol + 1).value = mat.clave
      sheet.getCell(row, dataCol + 2).value = mat.clave_prerrequisito ?? ''
      sheet.getCell(row, dataCol + 3).value = mat.hp
      sheet.getCell(row, dataCol + 4).value = mat.hi
      sheet.getCell(row, dataCol + 5).value = mat.creditos
      sheet.getCell(row, dataCol + 6).value = mat.instalacion
    }

    if (subjectCount > 1) {
      try { sheet.mergeCells(startRow, lineaCol, startRow + subjectCount - 1, lineaCol) } catch {}
    }
  }

  // ── 3. Llenar tabla ORGANIZACIÓN (puede haberse desplazado por inserciones) ─
  const newOrgRow = findOrganizacionRow(sheet)
  if (newOrgRow) fillOrganizacionTable(sheet, newOrgRow, lineas)
}

/** Captura el estilo de cada celda de una fila (deep-clone). */
function captureRowCellStyles(sheet: any, rowNum: number, maxCol: number): any[] {
  const styles: any[] = []
  for (let c = 1; c <= maxCol; c++) {
    try {
      const cell = sheet.getCell(rowNum, c)
      styles.push(JSON.parse(JSON.stringify({
        font: cell.font ?? null,
        fill: cell.fill ?? null,
        border: cell.border ?? null,
        alignment: cell.alignment ?? null,
        numFmt: cell.numFmt ?? null,
      })))
    } catch {
      styles.push({})
    }
  }
  return styles
}

/** Aplica estilos capturados a las celdas de una fila. */
function applyRowCellStyles(sheet: any, rowNum: number, styles: any[], maxCol: number) {
  for (let c = 1; c <= maxCol && c <= styles.length; c++) {
    try {
      const cell = sheet.getCell(rowNum, c)
      const s = styles[c - 1]
      if (s.font) cell.font = s.font
      if (s.fill) cell.fill = s.fill
      if (s.border) cell.border = s.border
      if (s.alignment) cell.alignment = s.alignment
      if (s.numFmt) cell.numFmt = s.numFmt
    } catch { /* ignorar */ }
  }
}

/** Encuentra la fila que contiene el texto "ORGANIZACIÓN" en la hoja. */
function findOrganizacionRow(sheet: any): number | null {
  for (let r = 1; r <= sheet.rowCount; r++) {
    for (let c = 1; c <= 10; c++) {
      const val = sheet.getCell(r, c).value
      if (val && typeof val === 'string' && val.toUpperCase().includes('ORGANIZACIÓN')) {
        return r
      }
    }
  }
  return null
}

/** Llena la tabla "ORGANIZACIÓN DEL PLAN DE ESTUDIOS" con datos reales de líneas. */
function fillOrganizacionTable(sheet: any, orgRow: number, lineas: LineaConMaterias[]) {
  // Buscar la primera fila con placeholder (AAA/BBB/CCC o texto corto en mayúsculas)
  let firstDataRow: number | null = null
  let areaCol = 1

  for (let r = orgRow + 1; r <= Math.min(orgRow + 8, sheet.rowCount); r++) {
    for (let c = 1; c <= 8; c++) {
      const val = sheet.getCell(r, c).value
      if (val && typeof val === 'string' && /^[A-Z]{1,10}$/.test(val.trim())) {
        firstDataRow = r
        areaCol = c
        break
      }
    }
    if (firstDataRow) break
  }

  if (!firstDataRow) return

  // Capturar el estilo de la primera fila placeholder (AAA) para reusar en lineas extras
  const orgTableRowStyle = captureRowCellStyles(sheet, firstDataRow, areaCol + 4)
  const orgRowHeight = sheet.getRow(firstDataRow).height

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]
    const row = firstDataRow + i

    // Si hay más líneas que filas en el template, insertar fila con estilo clonado
    if (row > sheet.rowCount) {
      applyRowCellStyles(sheet, row, orgTableRowStyle, areaCol + 4)
      sheet.getRow(row).height = orgRowHeight
    }

    const totalHp = linea.materias.reduce((s, m) => s + (m.hp || 0), 0)
    const totalHi = linea.materias.reduce((s, m) => s + (m.hi || 0), 0)
    const totalCreditos = linea.materias.reduce((s, m) => s + (m.creditos || 0), 0)

    sheet.getCell(row, areaCol).value = linea.nombre
    sheet.getCell(row, areaCol + 1).value = linea.materias.length
    sheet.getCell(row, areaCol + 2).value = totalHp
    sheet.getCell(row, areaCol + 3).value = totalHi
    sheet.getCell(row, areaCol + 4).value = totalCreditos
  }
}


type PlanContext = {
  plan: Record<string, unknown>
  carrera: Record<string, unknown> | null
  definicion: unknown
  datos: Json
  estructura_id: string
}

async function loadPlanContext(
  supabase: SupabaseClient,
  planEstudioId: string,
): Promise<PlanContext> {
  const { data, error } = await supabase
    .from('planes_estudio')
    .select(
      'nombre, numero_ciclos, tipo_ciclo, datos, estructura_id, carrera:carreras(nombre, nivel, clave_sep), estructura:estructuras_plan(definicion)',
    )
    .eq('id', planEstudioId)
    .maybeSingle()

  if (error) {
    throw new HttpError(
      500,
      'Error consultando el plan de estudios.',
      'DB_ERROR',
      {
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    )
  }
  if (!data) {
    throw new HttpError(404, 'Plan de estudios no encontrado.', 'NOT_FOUND', {
      plan_estudio_id: planEstudioId,
    })
  }

  const planAny = data as Record<string, unknown>
  const carrera = (planAny.carrera ?? null) as Record<string, unknown> | null
  const estructura = (planAny.estructura ?? null) as Record<
    string,
    unknown
  > | null

  return {
    plan: planAny,
    carrera,
    definicion: estructura?.definicion ?? null,
    datos: data.datos,
    estructura_id: data.estructura_id,
  }
}

/**
 * Arma el objeto `data` del documento de un plan de estudios.
 *
 * SIEMPRE construye el JSON contra la estructura (fuente de verdad): campos
 * siempre incluidos (nombre, nivel, carrera, número de ciclos, tipo de ciclo…)
 * resueltos por su valor canónico, más cada campo declarado en la estructura
 * (`datos[key] ?? null`). Nunca devuelve `{}`.
 */
export async function prepararDatosParaPlan(
  supabase: SupabaseClient,
  planEstudioId: string,
): Promise<unknown> {
  const ctx = await loadPlanContext(supabase, planEstudioId)
  return construirDatos(
    CAMPOS_SIEMPRE_PLAN,
    { plan: ctx.plan, carrera: ctx.carrera },
    ctx.definicion,
    ctx.datos,
  )
}

async function loadTemplateIdForEstructura(
  supabase: SupabaseClient,
  estructuraId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('estructuras_plan')
    .select('template_id')
    .eq('id', estructuraId)
    .maybeSingle()

  if (error) {
    throw new HttpError(
      500,
      'Error consultando la estructura del plan.',
      'DB_ERROR',
      {
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    )
  }
  if (!data) {
    throw new HttpError(
      404,
      'Estructura del plan no encontrada.',
      'NOT_FOUND',
      {
        estructura_id: estructuraId,
      },
    )
  }
  if (!data.template_id) {
    throw new HttpError(
      409,
      'La estructura del plan no tiene template_id configurado.',
      'MISSING_TEMPLATE_ID',
      { estructura_id: estructuraId },
    )
  }

  return data.template_id
}

async function loadTemplateIdForAsignatura(
  supabase: SupabaseClient,
  asignaturaId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('plantilla_asignatura')
    .select('template_id')
    .eq('asignatura_id', asignaturaId)
    .maybeSingle()

  if (error) {
    throw new HttpError(
      500,
      'Error consultando la plantilla de la asignatura.',
      'DB_ERROR',
      {
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    )
  }
  if (!data) {
    throw new HttpError(404, 'Asignatura no encontrada.', 'NOT_FOUND', {
      asignatura_id: asignaturaId,
    })
  }
  if (!data.template_id) {
    throw new HttpError(
      409,
      'La asignatura no tiene template_id configurado.',
      'MISSING_TEMPLATE_ID',
      { asignatura_id: asignaturaId },
    )
  }

  return data.template_id
}

type AsignaturaContext = {
  asig: Record<string, unknown>
  plan: Record<string, unknown> | null
  carrera: Record<string, unknown> | null
  bibliografia_basica: Array<unknown>
  bibliografia_complementaria: Array<unknown>
  definicion: unknown
}

async function loadAsignaturaContext(
  supabase: SupabaseClient,
  asignaturaId: string,
): Promise<AsignaturaContext> {
  const { data: asig, error } = await supabase
    .from('asignaturas')
    .select(
      '*, plan:planes_estudio(nombre, numero_ciclos, tipo_ciclo, carrera:carreras(nombre, nivel, clave_sep)), estructura:estructuras_asignatura(definicion)',
    )
    .eq('id', asignaturaId)
    .single()

  if (error || !asig) {
    throw new HttpError(404, 'Asignatura no encontrada.', 'NOT_FOUND', {
      asignatura_id: asignaturaId,
      message: error?.message,
    })
  }

  const { data: biblio, error: bibErr } = await supabase
    .from('bibliografia_asignatura')
    .select('tipo, cita, creado_en')
    .eq('asignatura_id', asignaturaId)
    .order('creado_en', { ascending: true })

  if (bibErr) {
    throw new HttpError(500, 'Error consultando la bibliografía.', 'DB_ERROR', {
      message: bibErr.message,
    })
  }

  const bibliografia = biblio ?? []
  const asigAny = asig as Record<string, unknown>
  const plan = (asigAny.plan ?? null) as Record<string, unknown> | null
  const carrera = (plan?.carrera ?? null) as Record<string, unknown> | null
  const estructura = (asigAny.estructura ?? null) as Record<string, unknown> | null

  return {
    asig: asigAny,
    plan,
    carrera,
    bibliografia_basica: bibliografia.filter((b) => b.tipo === 'BASICA').map((b) => b.cita),
    bibliografia_complementaria: bibliografia.filter((b) => b.tipo === 'COMPLEMENTARIA').map((b) => b.cita),
    definicion: estructura?.definicion ?? null,
  }
}

/**
 * Arma el objeto `data` para el documento de una asignatura.
 *
 * Se hace en la edge function (no en el frontend) para GARANTIZAR que ciertos
 * campos SIEMPRE viajen al documento SEP, aunque la estructura no los declare:
 * contenido temático, sistema de evaluación, bibliografía (básica y
 * complementaria) y el nivel (que vive en la carrera, no en el plan).
 */
export async function prepararDatosParaAsignatura(
  supabase: SupabaseClient,
  asignaturaId: string,
): Promise<Record<string, unknown>> {
  const ctx = await loadAsignaturaContext(supabase, asignaturaId)
  return construirDatos(
    CAMPOS_SIEMPRE_ASIGNATURA,
    {
      asig: ctx.asig,
      plan: ctx.plan,
      carrera: ctx.carrera,
      bibliografia_basica: ctx.bibliografia_basica,
      bibliografia_complementaria: ctx.bibliografia_complementaria,
    },
    ctx.definicion,
    ctx.asig.datos,
  )
}

export async function prepararPreviewParaPlan(
  supabase: SupabaseClient,
  planEstudioId: string,
): Promise<{ data: Record<string, unknown>; fields: FieldMeta[] }> {
  const ctx = await loadPlanContext(supabase, planEstudioId)
  const data = construirDatos(
    CAMPOS_SIEMPRE_PLAN,
    { plan: ctx.plan, carrera: ctx.carrera },
    ctx.definicion,
    ctx.datos,
  )
  const fields = construirMetadata(CAMPOS_SIEMPRE_PLAN, ctx.definicion)
  return { data, fields }
}

export async function prepararPreviewParaAsignatura(
  supabase: SupabaseClient,
  asignaturaId: string,
): Promise<{ data: Record<string, unknown>; fields: FieldMeta[] }> {
  const ctx = await loadAsignaturaContext(supabase, asignaturaId)
  const data = construirDatos(
    CAMPOS_SIEMPRE_ASIGNATURA,
    {
      asig: ctx.asig,
      plan: ctx.plan,
      carrera: ctx.carrera,
      bibliografia_basica: ctx.bibliografia_basica,
      bibliografia_complementaria: ctx.bibliografia_complementaria,
    },
    ctx.definicion,
    ctx.asig.datos,
  )
  const fields = construirMetadata(CAMPOS_SIEMPRE_ASIGNATURA, ctx.definicion)
  return { data, fields }
}

function ensureCarboneDownload(result: unknown): CarboneDownload {
  if (!(result && typeof result === 'object' && 'buffer' in result)) {
    throw new HttpError(
      502,
      'Respuesta inválida de Carbone.',
      'UPSTREAM_INVALID_RESPONSE',
    )
  }

  const download = result as CarboneDownload
  if (!(download.buffer instanceof Uint8Array)) {
    throw new HttpError(
      502,
      'Respuesta inválida de Carbone.',
      'UPSTREAM_INVALID_RESPONSE',
    )
  }

  return download
}

function downloadToResponse(download: CarboneDownload): Response {
  const headers = new Headers({
    ...corsHeaders,
    'Content-Type':
      download.contentType === 'application/pdf'
        ? 'application/pdf'
        : 'application/octet-stream',
    Connection: 'keep-alive',
  })

  if (download.contentDisposition) {
    headers.set('Content-Disposition', download.contentDisposition)
  }

  const body = new Uint8Array(
    download.buffer.buffer as ArrayBuffer,
    download.buffer.byteOffset,
    download.buffer.byteLength,
  )
  return new Response(body, { status: 200, headers })
}

export async function handleDownloadReportAction(args: {
  bodyUnknown: unknown
  supabase: SupabaseClient
  carboneBaseUrl: string
  carboneApiToken: string
}): Promise<Response> {
  const input: DownloadReportInput = DownloadReportSchema.parse(
    args.bodyUnknown,
  )
  const carbone = new CarboneClient(args.carboneBaseUrl, args.carboneApiToken)

  if ('plan_estudio_id' in input) {
    const { convertTo } = input.body as any
    if (convertTo === 'xlsx') {
      const datosExcel = await prepararDatosParaExcel(
        args.supabase,
        input.plan_estudio_id,
      )

      const result = await carbone.render(
        '1402917575045089616',
        { data: datosExcel },
        { download: true, format: 'xlsx' },
      )

      const processedBuffer = await postProcessExcel(
        result.buffer,
        { ...datosExcel.config, lineasCompletas: datosExcel.lineas },
      )

      return downloadToResponse({
        ...result,
        buffer: processedBuffer as Uint8Array,
      })
    }

    const ctx = await loadPlanContext(args.supabase, input.plan_estudio_id)
    const templateId = await loadTemplateIdForEstructura(
      args.supabase,
      ctx.estructura_id,
    )

    // Mismo constructor determinista que usa previewPayload: campos siempre
    // incluidos + campos de la estructura. Nunca se manda `{}`.
    const data = construirDatos(
      CAMPOS_SIEMPRE_PLAN,
      { plan: ctx.plan, carrera: ctx.carrera },
      ctx.definicion,
      ctx.datos,
    )

    const { data: _ignoredData, ...extraBody } = input.body
    const result = await carbone.render(
      templateId,
      { data, ...extraBody },
      { download: true },
    )

    return downloadToResponse(ensureCarboneDownload(result))
  }

  const templateId = await loadTemplateIdForAsignatura(
    args.supabase,
    input.asignatura_id,
  )

  // La edge function arma los datos desde la BD para garantizar que siempre
  // viajen contenido temático, evaluación, bibliografía y nivel.
  const data = await prepararDatosParaAsignatura(
    args.supabase,
    input.asignatura_id,
  )

  // Permitimos overrides/extra opcionales desde el cliente (p. ej. convertTo),
  // pero ignoramos cualquier `data` que mande para no romper la garantía.
  const { data: _ignoredData, ...extraBody } = input.body as Record<
    string,
    unknown
  >
  const result = await carbone.render(
    templateId,
    { data, ...extraBody },
    { download: true },
  )

  return downloadToResponse(ensureCarboneDownload(result))
}

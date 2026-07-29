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
  collectRichtextKeys,
  construirDatos,
  construirMetadata,
  postProcessDatosPlan,
  type FieldMeta,
} from '../_shared/camposDocumento.ts'
import { postProcessRenderedDocxRichtext } from './richtext-template.ts'

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

// Plantilla Excel del mapa curricular usada cuando la estructura del plan no
// tiene una propia configurada (estructuras_plan.excel_template_id = null).
const DEFAULT_EXCEL_MAPA_TEMPLATE_ID = '1402917575045089616'

async function prepararDatosParaExcel(
  supabase: SupabaseClient,
  planEstudioId: string,
) {
  const { data: plan, error: planError } = await supabase
    .from('planes_estudio')
    .select(
      '*, estructura:estructuras_plan!planes_estudio_estructura_id_fkey(*)',
    )
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
      acc[asig.id] = asig.codigo ?? ''
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
    const totalCreditos = parseFloat(
      materiasDelCiclo
        .reduce((sum, a) => sum + (Number(a.creditos) || 0), 0)
        .toFixed(2),
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
        creditos: parseFloat((Number(a.creditos) || 0).toFixed(2)),
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
  const totalPlanCreditos = parseFloat(
    semestres.reduce((sum, s) => sum + s.creditos, 0).toFixed(2),
  )
  const totalPlanHi = semestres.reduce((sum, s) => sum + s.hi, 0)
  const totalPlanHp = semestres.reduce((sum, s) => sum + s.hp, 0)

  // --- OPTATIVAS AGRUPADAS POR CICLO (para pestaña 2) ---
  const cicloNames = [
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
  ]
  const optativasPorCiclo = Array.from({ length: plan.numero_ciclos }, (_, i) =>
    asignaturas.filter(
      (a) => a.numero_ciclo === i + 1 && a.tipo === 'OPTATIVA',
    ),
  )
  const maxOptativas = Math.max(...optativasPorCiclo.map((m) => m.length), 1)

  const semestresOptativas = Array.from(
    { length: plan.numero_ciclos },
    (_, i) => {
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
    },
  )

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
      clave: a.codigo ?? '',
      nombre: a.nombre,
      clave_prerrequisito: a.prerrequisito_asignatura_id
        ? mapaClaves[a.prerrequisito_asignatura_id] || null
        : null,
      instalacion: String((a.datos as any)?.instalacion || 'Aula'),
      creditos: Number(a.creditos),
      hi: a.horas_independientes ?? 0,
      hp: a.horas_academicas ?? 0,
    })),
  }))

  // --- RETORNO DEL JSON FINAL ---
  return {
    nombre_plan: plan.nombre_display ?? plan.nombre_propuesto ?? plan.nombre,
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
      lineas: lineas.map((l) => ({
        nombre: l.nombre,
        count: l.materias.length,
      })),
      totalesObligatorias: {
        hp: asignaturas
          .filter((a) => a.tipo !== 'OPTATIVA')
          .reduce((s, a) => s + (a.horas_academicas ?? 0), 0),
        hi: asignaturas
          .filter((a) => a.tipo !== 'OPTATIVA')
          .reduce((s, a) => s + (a.horas_independientes ?? 0), 0),
        creditos: parseFloat(
          asignaturas
            .filter((a) => a.tipo !== 'OPTATIVA')
            .reduce((s, a) => s + Number(a.creditos ?? 0), 0)
            .toFixed(2),
        ),
      },
      totalesOptativas: {
        hp: asignaturas
          .filter((a) => a.tipo === 'OPTATIVA')
          .reduce((s, a) => s + (a.horas_academicas ?? 0), 0),
        hi: asignaturas
          .filter((a) => a.tipo === 'OPTATIVA')
          .reduce((s, a) => s + (a.horas_independientes ?? 0), 0),
        creditos: parseFloat(
          asignaturas
            .filter((a) => a.tipo === 'OPTATIVA')
            .reduce((s, a) => s + Number(a.creditos ?? 0), 0)
            .toFixed(2),
        ),
      },
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
    totalesObligatorias?: { hp: number; hi: number; creditos: number }
    totalesOptativas?: { hp: number; hi: number; creditos: number }
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
      widths: [4, 0.25, 4, 7.29, 13.57, 2.43],
    } as const)

    // Combinar el título del cuadro de totales (primera celda que contiene
    // "TOTAL" y cuya celda vecina derecha está vacía)
    mergeTotalBoxTitle(sheet1)
  }

  // ── Pestaña 2: OPTATIVAS ────────────────────────────────────────────────
  const sheet2 = workbook.getWorksheet('OPTATIVAS-Anexo 2 (A)')
  if (sheet2) {
    // Eliminar filas de semestres que no tienen asignaturas (col B vacía)
    removeEmptyOptativasSemesters(sheet2, 7)
    mergeColumnByContent(sheet2, 1, 7)
    fixOptativasFooter(
      sheet2,
      7,
      config.totalesObligatorias,
      config.totalesOptativas,
    )
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

/** Busca el cuadro de totales (primera celda con "TOTAL"), detecta su extensión
 *  completa (vertical y horizontal) desde sheet._merges, amplía el merge del título
 *  hasta la columna donde aparece el valor numérico de HA/HI/CR, y combina las
 *  filas HA/HI/CR con su celda etiqueta adyacente. */
function mergeTotalBoxTitle(sheet: any) {
  // 1. Encontrar la celda con "TOTAL"
  let titleCol = -1
  let titleRow = -1
  for (let r = 1; r <= sheet.rowCount; r++) {
    for (let c = 1; c <= 12; c++) {
      const val = sheet.getCell(r, c).value
      if (
        val &&
        typeof val === 'string' &&
        val.toUpperCase().includes('TOTAL')
      ) {
        titleCol = c
        titleRow = r
        break
      }
    }
    if (titleRow >= 0) break
  }
  if (titleCol < 0) return

  // 2. Detectar la extensión actual del merge del título (puede ser vertical + horizontal)
  let titleTop = titleRow,
    titleBottom = titleRow
  let titleLeft = titleCol,
    titleRight = titleCol
  for (const m of Object.values((sheet as any)._merges ?? {}) as any[]) {
    const model = m?.model ?? m
    if (!model) continue
    if (
      model.top <= titleRow &&
      model.bottom >= titleRow &&
      model.left <= titleCol &&
      model.right >= titleCol
    ) {
      titleTop = model.top
      titleBottom = model.bottom
      titleLeft = model.left
      titleRight = model.right
      break
    }
  }

  // 3. Encontrar la fila HA/HI/CR y la columna del valor numérico (ancho real del cuadro)
  let haRow = -1
  let boxRightCol = titleRight
  for (
    let r = titleBottom + 1;
    r <= Math.min(titleBottom + 15, sheet.rowCount);
    r++
  ) {
    const rowLabel = String(sheet.getCell(r, titleLeft).value ?? '')
    if (/^\s*(HA|HI|CR)\s*$/.test(rowLabel)) {
      haRow = r
      for (let c = titleLeft + 1; c <= titleLeft + 6; c++) {
        const v = sheet.getCell(r, c).value
        if (v !== null && v !== '' && v !== undefined) {
          boxRightCol = c
          break
        }
      }
      break
    }
  }
  // Al menos ampliar 1 columna si no se detectó el valor
  boxRightCol = Math.max(boxRightCol, titleRight + 1)

  // 4. Extender el título hasta la fila justo antes de HA (incluye filas vacías de relleno)
  //    p.ej. si el template tiene fila 63 como título y fila 64 vacía antes de HA en 65,
  //    el título debe abarcar 63-64 para no dejar celdas sueltas visibles.
  const titleBottomExt = haRow > 0 ? haRow - 1 : titleBottom

  // 5. Re-mergear el título al ancho y alto completo del cuadro
  try {
    sheet.unMergeCells(titleTop, titleLeft, titleBottom, titleRight)
  } catch {}
  // Deshacer posibles merges parciales en las filas de relleno
  for (let r = titleBottom + 1; r <= titleBottomExt; r++) {
    for (let span = boxRightCol; span >= titleLeft + 1; span--) {
      try {
        sheet.unMergeCells(r, titleLeft, r, span)
      } catch {}
    }
  }
  try {
    sheet.mergeCells(titleTop, titleLeft, titleBottomExt, boxRightCol)
  } catch {}
  const titleCell = sheet.getCell(titleTop, titleLeft)
  titleCell.alignment = {
    ...(titleCell.alignment ?? {}),
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
  }

  // 6. Combinar filas HA / HI / CR con su celda etiqueta adyacente
  for (
    let r = titleBottomExt + 1;
    r <= Math.min(titleBottomExt + 10, sheet.rowCount);
    r++
  ) {
    const val = sheet.getCell(r, titleLeft).value
    if (val && typeof val === 'string' && /^\s*(HA|HI|CR)\s*$/.test(val)) {
      const right = sheet.getCell(r, titleLeft + 1)
      if (!right.value || right.value === '') {
        try {
          sheet.mergeCells(r, titleLeft, r, titleLeft + 1)
        } catch {}
      }
    }
  }
}

/** Ajusta el footer de la hoja OPTATIVAS:
 * - Inserta 1 fila en blanco ANTES de cada sección de resumen (REQUERIMIENTOS y TOTAL).
 * - Preserva el fondo gris y mergea/centra los títulos de esas secciones.
 * - Llena los totales de OBLIGATORIAS, OPTATIVAS y SUMAS TOTALES. */
function fixOptativasFooter(
  sheet: any,
  dataStartRow: number,
  totalesObligatorias?: { hp: number; hi: number; creditos: number },
  totalesOptativas?: { hp: number; hi: number; creditos: number },
) {
  const SECTION_TITLE_RE = /REQUERIMIENTOS|TOTAL DE ASIGNATURAS/i
  const TOTAL_ROW_RE = /OBLIGATORIAS|OPTATIVAS|SUMAS TOTALES/i

  // Ancho de la tabla: columna más a la derecha con contenido en la fila de encabezado,
  // incluyendo el extent de celdas mergeadas (cuyo valor está solo en la celda master).
  let tableMaxCol = 8
  const headerRow = dataStartRow - 1
  for (let c = 1; c <= 12; c++) {
    if (cellText(sheet, headerRow, c)) tableMaxCol = c
  }
  // Extender tableMaxCol si alguna celda master en esa fila tiene un merge más amplio
  for (const m of Object.values((sheet as any)._merges ?? {}) as any[]) {
    const model = m?.model ?? m
    if (!model) continue
    if (model.top === headerRow && model.bottom === headerRow) {
      tableMaxCol = Math.max(tableMaxCol, model.right)
    }
  }

  // ── 1. Encontrar última fila de datos y posiciones de títulos de sección ──
  let lastDataRow = dataStartRow - 1
  const sectionTitleRows: number[] = [] // filas con "REQUERIMIENTOS" o "TOTAL DE..."
  const totalTableRows: { row: number; key: string }[] = [] // OBLIGATORIAS etc.

  for (let r = dataStartRow; r <= sheet.rowCount; r++) {
    for (let c = 1; c <= tableMaxCol; c++) {
      const v = cellText(sheet, r, c)
      if (!v) continue
      if (SECTION_TITLE_RE.test(v)) {
        sectionTitleRows.push(r)
        break
      }
      if (TOTAL_ROW_RE.test(v)) {
        totalTableRows.push({ row: r, key: v.toUpperCase() })
        break
      }
    }
    // Última fila con asignatura (col B) — solo antes de las secciones
    if (sectionTitleRows.length === 0 && cellText(sheet, r, 2)) lastDataRow = r
  }

  // ── 2. Insertar fila en blanco antes de cada sección (en orden inverso) ──
  // Solo se eliminan filas COMPLETAMENTE vacías entre secciones; las filas con
  // contenido (como CRÉDITOS o HORAS BAJO) se preservan siempre.
  const separators = [lastDataRow, ...sectionTitleRows.slice(0, -1)]
  for (let i = sectionTitleRows.length - 1; i >= 0; i--) {
    const sRow = sectionTitleRows[i]
    const prev = separators[i]

    // Identificar solo filas VACÍAS entre prev y sRow
    const blankRows: number[] = []
    for (let r = prev + 1; r < sRow; r++) {
      let isEmpty = true
      for (let c = 1; c <= tableMaxCol; c++) {
        if (cellText(sheet, r, c)) {
          isEmpty = false
          break
        }
      }
      if (isEmpty) blankRows.push(r)
    }

    if (blankRows.length === 0) {
      // Sin fila en blanco → insertar una antes de la sección
      try {
        sheet.spliceRows(sRow, 0, [])
      } catch {}
      for (let j = i; j < sectionTitleRows.length; j++) sectionTitleRows[j]++
      for (const tr of totalTableRows) {
        if (tr.row >= sRow) tr.row++
      }
    } else if (blankRows.length > 1) {
      // Más de una fila en blanco → eliminar extras, dejar solo la última
      const toDelete = blankRows.slice(0, -1)
      for (let k = toDelete.length - 1; k >= 0; k--) {
        const delRow = toDelete[k]
        try {
          sheet.spliceRows(delRow, 1)
        } catch {}
        for (let j = i; j < sectionTitleRows.length; j++) {
          if (sectionTitleRows[j] > delRow) sectionTitleRows[j]--
        }
        for (const tr of totalTableRows) {
          if (tr.row > delRow) tr.row--
        }
      }
    }
  }

  // ── 3a. Mergear filas separadoras en blanco ──────────────────────────────
  // Las filas vacías insertadas antes de cada sección necesitan mergearse
  // para que Excel muestre los bordes correctamente.
  for (const sRow of sectionTitleRows) {
    const blankRow = sRow - 1
    if (blankRow < dataStartRow) continue
    let isBlank = true
    for (let c = 1; c <= tableMaxCol; c++) {
      if (cellText(sheet, blankRow, c)) {
        isBlank = false
        break
      }
    }
    if (isBlank) {
      try {
        sheet.mergeCells(blankRow, 1, blankRow, tableMaxCol)
      } catch {}
    }
  }

  // ── 3. Mergear y centrar títulos preservando el fondo gris ───────────────
  // El merge empieza en la columna donde está el texto (no desde col A)
  // para que el área gris coincida con el ancho real de la tabla.
  for (const sRow of sectionTitleRows) {
    for (let c = 1; c <= tableMaxCol; c++) {
      const v = cellText(sheet, sRow, c)
      if (v && SECTION_TITLE_RE.test(v)) {
        const titleCol = c // columna donde está el texto y el estilo gris
        const srcStyle = JSON.parse(
          JSON.stringify(sheet.getCell(sRow, titleCol).style || {}),
        )

        // Desmerge previo
        for (let span = tableMaxCol; span >= 2; span--) {
          try {
            sheet.unMergeCells(sRow, titleCol, sRow, span)
          } catch {}
          try {
            sheet.unMergeCells(sRow, 1, sRow, span)
          } catch {}
        }
        // Merge desde la columna del título hasta el ancho de la tabla
        try {
          sheet.mergeCells(sRow, titleCol, sRow, tableMaxCol)
        } catch {}
        const master = sheet.getCell(sRow, titleCol)
        master.value = v
        master.style = {
          ...srcStyle,
          alignment: {
            horizontal: 'center',
            vertical: 'middle',
            wrapText: false,
          },
        }
        break
      }
    }
  }

  // ── 4. Detectar columnas HP, HI, Créditos y la fila de encabezado ──────────
  // Se detecta ANTES del merge de títulos para poder usar crCol como límite derecho.
  let hpCol = 5,
    hiCol = 6,
    crCol = 7,
    hdrRow = -1 // defaults: E, F, G
  for (let r = 1; r <= sheet.rowCount; r++) {
    let found = false
    for (let c = 1; c <= 12; c++) {
      const v = cellText(sheet, r, c) ?? ''
      if (/TIPO DE ASIGNATURA/i.test(v)) {
        found = true
        hdrRow = r
      }
      if (found) {
        if (/HORAS.*BAJO|BAJO.*ACADÉMICO|HP/i.test(v) && c > 1) hpCol = c
        else if (/HORAS.*INDEP|INDEP.*HORAS|HI/i.test(v) && c > 1) hiCol = c
        else if (/CRÉDITO/i.test(v) && c > 1) crCol = c
      }
    }
    if (found) break
  }

  // ── 5 (nueva). Mergear títulos de sección hasta crCol (no tableMaxCol) ──────
  // Los títulos REQUERIMIENTOS y TOTAL DE ASIGNATURAS deben abarcar el ancho
  // de la tabla de totales (hasta CRÉDITOS), no el de la tabla de datos.
  for (const sRow of sectionTitleRows) {
    for (let c = 1; c <= tableMaxCol; c++) {
      const v = cellText(sheet, sRow, c)
      if (v && SECTION_TITLE_RE.test(v)) {
        const titleCol = c
        const srcStyle = JSON.parse(
          JSON.stringify(sheet.getCell(sRow, titleCol).style || {}),
        )
        // Desmerge previo (el título puede estar ya mergeado parcialmente)
        for (let span = crCol; span >= 2; span--) {
          try {
            sheet.unMergeCells(sRow, titleCol, sRow, span)
          } catch {}
          try {
            sheet.unMergeCells(sRow, 1, sRow, span)
          } catch {}
        }
        try {
          sheet.mergeCells(sRow, titleCol, sRow, crCol)
        } catch {}
        const master = sheet.getCell(sRow, titleCol)
        master.value = v
        master.style = {
          ...srcStyle,
          alignment: {
            horizontal: 'center',
            vertical: 'middle',
            wrapText: false,
          },
        }
        break
      }
    }
  }

  // ── 6 (nueva). Mergear encabezados HP e HI igual que las celdas de datos ────
  if (hdrRow > 0) {
    if (hiCol > hpCol + 1) {
      try {
        sheet.unMergeCells(hdrRow, hpCol, hdrRow, hiCol - 1)
      } catch {}
      try {
        sheet.mergeCells(hdrRow, hpCol, hdrRow, hiCol - 1)
      } catch {}
    }
    if (crCol > hiCol + 1) {
      try {
        sheet.unMergeCells(hdrRow, hiCol, hdrRow, crCol - 1)
      } catch {}
      try {
        sheet.mergeCells(hdrRow, hiCol, hdrRow, crCol - 1)
      } catch {}
    }
  }

  // ── 7. Llenar tabla de totales ────────────────────────────────────────────
  if (!totalesObligatorias && !totalesOptativas) return

  const ob = totalesObligatorias ?? { hp: 0, hi: 0, creditos: 0 }
  const op = totalesOptativas ?? { hp: 0, hi: 0, creditos: 0 }

  for (const { row, key } of totalTableRows) {
    let hp = 0,
      hi = 0,
      cr = 0
    if (/OBLIGATORIA/i.test(key)) {
      hp = ob.hp
      hi = ob.hi
      cr = ob.creditos
    } else if (/OPTATIVA/i.test(key)) {
      hp = op.hp
      hi = op.hi
      cr = op.creditos
    } else if (/SUMAS TOTALES/i.test(key)) {
      hp = ob.hp + op.hp
      hi = ob.hi + op.hi
      cr = ob.creditos + op.creditos
    }

    sheet.getCell(row, hpCol).value = hp || null
    sheet.getCell(row, hiCol).value = hi || null
    sheet.getCell(row, crCol).value = cr || null
  }

  // Mergear las celdas de HP e HI con sus columnas adyacentes vacías
  for (const { row } of totalTableRows) {
    if (hiCol > hpCol + 1) {
      try {
        sheet.unMergeCells(row, hpCol, row, hiCol - 1)
      } catch {}
      try {
        sheet.mergeCells(row, hpCol, row, hiCol - 1)
      } catch {}
    }
    if (crCol > hiCol + 1) {
      try {
        sheet.unMergeCells(row, hiCol, row, crCol - 1)
      } catch {}
      try {
        sheet.mergeCells(row, hiCol, row, crCol - 1)
      } catch {}
    }
  }
}

/** Elimina filas vacías de la sección de datos de la hoja OPTATIVAS.
 *
 * Carbone genera una fila por slot (maxOptativas) aunque el semestre tenga
 * menos materias, rellenando con null. Esta función elimina SOLO en la sección
 * de datos (antes del primer título de sección gris como REQUERIMIENTOS o TOTAL).
 * Las filas de la sección footer NO se tocan. */
function removeEmptyOptativasSemesters(sheet: any, dataStartRow: number) {
  const FOOTER_RE = /REQUERIMIENTOS|TOTAL DE ASIGNATURAS/i

  // Determinar hasta dónde llega la sección de datos (antes del primer footer)
  let dataEndRow = sheet.rowCount
  for (let r = dataStartRow; r <= sheet.rowCount; r++) {
    let isFooter = false
    for (let c = 1; c <= 8; c++) {
      if (FOOTER_RE.test(cellText(sheet, r, c) ?? '')) {
        isFooter = true
        break
      }
    }
    if (isFooter) {
      dataEndRow = r - 1
      break
    }
  }

  // Eliminar filas vacías (col B vacía) solo dentro de la sección de datos
  const emptyRows: number[] = []
  for (let r = dataStartRow; r <= dataEndRow; r++) {
    if (!cellText(sheet, r, 2)) emptyRows.push(r)
  }
  for (let i = emptyRows.length - 1; i >= 0; i--) {
    try {
      sheet.spliceRows(emptyRows[i], 1)
    } catch {}
  }
}

/** Combina celdas consecutivas con el mismo valor no-vacío en la columna
 *  indicada, comenzando desde `dataStartRow`. */
function mergeColumnByContent(
  sheet: any,
  colNum: number,
  dataStartRow: number,
) {
  if (sheet.rowCount < dataStartRow) return

  let groupStart = dataStartRow
  let currentVal = cellText(sheet, dataStartRow, colNum)

  for (let r = dataStartRow + 1; r <= sheet.rowCount + 1; r++) {
    const val = r <= sheet.rowCount ? cellText(sheet, r, colNum) : null

    if (val !== currentVal || r > sheet.rowCount) {
      if (r - groupStart > 1 && currentVal) {
        try {
          sheet.mergeCells(groupStart, colNum, r - 1, colNum)
        } catch {
          /* ya combinada */
        }
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
 * Maneja dinámicamente cualquier número de líneas:
 * - 3 template groups (AAA/BBB/CCC) → se reutilizan para las primeras 3 líneas
 * - Líneas extra (4ª, 5ª...): se clona el bloque completo del grupo 0 antes de ORGANIZACIÓN
 * - Grupos sin línea asignada: se eliminan (incluyendo sus filas de encabezado)
 * - Grupos con más asignaturas que filas: se insertan filas con spliceRows */
function writeLineasToFlexibleSheet(sheet: any, lineas: LineaConMaterias[]) {
  const PLACEHOLDER_RE = /^[A-Z]{2,10}$/
  const HEADER_WORDS =
    /ÁREA|MÓDULO|ASIGNATURA|CLAVE|SERIACIÓN|HORAS|CRÉDITOS|INSTALACIONES/i
  const HEADER_DETECT =
    /ÁREA|ASIGNATURA|CLAVE|SERIACIÓN|HORAS|CRÉDITOS|INSTALACIONES/i

  const orgRow = findOrganizacionRow(sheet)
  const sheetEnd = orgRow ? orgRow - 1 : sheet.rowCount

  // ── 1. Encontrar placeholders ────────────────────────────────────────────
  type Group = {
    headerStart: number
    startRow: number
    endRow: number
    lineaCol: number
    dataCol: number
  }

  const rawGroups: Array<{
    startRow: number
    lineaCol: number
    dataCol: number
  }> = []
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

  // ── 2. Calcular endRow y headerStart de cada grupo ───────────────────────
  const findEndRow = (startRow: number, lineaCol: number): number => {
    for (let r = startRow + 1; r <= sheetEnd; r++) {
      const v = cellText(sheet, r, lineaCol)
      if (v && (PLACEHOLDER_RE.test(v) || /ÁREA|MÓDULO/i.test(v))) return r - 1
      for (let c = 1; c <= 8; c++) {
        if (/ÁREA \(O MÓDULO\)/i.test(cellText(sheet, r, c) ?? '')) return r - 1
      }
    }
    return sheetEnd
  }

  const findHeaderStart = (prevEnd: number, startRow: number): number => {
    for (let r = prevEnd + 1; r < startRow; r++) {
      for (let c = 1; c <= 8; c++) {
        if (HEADER_DETECT.test(cellText(sheet, r, c) ?? '')) return r
      }
    }
    return startRow
  }

  const groups: Group[] = []
  for (let gi = 0; gi < rawGroups.length; gi++) {
    const rg = rawGroups[gi]
    const prevEnd = gi === 0 ? 0 : groups[gi - 1].endRow
    groups.push({
      ...rg,
      endRow: findEndRow(rg.startRow, rg.lineaCol),
      headerStart: findHeaderStart(prevEnd, rg.startRow),
    })
  }

  // ── 3. Capturar snapshot del bloque completo del grupo 0 ─────────────────
  // (para clonar grupos adicionales si hay más líneas que slots en el template)
  const g0 = groups[0]
  const MAX_COL = g0.lineaCol + 7
  const g0HeaderRows = g0.startRow - g0.headerStart // número de filas de encabezado

  type RowSnap = { height: number; values: any[]; styles: (any | null)[] }
  const g0BlockSnap: RowSnap[] = []
  for (let r = g0.headerStart; r <= g0.endRow; r++) {
    const row = sheet.getRow(r)
    const styles: (any | null)[] = []
    const values: any[] = []
    for (let c = 1; c <= MAX_COL; c++) {
      const cell = sheet.getCell(r, c)
      const isSlave = cell.type === 1
      styles.push(isSlave ? null : JSON.parse(JSON.stringify(cell.style || {})))
      values.push(isSlave ? null : (cell.value ?? null))
    }
    g0BlockSnap.push({ height: row.height, values, styles })
  }

  // Capturar merges del encabezado del grupo 0 (relativas al inicio del bloque)
  const g0HeaderMerges: {
    relTop: number
    relBottom: number
    left: number
    right: number
  }[] = []
  for (const m of Object.values((sheet as any)._merges ?? {}) as any[]) {
    const model = m?.model ?? m
    if (!model) continue
    const { top, bottom, left, right } = model
    if (top >= g0.headerStart && top < g0.startRow) {
      g0HeaderMerges.push({
        relTop: top - g0.headerStart,
        relBottom: bottom - g0.headerStart,
        left,
        right,
      })
    }
  }

  // ── 4. Procesar grupos en ORDEN INVERSO ──────────────────────────────────
  // Al insertar/eliminar al final del grupo, los grupos anteriores no se desplazan.
  for (let gi = groups.length - 1; gi >= 0; gi--) {
    const { headerStart, startRow, endRow, lineaCol, dataCol } = groups[gi]
    const linea = gi < lineas.length ? lineas[gi] : null
    const subjectCount = linea?.materias.length ?? 0
    const templateRows = endRow - startRow + 1

    // Sin línea → eliminar todo el bloque (encabezado + datos)
    if (!linea || subjectCount === 0) {
      const blockRows = endRow - headerStart + 1
      try {
        sheet.spliceRows(headerStart, blockRows)
      } catch {}
      continue
    }

    // Capturar estilo de la fila de datos ANTES de modificar
    const rowStyle = captureRowCellStyles(sheet, startRow, MAX_COL)
    const rowHeight = sheet.getRow(startRow).height

    // Insertar filas extra si hay más asignaturas que filas de datos
    if (subjectCount > templateRows) {
      const toInsert = subjectCount - templateRows
      try {
        sheet.spliceRows(endRow + 1, 0, ...Array(toInsert).fill([]))
      } catch {
        for (let k = 0; k < toInsert; k++) {
          try {
            sheet.spliceRows(endRow + 1 + k, 0, [])
          } catch {}
        }
      }
    }

    // Desmerge de la columna de área en el rango de escritura
    const writeRows = Math.max(subjectCount, templateRows)
    for (let r = startRow; r < startRow + writeRows; r++) {
      for (let span = startRow + writeRows - r - 1; span >= 1; span--) {
        try {
          sheet.unMergeCells(r, lineaCol, r + span, lineaCol)
        } catch {}
      }
    }

    // Limpiar valores en el rango
    for (let r = startRow; r < startRow + writeRows; r++) {
      for (let c = lineaCol; c <= lineaCol + 7; c++) {
        try {
          sheet.getCell(r, c).value = null
        } catch {}
      }
    }

    // Escribir asignaturas
    for (let j = 0; j < subjectCount; j++) {
      const mat = linea.materias[j]
      const row = startRow + j
      sheet.getCell(row, lineaCol).value = j === 0 ? linea.nombre : null
      sheet.getCell(row, dataCol).value = mat.nombre
      sheet.getCell(row, dataCol + 1).value = mat.clave
      sheet.getCell(row, dataCol + 2).value = mat.clave_prerrequisito ?? ''
      sheet.getCell(row, dataCol + 3).value = mat.hp
      sheet.getCell(row, dataCol + 4).value = mat.hi
      sheet.getCell(row, dataCol + 5).value = mat.creditos
      sheet.getCell(row, dataCol + 6).value = mat.instalacion
      if (j >= templateRows) {
        applyRowCellStyles(sheet, row, rowStyle, MAX_COL)
        sheet.getRow(row).height = rowHeight
      }
    }

    // Filas con asignatura: normalizar bordes faltantes.
    // Filas vacías (sin asignatura): eliminar bordes para no mostrar celdas vacías enmarcadas.
    for (let j = 0; j < writeRows; j++) {
      const row = startRow + j
      for (let c = 1; c <= MAX_COL; c++) {
        try {
          const cell = sheet.getCell(row, c)
          if (cell.type === 1) continue // merge slave — skip
          if (j >= subjectCount) {
            cell.border = undefined
          } else if (!cell.border && rowStyle[c - 1]?.border) {
            cell.border = JSON.parse(JSON.stringify(rowStyle[c - 1].border))
          }
        } catch {}
      }
    }

    // El borde inferior de la celda ÁREA se obtiene de la ÚLTIMA fila del template
    // (endRow), ya que la primera fila (startRow) puede no tenerlo definido.
    const lastAreaStyles = captureRowCellStyles(sheet, endRow, MAX_COL)
    let areaBottomBorder: any =
      lastAreaStyles[lineaCol - 1]?.border?.bottom ??
      rowStyle[lineaCol - 1]?.border?.bottom
    // Fallback: si la columna ÁREA no tiene border.bottom explícito (celda esclava en
    // el template), tomarlo de cualquier columna que sí lo tenga.
    if (!areaBottomBorder) {
      for (let c = 1; c <= MAX_COL; c++) {
        if (c === lineaCol) continue
        const b =
          lastAreaStyles[c - 1]?.border?.bottom ??
          rowStyle[c - 1]?.border?.bottom
        if (b) {
          areaBottomBorder = b
          break
        }
      }
    }

    // Determinar el estilo de borde inferior antes de tocar los merges
    const areaCell = sheet.getCell(startRow, lineaCol)
    const refBorderStyle = areaBottomBorder ?? {
      style:
        areaCell.border?.left?.style || areaCell.border?.top?.style || 'thin',
    }

    // Aplicar el borde inferior en la ÚLTIMA FILA del rango ANTES de mergear.
    // En xlsx el borde inferior de un rango mergeado debe estar en la última fila,
    // no en el master — si se aplica solo al master Excel no lo renderiza.
    const lastSubjectMergeRow = startRow + subjectCount - 1
    try {
      const lastAreaCell = sheet.getCell(lastSubjectMergeRow, lineaCol)
      lastAreaCell.border = {
        ...(lastAreaCell.border ?? {}),
        bottom: refBorderStyle,
      }
    } catch {}

    // Deshacer el merge del template en la columna ÁREA y re-mergear a la altura exacta
    try {
      sheet.unMergeCells(startRow, lineaCol, endRow, lineaCol)
    } catch {}
    if (subjectCount > 1) {
      try {
        sheet.mergeCells(
          startRow,
          lineaCol,
          startRow + subjectCount - 1,
          lineaCol,
        )
      } catch {}
    }
    // También aplicar en el master (para exportadores que leen del master)
    areaCell.border = { ...(areaCell.border ?? {}), bottom: refBorderStyle }

    // Cerrar borde inferior en TODAS las columnas de la última fila con asignatura.
    const lastSubjectRow = startRow + subjectCount - 1
    for (let c = 1; c <= MAX_COL; c++) {
      if (c === lineaCol) continue // ya manejado arriba (master del merge)
      const bottomBorder =
        lastAreaStyles[c - 1]?.border?.bottom ?? rowStyle[c - 1]?.border?.bottom
      if (!bottomBorder) continue
      try {
        const cell = sheet.getCell(lastSubjectRow, c)
        if (cell.type === 1) continue // celda esclava de merge horizontal
        cell.border = { ...(cell.border ?? {}), bottom: bottomBorder }
      } catch {}
    }
  }

  // ── 5. Agregar bloques para líneas extra (más allá de los grupos template) ─
  for (let ei = groups.length; ei < lineas.length; ei++) {
    const linea = lineas[ei]
    const subjectCount = linea.materias.length
    const dataTemplateRows = g0.endRow - g0.startRow + 1
    const dataRows = Math.max(subjectCount, dataTemplateRows)
    const totalInsert = g0HeaderRows + dataRows

    const currentOrgRow = findOrganizacionRow(sheet)
    if (!currentOrgRow) break
    const insertAt = currentOrgRow // insertar justo antes de ORGANIZACIÓN

    // Insertar filas vacías
    try {
      sheet.spliceRows(insertAt, 0, ...Array(totalInsert).fill([]))
    } catch {
      for (let k = 0; k < totalInsert; k++) {
        try {
          sheet.spliceRows(insertAt + k, 0, [])
        } catch {}
      }
    }

    // Copiar estilos y valores de encabezado desde el snapshot del grupo 0
    for (let i = 0; i < g0BlockSnap.length && i < totalInsert; i++) {
      const snap = g0BlockSnap[i]
      const dstRow = insertAt + i
      sheet.getRow(dstRow).height = snap.height

      const isHeaderRow = i < g0HeaderRows
      for (let c = 1; c <= MAX_COL; c++) {
        if (snap.styles[c - 1] === null) continue // skip merge slaves
        const dstCell = sheet.getCell(dstRow, c)
        dstCell.style = JSON.parse(JSON.stringify(snap.styles[c - 1]))
        if (isHeaderRow && snap.values[c - 1] !== null) {
          dstCell.value = snap.values[c - 1]
        }
      }
    }

    // Recrear merges del encabezado clonado
    for (const m of g0HeaderMerges) {
      try {
        sheet.mergeCells(
          insertAt + m.relTop,
          m.left,
          insertAt + m.relBottom,
          m.right,
        )
      } catch {}
    }

    // Posición de las filas de datos dentro del nuevo bloque
    const newDataStart = insertAt + g0HeaderRows
    const lineaCol = g0.lineaCol
    const dataCol = g0.dataCol

    // Capturar estilo de la primera fila de datos del bloque clonado
    const rowStyle = captureRowCellStyles(sheet, newDataStart, MAX_COL)
    const rowHeight = sheet.getRow(newDataStart).height

    // Limpiar posibles valores de placeholder copiados del snapshot
    for (let r = newDataStart; r < newDataStart + dataRows; r++) {
      for (let c = lineaCol; c <= lineaCol + 7; c++) {
        try {
          sheet.getCell(r, c).value = null
        } catch {}
      }
    }

    // Escribir asignaturas
    for (let j = 0; j < subjectCount; j++) {
      const mat = linea.materias[j]
      const row = newDataStart + j
      sheet.getCell(row, lineaCol).value = j === 0 ? linea.nombre : null
      sheet.getCell(row, dataCol).value = mat.nombre
      sheet.getCell(row, dataCol + 1).value = mat.clave
      sheet.getCell(row, dataCol + 2).value = mat.clave_prerrequisito ?? ''
      sheet.getCell(row, dataCol + 3).value = mat.hp
      sheet.getCell(row, dataCol + 4).value = mat.hi
      sheet.getCell(row, dataCol + 5).value = mat.creditos
      sheet.getCell(row, dataCol + 6).value = mat.instalacion
      if (j >= dataTemplateRows) {
        applyRowCellStyles(sheet, row, rowStyle, MAX_COL)
        sheet.getRow(row).height = rowHeight
      }
    }

    // Filas con asignatura: normalizar bordes; filas vacías: eliminar bordes.
    for (let j = 0; j < dataRows; j++) {
      const row = newDataStart + j
      for (let c = 1; c <= MAX_COL; c++) {
        try {
          const cell = sheet.getCell(row, c)
          if (cell.type === 1) continue
          if (j >= subjectCount) {
            cell.border = undefined
          } else if (!cell.border && rowStyle[c - 1]?.border) {
            cell.border = JSON.parse(JSON.stringify(rowStyle[c - 1].border))
          }
        } catch {}
      }
    }

    // Borde inferior desde la última fila del template del grupo 0
    const lastAreaStyles2 = captureRowCellStyles(sheet, g0.endRow, MAX_COL)
    let areaBottomBorder2: any =
      lastAreaStyles2[lineaCol - 1]?.border?.bottom ??
      rowStyle[lineaCol - 1]?.border?.bottom
    if (!areaBottomBorder2) {
      for (let c = 1; c <= MAX_COL; c++) {
        if (c === lineaCol) continue
        const b =
          lastAreaStyles2[c - 1]?.border?.bottom ??
          rowStyle[c - 1]?.border?.bottom
        if (b) {
          areaBottomBorder2 = b
          break
        }
      }
    }

    const areaCell2 = sheet.getCell(newDataStart, lineaCol)
    const refBorderStyle2 = areaBottomBorder2 ?? {
      style:
        areaCell2.border?.left?.style || areaCell2.border?.top?.style || 'thin',
    }

    // Aplicar borde inferior en la ÚLTIMA FILA antes de mergear
    const lastSubjectMergeRow2 = newDataStart + subjectCount - 1
    try {
      const lastAreaCell2 = sheet.getCell(lastSubjectMergeRow2, lineaCol)
      lastAreaCell2.border = {
        ...(lastAreaCell2.border ?? {}),
        bottom: refBorderStyle2,
      }
    } catch {}

    if (subjectCount > 1) {
      try {
        sheet.mergeCells(
          newDataStart,
          lineaCol,
          newDataStart + subjectCount - 1,
          lineaCol,
        )
      } catch {}
    }
    areaCell2.border = { ...(areaCell2.border ?? {}), bottom: refBorderStyle2 }

    // Cerrar borde inferior en TODAS las columnas de la última fila con asignatura.
    const lastSubjectRow2 = newDataStart + subjectCount - 1
    for (let c = 1; c <= MAX_COL; c++) {
      if (c === lineaCol) continue
      const bottomBorder2 =
        lastAreaStyles2[c - 1]?.border?.bottom ??
        rowStyle[c - 1]?.border?.bottom
      if (!bottomBorder2) continue
      try {
        const cell = sheet.getCell(lastSubjectRow2, c)
        if (cell.type === 1) continue
        cell.border = { ...(cell.border ?? {}), bottom: bottomBorder2 }
      } catch {}
    }
  }

  // ── 5b. Asegurar exactamente 3 filas en blanco entre tablas de líneas curriculares ──────
  // Re-escanear encabezados de grupo (filas que contienen "ÁREA (O MÓDULO)")
  {
    const orgRowSep = findOrganizacionRow(sheet)
    const scanEndSep = orgRowSep ? orgRowSep - 1 : sheet.rowCount
    const headerRowsSep: number[] = []
    for (let r = 1; r <= scanEndSep; r++) {
      for (let c = 1; c <= 8; c++) {
        if (/ÁREA \(O MÓDULO\)/i.test(cellText(sheet, r, c) ?? '')) {
          headerRowsSep.push(r)
          break
        }
      }
    }
    // Garantizar exactamente 3 filas en blanco antes de cada header (excepto el primero).
    // Se procesa en orden inverso para que las inserciones/borrados no desplacen índices ya procesados.
    for (let i = headerRowsSep.length - 1; i >= 1; i--) {
      const hRow = headerRowsSep[i]
      // Contar filas en blanco consecutivas inmediatamente antes de hRow
      let blankCount = 0
      let scanRow = hRow - 1
      while (scanRow >= 1) {
        let isEmpty = true
        for (let c = 1; c <= 10; c++) {
          if (cellText(sheet, scanRow, c)) {
            isEmpty = false
            break
          }
        }
        if (!isEmpty) break
        blankCount++
        scanRow--
      }
      if (blankCount < 3) {
        // Insertar las filas que faltan
        for (let k = 0; k < 3 - blankCount; k++) {
          try {
            sheet.spliceRows(hRow, 0, [])
          } catch {}
        }
      } else if (blankCount > 3) {
        // Eliminar el exceso (dejar solo las 3 más cercanas al header)
        try {
          sheet.spliceRows(scanRow + 1, blankCount - 3)
        } catch {}
      }
    }
  }

  // ── 6. Ajustar filas en blanco antes de ORGANIZACIÓN (exactamente 3) ──────
  const orgRowBeforeFill = findOrganizacionRow(sheet)
  if (orgRowBeforeFill) {
    let lastNonBlank = orgRowBeforeFill - 1
    while (lastNonBlank >= 1) {
      let hasContent = false
      for (let c = 1; c <= 10; c++) {
        if (cellText(sheet, lastNonBlank, c)) {
          hasContent = true
          break
        }
      }
      if (hasContent) break
      lastNonBlank--
    }
    const blanksCount = orgRowBeforeFill - 1 - lastNonBlank
    if (blanksCount > 3) {
      try {
        sheet.spliceRows(lastNonBlank + 1, blanksCount - 3)
      } catch {}
    } else if (blanksCount < 3) {
      for (let k = 0; k < 3 - blanksCount; k++) {
        try {
          sheet.spliceRows(lastNonBlank + 1, 0, [])
        } catch {}
      }
    }
  }

  // ── 7. Llenar tabla ORGANIZACIÓN (puede haberse desplazado) ──────────────
  const newOrgRow = findOrganizacionRow(sheet)
  if (newOrgRow) fillOrganizacionTable(sheet, newOrgRow, lineas)
}

/** Captura el estilo de cada celda de una fila (deep-clone). */
function captureRowCellStyles(
  sheet: any,
  rowNum: number,
  maxCol: number,
): any[] {
  const styles: any[] = []
  for (let c = 1; c <= maxCol; c++) {
    try {
      const cell = sheet.getCell(rowNum, c)
      styles.push(
        JSON.parse(
          JSON.stringify({
            font: cell.font ?? null,
            fill: cell.fill ?? null,
            border: cell.border ?? null,
            alignment: cell.alignment ?? null,
            numFmt: cell.numFmt ?? null,
          }),
        ),
      )
    } catch {
      styles.push({})
    }
  }
  return styles
}

/** Aplica estilos capturados a las celdas de una fila. */
function applyRowCellStyles(
  sheet: any,
  rowNum: number,
  styles: any[],
  maxCol: number,
) {
  for (let c = 1; c <= maxCol && c <= styles.length; c++) {
    try {
      const cell = sheet.getCell(rowNum, c)
      const s = styles[c - 1]
      if (s.font) cell.font = s.font
      if (s.fill) cell.fill = s.fill
      if (s.border) cell.border = s.border
      if (s.alignment) cell.alignment = s.alignment
      if (s.numFmt) cell.numFmt = s.numFmt
    } catch {
      /* ignorar */
    }
  }
}

/** Encuentra la fila que contiene el texto "ORGANIZACIÓN" en la hoja. */
function findOrganizacionRow(sheet: any): number | null {
  for (let r = 1; r <= sheet.rowCount; r++) {
    for (let c = 1; c <= 10; c++) {
      const val = sheet.getCell(r, c).value
      if (
        val &&
        typeof val === 'string' &&
        val.toUpperCase().includes('ORGANIZACIÓN')
      ) {
        return r
      }
    }
  }
  return null
}

/** Llena la tabla "ORGANIZACIÓN DEL PLAN DE ESTUDIOS" con datos reales de líneas. */
function fillOrganizacionTable(
  sheet: any,
  orgRow: number,
  lineas: LineaConMaterias[],
) {
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
  const orgTableRowStyle = captureRowCellStyles(
    sheet,
    firstDataRow,
    areaCol + 4,
  )
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
    const totalCreditos = parseFloat(
      linea.materias.reduce((s, m) => s + (m.creditos || 0), 0).toFixed(2),
    )

    sheet.getCell(row, areaCol).value = linea.nombre
    // areaCol+1 es celda esclava del merge de ÁREA (2 columnas) — escribir desde +2
    sheet.getCell(row, areaCol + 2).value = linea.materias.length
    sheet.getCell(row, areaCol + 3).value = totalHp
    sheet.getCell(row, areaCol + 4).value = totalHi
    sheet.getCell(row, areaCol + 5).value = totalCreditos
  }

  // Eliminar filas sobrantes del template (placeholders o vacías) antes de SUMAS TOTALES
  let nextRow = firstDataRow + lineas.length
  while (nextRow <= sheet.rowCount) {
    let isSumas = false
    for (let c = 1; c <= areaCol + 4; c++) {
      const v = cellText(sheet, nextRow, c)
      if (v && /SUMAS?|TOTAL/i.test(v)) {
        isSumas = true
        break
      }
    }
    if (isSumas) break
    try {
      sheet.spliceRows(nextRow, 1)
    } catch {
      nextRow++
      continue
    }
    // no incrementar: la fila siguiente sube al mismo índice
  }

  // Escribir la fila SUMAS TOTALES (suma de todas las líneas)
  if (nextRow <= sheet.rowCount) {
    const sumaCount = lineas.reduce((s, l) => s + l.materias.length, 0)
    const sumaHp = lineas.reduce(
      (s, l) => s + l.materias.reduce((ss, m) => ss + (m.hp || 0), 0),
      0,
    )
    const sumaHi = lineas.reduce(
      (s, l) => s + l.materias.reduce((ss, m) => ss + (m.hi || 0), 0),
      0,
    )
    const sumaCreditos = parseFloat(
      lineas
        .reduce(
          (s, l) => s + l.materias.reduce((ss, m) => ss + (m.creditos || 0), 0),
          0,
        )
        .toFixed(2),
    )
    sheet.getCell(nextRow, areaCol + 2).value = sumaCount
    sheet.getCell(nextRow, areaCol + 3).value = sumaHp
    sheet.getCell(nextRow, areaCol + 4).value = sumaHi
    sheet.getCell(nextRow, areaCol + 5).value = sumaCreditos
  }
}

type PlanContext = {
  plan: Record<string, unknown>
  carrera: Record<string, unknown> | null
  definicion: unknown
  datos: Json
  estructura_id: string
  fecha_inicio_imparticion: string | null
}

async function loadPlanContext(
  supabase: SupabaseClient,
  planEstudioId: string,
): Promise<PlanContext> {
  const { data, error } = await supabase
    .from('planes_estudio')
    .select(
      'nombre, nombre_display, nombre_propuesto, numero_ciclos, tipo_ciclo, datos, estructura_id, fecha_inicio_imparticion, carrera:carreras(nombre, nivel, clave_sep), estructura:estructuras_plan!planes_estudio_estructura_id_fkey(definicion)',
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
    fecha_inicio_imparticion: (data as any).fecha_inicio_imparticion ?? null,
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
  return postProcessDatosPlan(
    construirDatos(
      CAMPOS_SIEMPRE_PLAN,
      { plan: ctx.plan, carrera: ctx.carrera },
      ctx.definicion,
      ctx.datos,
      { richtextMode: 'documentHtml' },
    ),
    ctx.datos,
    ctx.fecha_inicio_imparticion,
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

// Resuelve la plantilla Excel del mapa para un plan: la de su estructura si
// existe, o la plantilla por defecto. Nunca lanza por falta de plantilla, para
// mantener compatibilidad con planes que aún no tienen una configurada.
async function loadExcelTemplateIdForPlan(
  supabase: SupabaseClient,
  planEstudioId: string,
): Promise<string> {
  const { data: plan, error: planError } = await supabase
    .from('planes_estudio')
    .select('estructura_id')
    .eq('id', planEstudioId)
    .maybeSingle()

  if (planError) {
    throw new HttpError(
      500,
      'Error consultando el plan de estudios.',
      'DB_ERROR',
      {
        message: planError.message,
        details: planError.details,
        hint: planError.hint,
      },
    )
  }
  if (!plan?.estructura_id) return DEFAULT_EXCEL_MAPA_TEMPLATE_ID

  const { data: estructura, error: estructuraError } = await supabase
    .from('estructuras_plan')
    .select('excel_template_id')
    .eq('id', plan.estructura_id)
    .maybeSingle()

  if (estructuraError) {
    throw new HttpError(
      500,
      'Error consultando la estructura del plan.',
      'DB_ERROR',
      {
        message: estructuraError.message,
        details: estructuraError.details,
        hint: estructuraError.hint,
      },
    )
  }

  return estructura?.excel_template_id ?? DEFAULT_EXCEL_MAPA_TEMPLATE_ID
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

function construirDatosAsignatura(
  ctx: AsignaturaContext,
): Record<string, unknown> {
  const result = construirDatos(
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
    { richtextMode: 'documentHtml' },
  )
  // Incluir datos raw para templates que acceden campos via {d.datos.X}
  if (!('datos' in result)) {
    result.datos = isRecord(ctx.asig.datos) ? ctx.asig.datos : {}
  }
  return result
}

async function loadAsignaturaContext(
  supabase: SupabaseClient,
  asignaturaId: string,
): Promise<AsignaturaContext> {
  const { data: asig, error } = await supabase
    .from('asignaturas')
    .select(
      '*, plan:planes_estudio(nombre, nombre_propuesto, nombre_display, numero_ciclos, tipo_ciclo, carrera:carreras(nombre, nivel, clave_sep)), estructura:estructuras_asignatura(definicion)',
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
  const estructura = (asigAny.estructura ?? null) as Record<
    string,
    unknown
  > | null

  return {
    asig: asigAny,
    plan,
    carrera,
    bibliografia_basica: bibliografia
      .filter((b) => b.tipo === 'BASICA')
      .map((b) => b.cita),
    bibliografia_complementaria: bibliografia
      .filter((b) => b.tipo === 'COMPLEMENTARIA')
      .map((b) => b.cita),
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
  return construirDatosAsignatura(ctx)
}

export async function prepararPreviewParaPlan(
  supabase: SupabaseClient,
  planEstudioId: string,
): Promise<{ data: Record<string, unknown>; fields: FieldMeta[] }> {
  const ctx = await loadPlanContext(supabase, planEstudioId)
  const data = postProcessDatosPlan(
    construirDatos(
      CAMPOS_SIEMPRE_PLAN,
      { plan: ctx.plan, carrera: ctx.carrera },
      ctx.definicion,
      ctx.datos,
    ),
    ctx.datos,
    ctx.fecha_inicio_imparticion,
  )
  const fields = construirMetadata(CAMPOS_SIEMPRE_PLAN, ctx.definicion).filter(
    (f) => f.key !== 'nivel_y_nombre_del_plan_de_estudios',
  )
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function renderDocxTemplateWithRichtext(input: {
  carbone: CarboneClient
  templateId: string
  body: Record<string, unknown>
  richtextKeys: ReadonlyArray<string>
}): Promise<CarboneDownload> {
  if (input.richtextKeys.length === 0) {
    return ensureCarboneDownload(
      await input.carbone.render(input.templateId, input.body, {
        download: true,
      }),
    )
  }

  const { convertTo, ...bodyWithoutConvert } = input.body
  const wantsPdf = convertTo === 'pdf'
  const data = isRecord(input.body.data) ? input.body.data : {}
  const renderedDocx = ensureCarboneDownload(
    await input.carbone.render(
      input.templateId,
      wantsPdf ? bodyWithoutConvert : input.body,
      { download: true },
    ),
  )

  const patchedDocx = postProcessRenderedDocxRichtext(
    renderedDocx.buffer,
    data,
    input.richtextKeys,
  )

  if (!wantsPdf) {
    return {
      ...renderedDocx,
      buffer: patchedDocx.buffer,
    }
  }

  return ensureCarboneDownload(
    await input.carbone.renderFromTemplate(
      {
        template: Buffer.from(patchedDocx.buffer).toString('base64'),
        data: {},
        convertTo: 'pdf',
      },
      { download: true },
    ),
  )
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

      const excelTemplateId = await loadExcelTemplateIdForPlan(
        args.supabase,
        input.plan_estudio_id,
      )

      const renderResult = await carbone.render(
        excelTemplateId,
        { data: datosExcel },
        { download: true, format: 'xlsx' },
      )
      const result = ensureCarboneDownload(renderResult)

      const processedBuffer = await postProcessExcel(result.buffer, {
        ...datosExcel.config,
        lineasCompletas: datosExcel.lineas,
      })

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
    const data = postProcessDatosPlan(
      construirDatos(
        CAMPOS_SIEMPRE_PLAN,
        { plan: ctx.plan, carrera: ctx.carrera },
        ctx.definicion,
        ctx.datos,
        { richtextMode: 'documentHtml' },
      ),
      ctx.datos,
      ctx.fecha_inicio_imparticion,
    )
    const richtextKeys = collectRichtextKeys(ctx.definicion)

    const { data: _ignoredData, ...extraBody } = input.body
    const result = await renderDocxTemplateWithRichtext({
      carbone,
      templateId,
      body: { data, ...extraBody },
      richtextKeys,
    })

    return downloadToResponse(ensureCarboneDownload(result))
  }

  const templateId = await loadTemplateIdForAsignatura(
    args.supabase,
    input.asignatura_id,
  )

  // La edge function arma los datos desde la BD para garantizar que siempre
  // viajen contenido temático, evaluación, bibliografía y nivel.
  const ctx = await loadAsignaturaContext(args.supabase, input.asignatura_id)
  const data = construirDatosAsignatura(ctx)
  const richtextKeys = collectRichtextKeys(ctx.definicion)

  // Permitimos overrides/extra opcionales desde el cliente (p. ej. convertTo),
  // pero ignoramos cualquier `data` que mande para no romper la garantía.
  const { data: _ignoredData, ...extraBody } = input.body as Record<
    string,
    unknown
  >
  const result = await renderDocxTemplateWithRichtext({
    carbone,
    templateId,
    body: { data, ...extraBody },
    richtextKeys,
  })

  return downloadToResponse(ensureCarboneDownload(result))
}

import {
  assertEquals,
  assertGreater,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import ExcelJS from 'npm:exceljs@4.4.0'

import {
  clasificarArchivoAcademico,
  combinarAsignaturas,
  leerMapaCurricularXlsx,
} from '../../academic-import-analyze/analysis.ts'

Deno.test('clasifica mapa, programa y resolución sin depender de IA', () => {
  assertEquals(
    clasificarArchivoAcademico({
      nombre: 'Anexo 2 mapa curricular.xlsx',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }).rol,
    'MAPA',
  )
  assertEquals(
    clasificarArchivoAcademico({
      nombre: 'Programa Matemáticas.docx',
      mime: 'docx',
    }).rol,
    'PROGRAMA',
  )
  assertEquals(
    clasificarArchivoAcademico({ nombre: 'Resolución RVOE.pdf', mime: 'pdf' })
      .rol,
    'RESOLUCION',
  )
  assertEquals(
    clasificarArchivoAcademico({ nombre: 'documento.pdf', mime: 'pdf' }).rol,
    'OTRO',
  )
})

Deno.test(
  'lee mapa con hoja renombrada, fórmulas y créditos ignorados',
  async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Trayecto flexible')
    sheet.addRow([
      'Clave',
      'Asignatura',
      'Ciclo',
      'Horas docente',
      'Horas independientes',
      'Créditos',
      'Instalación',
    ])
    sheet.addRow([
      'MAT-01',
      'Pensamiento matemático',
      1,
      3,
      2,
      { formula: 'D2+E2', result: 5 },
      'L',
    ])
    const buffer = await workbook.xlsx.writeBuffer()
    const result = await leerMapaCurricularXlsx(new Uint8Array(buffer))

    assertEquals(result.asignaturas.length, 1)
    assertEquals(result.asignaturas[0].codigo, 'MAT-01')
    assertEquals(result.asignaturas[0].horas_academicas, 3)
    assertEquals(result.asignaturas[0].horas_independientes, 2)
    assertEquals(result.asignaturas[0].instalacion, 'LABORATORIO')
    assertGreater(result.hojas[0].formulas, 0)
    assertEquals('creditos' in result.asignaturas[0], false)
  },
)

Deno.test(
  'distingue optativas y conserva incidencias de campos ausentes',
  async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Oferta flexible')
    sheet.addRow([
      'Clave',
      'Unidad de aprendizaje',
      'Semestre',
      'Carácter',
      'Horas académicas',
    ])
    sheet.addRow(['', 'Seminario electivo', 5, 'Optativa', ''])

    const buffer = await workbook.xlsx.writeBuffer()
    const result = await leerMapaCurricularXlsx(new Uint8Array(buffer))

    assertEquals(result.asignaturas[0].tipo, 'OPTATIVA')
    assertEquals(result.incidencias.map((issue) => issue.codigo).sort(), [
      'ASIGNATURA_SIN_CLAVE',
      'ASIGNATURA_SIN_HORAS',
    ])
  },
)

Deno.test('lee el formato rígido con dos asignaturas por ciclo', async () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('RÍGIDO-Anexo 2 (A)')
  sheet.getCell('A1').value = 'CICLO'
  sheet.getCell('A2').value = 'Primer Semestre'
  sheet.getCell('C2').value = 'MAT101'
  sheet.getCell('G2').value = 'OBLIGATORIA'
  sheet.getCell('I2').value = 'PRO101'
  sheet.getCell('M2').value = 'OPTATIVA'
  sheet.getCell('C3').value = 'Matemáticas'
  sheet.getCell('I3').value = 'Programación'
  sheet.getCell('C6').value = 64
  sheet.getCell('E6').value = 32
  sheet.getCell('G6').value = 'Aula'
  sheet.getCell('I6').value = 48
  sheet.getCell('K6').value = 48
  sheet.getCell('M6').value = 'Laboratorio'

  const buffer = await workbook.xlsx.writeBuffer()
  const result = await leerMapaCurricularXlsx(new Uint8Array(buffer))

  assertEquals(result.asignaturas.length, 2)
  assertEquals(result.asignaturas[0].numero_ciclo, 1)
  assertEquals(result.asignaturas[1].instalacion, 'LABORATORIO')
})

Deno.test('combina programa con mapa conservando la identidad del mapa', () => {
  const combined = combinarAsignaturas(
    [{ id_externo: 'mapa:1', codigo: 'A-1', nombre: 'Ética', numero_ciclo: 2 }],
    [
      {
        id_externo: 'programa:9',
        codigo: 'A-1',
        nombre: 'Etica',
        datos: { descripcion: 'Contenido' },
      },
    ],
  )
  assertEquals(combined, [
    {
      id_externo: 'mapa:1',
      codigo: 'A-1',
      nombre: 'Etica',
      numero_ciclo: 2,
      datos: { descripcion: 'Contenido' },
    },
  ])
})

Deno.test(
  'no permite que un ciclo cero del programa sobrescriba el del mapa',
  () => {
    const combined = combinarAsignaturas(
      [
        {
          id_externo: 'mapa:1',
          codigo: 'A-1',
          nombre: 'Ética',
          numero_ciclo: 2,
        },
      ],
      [
        {
          id_externo: 'programa:9',
          codigo: 'A-1',
          nombre: 'Etica',
          numero_ciclo: 0,
        },
      ],
    )

    assertEquals(combined[0].numero_ciclo, 2)
  },
)

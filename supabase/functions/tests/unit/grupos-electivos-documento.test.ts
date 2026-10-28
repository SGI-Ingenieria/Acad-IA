import { filasCurricularesConElectivas } from '../../_shared/grupos-electivos-documento.ts'
import type { Tables } from '../../_shared/database.types.ts'

Deno.test(
  'exportación: una fila por bloque, todas las alternativas y carga única',
  () => {
    const grupo: Tables<'grupos_electivos_plan'> = {
      id: 'I',
      plan_estudio_id: 'p',
      nombre: 'Electiva I',
      numero_ciclo: 4,
      linea_plan_id: 'l',
      orden: 0,
      prerrequisito_grupo_id: null,
      revision: 1,
      creado_por: null,
      actualizado_en: '',
    }
    const fila = {
      id: 'a',
      codigo: 'A',
      nombre: 'Alternativa A',
      tipo: 'OBLIGATORIA' as const,
      datos: {},
      numero_ciclo: 4,
      linea_plan_id: 'l',
      creditos: 3,
      horas_academicas: 48,
      horas_independientes: 0,
      prerrequisito_asignatura_id: null,
      grupo_electivo_id: 'I',
      linea: { nombre: 'Línea' },
    }
    const resultado = filasCurricularesConElectivas(
      [fila, { ...fila, id: 'b', codigo: 'B', nombre: 'Alternativa B' }],
      [grupo],
      [{ id: 'l', nombre: 'Línea' }],
    )
    if (
      resultado.length !== 1 ||
      resultado[0].creditos !== 3 ||
      !resultado[0].nombre.includes('Alternativa A') ||
      !resultado[0].nombre.includes('Alternativa B')
    )
      throw new Error('Composición o carga incorrecta')
    const vacio = filasCurricularesConElectivas(
      [],
      [grupo],
      [{ id: 'l', nombre: 'Línea' }],
    )
    if (
      vacio.length !== 1 ||
      vacio[0].creditos !== 0 ||
      !vacio[0].nombre.includes('Pendiente')
    )
      throw new Error('Bloque vacío omitido')
  },
)

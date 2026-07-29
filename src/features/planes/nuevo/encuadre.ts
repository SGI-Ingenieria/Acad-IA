import type { NuevoPlanFormValues } from './types'
import type {
  AnalizarEncuadrePlanInput,
  ContextoEncuadrePlan,
  PreguntaEncuadre,
} from '@/data/api/aiBrief.api'

/**
 * Construcción de la petición de encuadre curricular y su firma.
 *
 * La firma existe para no regenerar el encuadre al volver atrás en el wizard:
 * mientras la intención curricular no cambie, el análisis ya pagado sigue
 * siendo válido. Se calcula sobre lo que realmente condiciona el resultado.
 */

/** Catálogos resueltos fuera del form (viven en TanStack Query). */
export type CatalogosEncuadre = {
  nivelCarrera?: string | null
  estructuraNombre?: string | null
}

/**
 * Datos ya decididos por el usuario. Se envían como restricciones duras para
 * que el modelo no vuelva a preguntarlos.
 */
export function contextoEncuadre(
  values: NuevoPlanFormValues,
  { nivelCarrera, estructuraNombre }: CatalogosEncuadre = {},
): ContextoEncuadrePlan {
  const instrucciones = values.iaConfig.instruccionesAdicionalesIA.trim()

  return {
    carrera: values.datosBasicos.carrera.nombre,
    nivel: nivelCarrera || null,
    facultad: values.datosBasicos.facultad.nombre || null,
    tipoCiclo: values.datosBasicos.tipoCiclo || null,
    numCiclos: values.datosBasicos.numCiclos,
    semanasPorCiclo: values.datosBasicos.semanasPorCiclo,
    tipoEstructura: values.datosBasicos.tipoEstructura,
    estructura: estructuraNombre || null,
    fechaInicioImparticion: values.datosBasicos.fechaInicioImparticion,
    instruccionesAdicionales: instrucciones || null,
  }
}

/**
 * Petición completa de una ronda de encuadre.
 *
 * El `alcance` de generación queda deliberadamente fuera: decide qué artefactos
 * produce la generación posterior (asignaturas, bibliografía…), no la intención
 * curricular que se está aclarando, y cambiarlo obligaría a re-analizar sin
 * motivo.
 */
export function entradaEncuadre(
  values: NuevoPlanFormValues,
  catalogos: CatalogosEncuadre,
  ronda: number,
  respuestas: Record<string, string>,
): AnalizarEncuadrePlanInput {
  return {
    borradorId: values.iaBrief.borradorId,
    ronda,
    contexto: contextoEncuadre(values, catalogos),
    solicitud: values.iaConfig.descripcionEnfoqueAcademico,
    respuestas,
    webSearchEnabled: values.iaConfig.webSearchEnabled,
    reasoningEffort: values.iaConfig.reasoningEffort,
    references: {
      fileIds: values.iaConfig.archivosReferencia,
      collectionIds: values.iaConfig.coleccionesReferencia,
    },
  }
}

/**
 * Huella estable de las entradas del encuadre. Un cambio en cualquiera de
 * ellas invalida el análisis; volver atrás sin tocar nada, no.
 *
 * Se hashea (FNV-1a de 32 bits) en vez de guardar el JSON completo porque la
 * firma viaja en el borrador que se persiste al cancelar una generación.
 */
export function firmaEncuadre(entrada: AnalizarEncuadrePlanInput): string {
  const canonico = JSON.stringify([
    entrada.solicitud.trim(),
    entrada.contexto,
    entrada.webSearchEnabled,
    entrada.reasoningEffort,
    [...entrada.references.fileIds].sort(),
    [...entrada.references.collectionIds].sort(),
  ])

  let hash = 0x811c9dc5
  for (let i = 0; i < canonico.length; i += 1) {
    hash ^= canonico.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * El encuadre guardado sigue siendo utilizable: mismas entradas y un análisis
 * ya realizado. Evita cobrarle al usuario otra ronda de IA por volver atrás.
 */
export function encuadreVigente(
  values: NuevoPlanFormValues,
  firmaActual: string,
): boolean {
  return (
    values.iaBrief.estado !== 'SIN_ANALIZAR' &&
    values.iaBrief.firma === firmaActual
  )
}

/**
 * Rehidrata las preguntas de un borrador persistido. Los borradores anteriores
 * guardaban `opciones` como cadenas; se descartan en vez de romper el render.
 */
export function normalizarPreguntas(valor: unknown): Array<PreguntaEncuadre> {
  if (!Array.isArray(valor)) return []

  return valor.flatMap((item): Array<PreguntaEncuadre> => {
    if (typeof item !== 'object' || item === null) return []
    const registro = item as Record<string, unknown>
    if (typeof registro.id !== 'string' || !registro.id) return []
    if (typeof registro.pregunta !== 'string' || !registro.pregunta) return []

    const opciones = Array.isArray(registro.opciones)
      ? registro.opciones.flatMap((opcion) => {
          if (typeof opcion !== 'object' || opcion === null) return []
          const { etiqueta, implicacion } = opcion as Record<string, unknown>
          if (typeof etiqueta !== 'string' || !etiqueta) return []
          return [
            {
              etiqueta,
              implicacion: typeof implicacion === 'string' ? implicacion : '',
            },
          ]
        })
      : []

    return [
      {
        id: registro.id,
        pregunta: registro.pregunta,
        porQue: typeof registro.porQue === 'string' ? registro.porQue : '',
        opciones,
      },
    ]
  })
}

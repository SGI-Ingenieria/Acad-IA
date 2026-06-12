import { definicionesDeEstructurasDeColumnas } from '../../_shared/estructuras.ts'
import { HttpError } from './errors.ts'
export function pickSchemaFields(definicion: any, campos: string[]) {
  if (!definicion || definicion.type !== 'object' || !definicion.properties) {
    return definicion
  }

  const extra = {
    properties: {
      'ai-message': {
        type: 'string',
        description:
          'Mensaje breve para el usuario final confirmando qué se mejoró y qué se hizo.',
        examples: [
          'Listo: mejoré la redacción del perfil de ingreso y propuse un tema de investigación alineado al plan.',
        ],
      },
      'is-refusal': {
        type: 'boolean',
        description:
          'Indica si el plan fue rechazado por el modelo. En caso de ser true, se espera un mensaje de rechazo en `ai-message`.',
      },
    },
  }

  const out = structuredClone(definicion)

  // Si piden campos, filtramos propiedades/required a esos campos
  const entries = Object.entries(out.properties).filter(([k]) =>
    campos.includes(k),
  )
  out.properties = Object.fromEntries(entries)
  if (Array.isArray(out.required)) {
    out.required = out.required.filter((k: string) => campos.includes(k))
  }

  // Siempre agregamos ai-message
  out.properties = { ...out.properties, ...extra.properties }
  out.required = Array.isArray(out.required)
    ? [...new Set([...out.required, ...Object.keys(extra.properties)])]
    : Object.keys(extra.properties)

  return out
}

export function pickSchemaAsignaturaFields(definicion: any, campos: string[]) {
  if (!definicion || definicion.type !== 'object' || !definicion.properties) {
    return definicion
  }

  const extra = {
    properties: {
      'ai-message': {
        type: 'string',
        description:
          'Tu respuesta conversacional dirigida al profesor explicando qué mejoraste.',
      },
      is_refusal: {
        type: 'boolean',
        description: 'Indica si la solicitud es inapropiada.',
      },
    },
  }

  const out = structuredClone(definicion)
  const finalProperties: Record<string, any> = {}
  const finalRequired: string[] = []

  campos.forEach((key) => {
    // REVISIÓN DE ESTRUCTURA ESPECIAL
    if (key in definicionesDeEstructurasDeColumnas) {
      // Extraemos solo el esquema del array que vive en 'x-definicion'
      // Esto hace que la IA reciba el esquema del array directamente
      const especial = (definicionesDeEstructurasDeColumnas as any)[key]

      finalProperties[key] = especial.properties['x-definicion']
      finalRequired.push(key)
    }
    // CAMPOS NORMALES (los que están en 'datos')
    else if (out.properties[key]) {
      finalProperties[key] = out.properties[key]
      if (out.required?.includes(key)) {
        finalRequired.push(key)
      }
    }
  })

  out.properties = { ...finalProperties, ...extra.properties }
  out.required = [
    ...new Set([...finalRequired, ...Object.keys(extra.properties)]),
  ]
  out.additionalProperties = false

  return out
}

export function safePlanForPrompt(plan: any) {
  const copy = structuredClone(plan)
  if (copy?.estructuras_plan) delete copy.estructuras_plan
  return copy
}

export function assertUuid(v: string, name: string) {
  // validación ligera
  if (!v || typeof v !== 'string' || v.length < 10) {
    throw new HttpError(400, 'bad_input', `Invalid ${name}`)
  }
}

export function safeAsignaturaForPrompt(asignatura: any) {
  const copy = structuredClone(asignatura)
  // Eliminamos la definición de la estructura para que no ensucie el prompt
  // y solo queden los datos reales de la asignatura
  if (copy?.estructuras_asignatura) delete copy.estructuras_asignatura
  return copy
}

export function getAsignaturaSystemPrompt(asignatura: any, campos: string[]) {
  const asignaturaLimpia = safeAsignaturaForPrompt(asignatura)
  const nombreAsig = asignaturaLimpia?.nombre || 'la asignatura'

  if (campos.length === 0) {
    return `Eres un asistente experto en diseño curricular. 
    Tu objetivo es ayudar al profesor a mejorar su asignatura: "${nombreAsig}".
    DATOS ACTUALES: ${JSON.stringify(asignaturaLimpia)}.
    
    COMPORTAMIENTO:
    - El usuario aún no ha seleccionado campos específicos para mejorar.
    - NO propongas cambios técnicos detallados ni rellenes campos del JSON todavía.
    - Saluda cordialmente y menciona qué partes de esta asignatura puedes ayudar a mejorar (objetivos, contenidos, criterios, etc.).
    - Mantén una conversación fluida y espera a que el usuario elija qué quiere trabajar.`
  }

  return `Eres un asistente experto en diseño curricular trabajando sobre: "${nombreAsig}".
  DATOS ACTUALES: ${JSON.stringify(asignaturaLimpia)}.
  
  TAREA CRÍTICA:
  El usuario ha solicitado mejorar estos ${campos.length} campos: ${campos.join(', ')}.
  
  REGLAS DE ORO:
  1. Debes proporcionar una propuesta de mejora para CADA UNO de los campos solicitados.
  2. No omitas ninguno. Si un campo no requiere cambios drásticos, optimiza su redacción técnica.
  3. En el JSON, cada campo debe contener tu propuesta de texto mejorado.
  4. En 'ai-message', resume los cambios hechos en cada uno de los campos solicitados.`
}

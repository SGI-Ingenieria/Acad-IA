import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

/**
 * Contrato de entrada del modo agente. Es el espejo de `src/data/api/agente.api.ts`:
 * una sola Edge Function atiende las acciones porque todas comparten el
 * mismo sobre —autenticación, autorización de IA, envoltura de rechazo y
 * registro de la interacción— y sólo varía la carga útil. El discriminante
 * `accion` elige a la vez el contrato de entrada de este archivo y el JSON
 * Schema de salida de `acciones.ts`.
 *
 * Si este archivo y `agente.api.ts` se desincronizan, el fallo aparece como un
 * 422 con la ruta exacta del campo, no como una respuesta silenciosamente mala.
 */

const UUID = z.string().uuid()

const AmbitoSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('plan'), planId: UUID }).strict(),
  z
    .object({
      tipo: z.literal('asignatura'),
      asignaturaId: UUID,
      planId: UUID,
    })
    .strict(),
])

export type Ambito = z.infer<typeof AmbitoSchema>

// ---------------------------------------------------------------- mejorar_campo

const MejorarCampoSchema = z
  .object({
    entidad: z.enum(['plan', 'asignatura']),
    entidad_id: UUID,
    clave: z.string().trim().min(1),
    label: z.string().trim().min(1),
    ayuda: z.string().optional(),
    contenido_actual: z.string().default(''),
    es_richtext: z.boolean().default(false),
    campo_schema: z.record(z.unknown()).nullable().optional(),
    opciones: z.array(z.string()).max(60).optional(),
    minimo: z.number().nullable().optional(),
    maximo: z.number().nullable().optional(),
  })
  .strict()

// ------------------------------------------------------------------ mapa

const LineaMapaSchema = z
  .object({
    id: UUID,
    nombre: z.string(),
    orden: z.number().int(),
  })
  .strict()

const AsignaturaMapaSchema = z
  .object({
    id: UUID,
    nombre: z.string(),
    clave: z.string().nullable(),
    creditos: z.number(),
    horas_academicas: z.number(),
    horas_independientes: z.number(),
    tipo: z.string(),
    numero_ciclo: z.number().int().nullable(),
    linea_plan_id: UUID.nullable(),
    prerrequisito_asignatura_id: UUID.nullable(),
  })
  .strict()

/**
 * El mapa entero acompaña a toda acción curricular: decidir dónde va una
 * asignatura sin ver el resto del mapa produciría propuestas incoherentes.
 * El tope de 400 asignaturas evita que un plan corrupto reviente el contexto
 * del modelo con un error opaco.
 */
const contextoMapaShape = {
  lineas: z.array(LineaMapaSchema).max(60),
  asignaturas: z.array(AsignaturaMapaSchema).max(400),
  numero_ciclos: z.number().int().positive().max(30),
  nombre_ciclo: z.string().trim().min(1),
}

const AsignarAsignaturaSchema = z
  .object({ ...contextoMapaShape, asignatura_id: UUID })
  .strict()

const AjustarCreditosHorasSchema = z
  .object({
    asignatura_id: UUID,
    nombre: z.string(),
    horas_academicas: z.number(),
    horas_independientes: z.number(),
    creditos: z.number(),
    horas_por_credito: z.number().positive(),
  })
  .strict()

const ReorganizarMapaSchema = z
  .object({ ...contextoMapaShape, linea_plan_id: UUID.optional() })
  .strict()

const ProponerParaCeldaSchema = z
  .object({
    ...contextoMapaShape,
    linea_plan_id: UUID,
    linea_nombre: z.string(),
    numero_ciclo: z.number().int().positive(),
    candidatas: z.array(AsignaturaMapaSchema).max(400),
  })
  .strict()

const OrdenarLineasSchema = z
  .object({
    lineas: z.array(LineaMapaSchema).min(1).max(60),
    linea_plan_id: UUID.optional(),
  })
  .strict()

/**
 * Proponer la línea curricular que le falta al plan. Necesita el mapa entero
 * —no sólo la lista de líneas— porque la línea que falta se deduce de las
 * asignaturas que no encajan en ninguna de las que ya existen.
 */
const ProponerLineaSchema = z.object({ ...contextoMapaShape }).strict()

// ------------------------------------------------------- contenido temático

const TemaSchema = z
  .object({
    id: z.string().min(1),
    nombre: z.string(),
    horas_estimadas: z.number(),
  })
  .strict()

const UnidadSchema = z
  .object({
    id: z.string().min(1),
    numero: z.number().int(),
    titulo: z.string(),
    temas: z.array(TemaSchema).max(80),
  })
  .strict()

/**
 * Los identificadores de unidad y tema los genera el cliente (`u-1`, `t-1-0`):
 * el temario se guarda como un JSON completo dentro de la asignatura, así que
 * no son UUID de base de datos.
 */
const contenidoTematicoShape = {
  asignatura_id: UUID,
  asignatura_nombre: z.string(),
  unidades: z.array(UnidadSchema).max(60),
}

const ReubicarUnidadSchema = z
  .object({
    ...contenidoTematicoShape,
    unidad_id: z.string().min(1),
    tema_id: z.string().min(1).optional(),
  })
  .strict()

const NombrarUnidadSchema = z
  .object({ ...contenidoTematicoShape, posicion: z.number().int().positive() })
  .strict()

const NombrarTemaSchema = z
  .object({ ...contenidoTematicoShape, unidad_id: z.string().min(1) })
  .strict()

const ProponerContenidoSchema = z.object(contenidoTematicoShape).strict()

// ------------------------------------------------ evaluación y bibliografía

const ProponerEvaluacionSchema = z
  .object({
    asignatura_id: UUID,
    asignatura_nombre: z.string(),
    criterios: z
      .array(
        z.object({ criterio: z.string(), porcentaje: z.number() }).strict(),
      )
      .max(30),
  })
  .strict()

const ProponerBibliografiaSchema = z
  .object({
    asignatura_id: UUID,
    asignatura_nombre: z.string(),
    formato: z.string().trim().min(1),
    existentes: z
      .array(
        z.object({ titulo: z.string().nullable(), cita: z.string() }).strict(),
      )
      .max(200),
  })
  .strict()

const ProponerPrerrequisitoSchema = z
  .object({
    asignatura_id: UUID,
    asignatura_nombre: z.string(),
    numero_ciclo: z.number().int().nullable(),
    nombre_ciclo: z.string().trim().min(1),
    prerrequisito_actual: UUID.nullable(),
    candidatas: z
      .array(
        z
          .object({
            id: UUID,
            nombre: z.string(),
            clave: z.string().nullable(),
            numero_ciclo: z.number().int().nullable(),
            misma_linea: z.boolean(),
          })
          .strict(),
      )
      .max(400),
  })
  .strict()

// ------------------------------------------------------------------- sobre

/**
 * `contexto` son las pocas palabras que el usuario puede escribir en el dock, y
 * es **opcional**: el modo agente tiene que poder usarse señalando elementos sin
 * escribir nada. Cuando falta, el prompt lo dice explícitamente y el modelo
 * aplica el criterio académico general en vez de inventarse una intención (ver
 * `construirPeticion` en `acciones.ts`).
 */
function sobre<TAccion extends string, TPayload extends z.ZodTypeAny>(
  accion: TAccion,
  payload: TPayload,
) {
  return z
    .object({
      accion: z.literal(accion),
      ambito: AmbitoSchema,
      contexto: z.string().trim().max(240).optional().default(''),
      sesion_id: UUID,
      payload,
      reasoning_effort: z
        .enum(['auto', 'none', 'low', 'medium', 'high'])
        .optional()
        .default('none'),
    })
    .strict()
}

export const AgenteAccionRequestSchema = z.discriminatedUnion('accion', [
  sobre('mejorar_campo', MejorarCampoSchema),
  sobre('asignar_asignatura', AsignarAsignaturaSchema),
  sobre('ajustar_creditos_horas', AjustarCreditosHorasSchema),
  sobre('reorganizar_mapa', ReorganizarMapaSchema),
  sobre('proponer_para_celda', ProponerParaCeldaSchema),
  sobre('ordenar_lineas', OrdenarLineasSchema),
  sobre('proponer_linea', ProponerLineaSchema),
  sobre('reubicar_unidad', ReubicarUnidadSchema),
  sobre('nombrar_unidad', NombrarUnidadSchema),
  sobre('nombrar_tema', NombrarTemaSchema),
  sobre('proponer_contenido', ProponerContenidoSchema),
  sobre('proponer_evaluacion', ProponerEvaluacionSchema),
  sobre('proponer_bibliografia', ProponerBibliografiaSchema),
  sobre('proponer_prerrequisito', ProponerPrerrequisitoSchema),
])

export type AgenteAccionRequest = z.infer<typeof AgenteAccionRequestSchema>
export type AgenteAccionTipo = AgenteAccionRequest['accion']

/**
 * Comprueba que la carga útil no apunte fuera del ámbito que se acaba de
 * autorizar. Importa porque la autorización de IA se resuelve contra el ámbito
 * (`usuario_puede_usar_ia_plan` / `usuario_puede_usar_ia_asignatura`) mientras
 * que el temario de `proponer_evaluacion` y `proponer_bibliografia` se lee de la
 * base con la clave de servicio: sin este cruce, un `asignatura_id` ajeno en la
 * carga útil convertiría un permiso legítimo en una lectura de otra asignatura.
 *
 * Devuelve `{ ok: true }` cuando todo cuadra, el motivo del rechazo en español,
 * o —cuando la comprobación necesita la base— la orden de resolverla.
 */
export type ResultadoAmbito =
  | { ok: true }
  | { ok: false; motivo: string }
  /**
   * El ámbito autorizado es un plan y la carga útil apunta a una asignatura.
   * Es legítimo: desde el mapa curricular se ajustan el nombre y el tipo de una
   * asignatura sin salir del plan. Pero no se puede decidir aquí, porque hace
   * falta leer `asignaturas.plan_estudio_id`. El tipo obliga al llamador a
   * resolverlo contra la base en vez de dejar que se le olvide.
   */
  | {
      ok: 'comprobar-asignatura-del-plan'
      asignaturaId: string
      planId: string
    }

export function verificarAmbito(req: AgenteAccionRequest): ResultadoAmbito {
  const { ambito } = req
  const fuera = (motivo: string) => ({ ok: false, motivo }) as const

  switch (req.accion) {
    case 'mejorar_campo': {
      if (req.payload.entidad === 'plan') {
        return ambito.tipo === 'plan' &&
          ambito.planId === req.payload.entidad_id
          ? { ok: true }
          : fuera('El campo no pertenece al ámbito del modo agente.')
      }

      if (ambito.tipo === 'asignatura') {
        return ambito.asignaturaId === req.payload.entidad_id
          ? { ok: true }
          : fuera('El campo no pertenece al ámbito del modo agente.')
      }

      return {
        ok: 'comprobar-asignatura-del-plan',
        asignaturaId: req.payload.entidad_id,
        planId: ambito.planId,
      }
    }

    // El sujeto es el plan completo: la carga útil sólo trae contexto del mapa,
    // y lo que se proponga se aplicará después bajo las políticas de la base.
    case 'asignar_asignatura':
    case 'ajustar_creditos_horas':
    case 'reorganizar_mapa':
    case 'proponer_para_celda':
    case 'ordenar_lineas':
    case 'proponer_linea':
      return ambito.tipo === 'plan'
        ? { ok: true }
        : fuera('Esta acción solo puede ejecutarse desde el mapa de un plan.')

    case 'reubicar_unidad':
    case 'nombrar_unidad':
    case 'nombrar_tema':
    case 'proponer_contenido':
    case 'proponer_evaluacion':
    case 'proponer_bibliografia':
      if (ambito.tipo !== 'asignatura') {
        return fuera('Esta acción solo puede ejecutarse desde una asignatura.')
      }
      return ambito.asignaturaId === req.payload.asignatura_id
        ? { ok: true }
        : fuera('La asignatura no pertenece al ámbito del modo agente.')

    // La seriación se propone desde los dos sitios donde se edita: el detalle
    // de la asignatura y el editor del mapa curricular, cuyo ámbito es el
    // plan. Con ámbito de plan hay que confirmar contra la base que la
    // asignatura sea de ese plan, igual que en `mejorar_campo`.
    case 'proponer_prerrequisito':
      if (ambito.tipo === 'asignatura') {
        return ambito.asignaturaId === req.payload.asignatura_id
          ? { ok: true }
          : fuera('La asignatura no pertenece al ámbito del modo agente.')
      }
      return {
        ok: 'comprobar-asignatura-del-plan',
        asignaturaId: req.payload.asignatura_id,
        planId: ambito.planId,
      }
  }
}

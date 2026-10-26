import { z } from 'zod'

export const PLAN_AREA_COMUN_ID = 'ac000000-0000-4000-8000-000000000003'

export const espacioAreaComunSchema = z
  .object({
    clave: z.string().trim().min(1),
    numero_ciclo: z.number().int().positive(),
    orden: z.number().int().nonnegative().optional(),
    nombre: z.string().optional(),
    asignatura_id: z.uuid().optional(),
    opciones: z.array(z.uuid()).min(1).optional(),
  })
  .refine((e) => Boolean(e.asignatura_id) !== Boolean(e.opciones), {
    message: 'Elige una materia fija o un catálogo de electivas.',
  })

export const distribucionAreaComunSchema = z
  .object({
    clave: z.string().trim().min(1),
    tipo_ciclo: z.enum(['Semestre', 'Cuatrimestre', 'Trimestre', 'Otro']),
    numero_ciclos: z.number().int().positive(),
    carrera_id: z.uuid().nullable().optional(),
    nota: z.string().optional(),
    espacios: z.array(espacioAreaComunSchema).min(1),
  })
  .refine((d) => d.espacios.every((e) => e.numero_ciclo <= d.numero_ciclos), {
    message: 'Hay materias fuera de la duración de la distribución.',
  })

export const configuracionAreaComunSchema = z
  .array(distribucionAreaComunSchema)
  .min(1)
  .superRefine((ds, ctx) => {
    const claves = new Set<string>()
    const destinos = new Set<string>()
    for (const d of ds) {
      const destino = `${d.tipo_ciclo}:${d.numero_ciclos}:${d.carrera_id ?? ''}`
      if (claves.has(d.clave) || destinos.has(destino)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Hay distribuciones duplicadas.',
        })
      }
      claves.add(d.clave)
      destinos.add(destino)
      const espacios = new Set<string>()
      const materias = new Set<string>()
      for (const e of d.espacios) {
        if (espacios.has(e.clave))
          ctx.addIssue({ code: 'custom', message: 'Hay espacios duplicados.' })
        espacios.add(e.clave)
        for (const id of e.opciones ?? [e.asignatura_id!]) {
          if (materias.has(id))
            ctx.addIssue({
              code: 'custom',
              message: 'Una materia aparece en varios espacios.',
            })
          materias.add(id)
        }
      }
    }
  })

const materiaPublicadaSchema = z.object({
  id: z.uuid(),
  nombre: z.string(),
  codigo: z.string().nullable(),
  horas_academicas: z.number().nullable(),
  horas_independientes: z.number().nullable(),
  creditos: z.number().nullable(),
})

export const contextoAreaComunSchema = z.object({
  plan_area_id: z.uuid(),
  revision: z.number().int(),
  publicacion_id: z.uuid().nullable(),
  numero_publicacion: z.number().nullable(),
  contenido: z
    .object({
      plan_id: z.uuid(),
      distribuciones: z.array(distribucionAreaComunSchema),
      asignaturas: z.array(materiaPublicadaSchema),
    })
    .nullable(),
  distribucion: distribucionAreaComunSchema.nullable(),
  incorporacion: z
    .object({
      id: z.uuid(),
      linea_id: z.uuid(),
      publicacion_id: z.uuid(),
      electivas: z.record(z.string(), z.uuid()),
    })
    .nullable(),
  borrador: z.array(distribucionAreaComunSchema).nullable(),
  planes_usuarios: z.array(z.object({ id: z.uuid(), nombre: z.string() })),
})

export type EspacioAreaComun = z.infer<typeof espacioAreaComunSchema>
export type DistribucionAreaComun = z.infer<typeof distribucionAreaComunSchema>
export type ContextoAreaComun = z.infer<typeof contextoAreaComunSchema>

/**
 * Esquemas de valor de las columnas "siempre incluidas" de una asignatura.
 *
 * Reemplazan al antiguo mecanismo `x-column`: la llave de la columna mapea
 * directamente a su esquema de valor (sin envoltura `x-column` / `x-definicion`).
 * Se usan cuando la IA debe generar/mejorar una de estas columnas.
 */
export const ESQUEMAS_COLUMNAS_ASIGNATURA = {
  contenido_tematico: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        unidad: {
          type: 'integer',
        },
        titulo: {
          type: 'string',
        },
        temas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              nombre: {
                type: 'string',
              },
              horasEstimadas: {
                type: 'integer',
                description:
                  'Horas del tema. La suma de todas las horasEstimadas debe ser igual a las horas académicas del prompt.',
              },
            },
            required: ['nombre', 'horasEstimadas'],
            additionalProperties: false,
          },
        },
      },
      required: ['unidad', 'titulo', 'temas'],
      additionalProperties: false,
    },
  },
  criterios_de_evaluacion: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        criterio: {
          type: 'string',
        },
        porcentaje: {
          type: 'integer',
        },
      },
      required: ['criterio', 'porcentaje'],
      additionalProperties: false,
    },
  },
  codigo: {
    type: 'string',
  },
} as const

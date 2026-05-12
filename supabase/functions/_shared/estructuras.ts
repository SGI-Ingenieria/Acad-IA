export const definicionesDeEstructurasDeColumnas = {
  contenido_tematico: {
    type: 'object',
    properties: {
      'x-column': {
        type: 'string',
        enum: ['contenido_tematico'],
      },
      'x-definicion': {
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
    },
    required: ['x-column', 'x-definicion'],
    additionalProperties: false,
  },
  criterios_de_evaluacion: {
    type: 'object',
    properties: {
      'x-column': {
        type: 'string',
        enum: ['criterios_de_evaluacion'],
      },
      'x-definicion': {
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
    },
    required: ['x-column', 'x-definicion'],
    additionalProperties: false,
  },
  clave_de_la_asignatura: {
    type: 'object',
    properties: {
      'x-column': {
        type: 'string',
        enum: ['codigo'],
      },
      'x-definicion': {
        type: 'string',
      },
    },
    required: ['x-column', 'x-definicion'],
    additionalProperties: false,
  },
} as const

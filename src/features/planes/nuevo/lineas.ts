import type { TipoCiclo } from '@/data/types/domain'

export type PlanLineaProposal = {
  id: string
  nombre: string
  area?: string
  orden: number
  selected: boolean
  color?: string | null
}

export type PlanLineasProposalInput = {
  nombrePlan: string
  carreraNombre: string
  nivel: string
  tipoCiclo: TipoCiclo | ''
  numCiclos: number | null
}

export function buildLineasPropuesta(
  input: PlanLineasProposalInput,
): Array<PlanLineaProposal> {
  const { carreraNombre, nivel, tipoCiclo, numCiclos } = input
  const isIngenieria = /ingenier[ií]a/i.test(carreraNombre)

  const propuestas: Array<PlanLineaProposal> = [
    {
      id: 'linea-1',
      nombre: isIngenieria ? 'Formación Básica en Ingeniería' : 'Formación Básica',
      area: isIngenieria
        ? 'Ciencias básicas y fundamentos disciplinarios'
        : 'Fundamentos generales y formativos',
      orden: 1,
      selected: true,
      color: null,
    },
    {
      id: 'linea-2',
      nombre: isIngenieria
        ? 'Formación Disciplinaria y Profesional'
        : 'Formación Disciplinaria',
      area: isIngenieria
        ? 'Asignaturas centrales del perfil profesional'
        : 'Asignaturas clave de la disciplina',
      orden: 2,
      selected: true,
      color: null,
    },
    {
      id: 'linea-3',
      nombre: 'Formación Integral',
      area: 'Competencias transversales, éticas y de integración profesional',
      orden: 3,
      selected: true,
      color: null,
    },
  ]

  if (tipoCiclo === 'Cuatrimestre' || tipoCiclo === 'Trimestre') {
    propuestas.push({
      id: 'linea-4',
      nombre: 'Materias Optativas',
      area: 'Flexibilidad curricular para intereses específicos',
      orden: 4,
      selected: true,
      color: null,
    })
  }

  if (!numCiclos || numCiclos <= 4) {
    propuestas.push({
      id: 'linea-5',
      nombre: 'Proyecto Aplicado',
      area: 'Integración de conocimientos en un trabajo final breve',
      orden: 5,
      selected: true,
      color: null,
    })
  }

  return propuestas
}

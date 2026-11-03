import { describe, expect, test } from 'bun:test'

import {
  aristasSeriacionGrupos,
  esAlternativaElectiva,
  espaciosSeriacionAreaComun,
} from './area-comun-seriacion'

import type { ContextoAreaComun } from '@/data/types/areaComun'

const espacios = [
  { clave: 'fija', numero_ciclo: 1, asignatura_id: 'fija' },
  { clave: 'I', numero_ciclo: 6, opciones: ['a', 'b'] },
  {
    clave: 'II',
    numero_ciclo: 8,
    opciones: ['c', 'd'],
    prerrequisito_grupo_clave: 'I',
  },
]
const contexto: ContextoAreaComun = {
  plan_area_id: 'plan',
  revision: 1,
  publicacion_id: null,
  numero_publicacion: null,
  contenido: null,
  incorporacion: null,
  planes_usuarios: [],
  borrador: [
    { clave: 'general', tipo_ciclo: 'Semestre', numero_ciclos: 8, espacios },
  ],
  distribucion: null,
}
describe('alternativas y contexto de seriación', () => {
  test('excluye todas las alternativas y reconoce identidades proyectadas', () => {
    expect(esAlternativaElectiva(espacios, 'a')).toBe(true)
    expect(esAlternativaElectiva(espacios, 'proyectada', 'b')).toBe(true)
    expect(esAlternativaElectiva(espacios, 'fija')).toBe(false)
  })
  test('catálogo usa borrador; receptor usa distribución publicada con todas las opciones', () => {
    expect(espaciosSeriacionAreaComun(contexto)).toEqual(espacios)
    expect(
      espaciosSeriacionAreaComun({
        ...contexto,
        borrador: null,
        distribucion: contexto.borrador![0],
      }),
    ).toEqual(espacios)
    expect(espaciosSeriacionAreaComun(undefined)).toEqual([])
  })
})

test('I hacia II produce una sola arista entre grupos y ninguna entre alternativas', () => {
  expect(aristasSeriacionGrupos(espacios)).toEqual([
    { source: 'grupo-I', target: 'grupo-II' },
  ])
  expect(
    aristasSeriacionGrupos([
      { clave: 'fija', numero_ciclo: 1, asignatura_id: 'a' },
    ]),
  ).toEqual([])
})

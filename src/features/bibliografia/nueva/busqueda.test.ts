import { describe, expect, test } from 'bun:test'

import {
  computeRefsParaDetalle,
  conCamposFaltantes,
  getBibliotecaInstitutionalHref,
} from './lib'
import {
  BIBLIOGRAPHY_SEARCH_DEBOUNCE_MS,
  construirBusquedaEnLinea,
  construirBusquedaInstitucional,
} from './pasos/BusquedaReferenciasStep'
import {
  puedeContinuarDesdePaso2,
  valoresInicialesNuevaBibliografia,
} from './schema'

import type { BibliografiaRef, IASugerencia } from './types'

import { qk } from '@/data/query/keys'

describe('búsqueda reactiva de bibliografía', () => {
  test('inicia en APA y conserva como editables solo los datos ausentes', () => {
    const values = valoresInicialesNuevaBibliografia()
    const ref = conCamposFaltantes({
      id: 'google:completo-parcial',
      title: 'Diseño curricular',
      authors: ['María Pérez'],
      publisher: 'Editorial Académica',
      tipo: 'BASICA',
    })

    expect(values.formato).toBe('apa')
    expect(ref.camposFaltantes).toEqual(['year', 'isbn'])
  })

  test('espera 350 ms y no construye consultas con menos de tres caracteres', () => {
    expect(BIBLIOGRAPHY_SEARCH_DEBOUNCE_MS).toBe(350)
    expect(construirBusquedaEnLinea(' IA ', 'ES')).toBeNull()
    expect(construirBusquedaInstitucional('ab')).toBeNull()
  })

  test('normaliza los parámetros de idioma e ISBN por fuente', () => {
    expect(construirBusquedaEnLinea('  diseño curricular  ', 'ES')).toEqual({
      searchTerms: { q: 'diseño curricular' },
      google: { orderBy: 'newest', startIndex: 0, langRestrict: 'es' },
      openLibrary: { sort: 'new', page: 1, language: 'spa' },
    })
    expect(construirBusquedaInstitucional('978-84-376-0494-7')).toEqual({
      titulo: '978-84-376-0494-7',
      isbn: '9788437604947',
    })
  })

  test('construye la ficha de Koha a partir del identificador institucional', () => {
    expect(getBibliotecaInstitutionalHref('133034')).toBe(
      'https://catalogo.biblioteca.lasalle.mx/cgi-bin/koha/opac-detail.pl?biblionumber=133034',
    )
    expect(getBibliotecaInstitutionalHref('LASALLE-2201')).toBeUndefined()
    expect(getBibliotecaInstitutionalHref(null)).toBeUndefined()
  })

  test('aísla en caché cada término, idioma y fuente', () => {
    const espanol = construirBusquedaEnLinea('currículo', 'ES')
    const ingles = construirBusquedaEnLinea('currículo', 'EN')
    const institucional = construirBusquedaInstitucional('currículo')

    expect(qk.busquedaBibliografiaEnLinea(espanol)).not.toEqual(
      qk.busquedaBibliografiaEnLinea(ingles),
    )
    expect(qk.busquedaBibliografiaEnLinea(espanol)).not.toEqual(
      qk.busquedaBibliografiaInstitucional(institucional),
    )
  })

  test('combina selecciones externas e institucionales sin depender de la fuente visible', () => {
    const values = valoresInicialesNuevaBibliografia()
    values.metodo = 'BUSCAR'
    values.ia.sugerencias = [
      {
        id: 'google:1',
        selected: true,
        endpoint: 'google',
        item: {
          id: '1',
          volumeInfo: { title: 'Diseño curricular' },
        },
        tipo: 'COMPLEMENTARIA',
      } satisfies IASugerencia,
    ]
    values.biblioteca.refs = [
      {
        id: 'biblio-1',
        title: 'Planeación académica',
        authors: [],
        camposFaltantes: ['authors', 'publisher', 'year', 'isbn'],
        tipo: 'BASICA',
        referenciaBiblioteca: '1',
      } satisfies BibliografiaRef,
    ]

    const refs = computeRefsParaDetalle(values)

    expect(refs.map((ref) => ref.title)).toEqual([
      'Diseño curricular',
      'Planeación académica',
    ])
    expect(refs.map((ref) => ref.tipo)).toEqual(['COMPLEMENTARIA', 'BASICA'])
    expect(puedeContinuarDesdePaso2(values)).toBe(true)
  })
})

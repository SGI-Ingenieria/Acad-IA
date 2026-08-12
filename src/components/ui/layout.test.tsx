import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { Inline, PageContainer, Stack } from './layout'

describe('gramática de proximidad', () => {
  test('expresa la relación entre elementos con variantes semánticas', () => {
    const html = renderToStaticMarkup(
      <>
        <Stack space="seccion">Contenido</Stack>
        <Inline space="control" wrap>
          Acciones
        </Inline>
      </>,
    )

    expect(html).toContain('data-space="seccion"')
    expect(html).toContain('gap-seccion')
    expect(html).toContain('data-space="control"')
    expect(html).toContain('gap-control')
    expect(html).toContain('flex-wrap')
  })

  test('normaliza ancho, gutters y ritmo vertical de página', () => {
    const html = renderToStaticMarkup(
      <PageContainer as="main" width="reading" spacing="page">
        Página
      </PageContainer>,
    )

    expect(html.startsWith('<main')).toBe(true)
    expect(html).toContain('max-w-3xl')
    expect(html).toContain('px-grupo')
    expect(html).toContain('md:px-seccion')
    expect(html).toContain('lg:px-region')
    expect(html).toContain('py-region')
    expect(html).toContain('lg:py-pagina')
  })
})

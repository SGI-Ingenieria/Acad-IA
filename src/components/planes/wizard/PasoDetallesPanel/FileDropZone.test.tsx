import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { FileDropzone, formatUploadEta } from './FileDropZone'

describe('formatUploadEta', () => {
  test('evita falsa precisión al inicio y redondea minutos de forma conservadora', () => {
    expect(formatUploadEta(null)).toBeNull()
    expect(formatUploadEta(3)).toBe('unos segundos')
    expect(formatUploadEta(24)).toBe('24 s restantes')
    expect(formatUploadEta(61)).toBe('2 min restantes')
  })
})

describe('FileDropzone', () => {
  test('presenta transferencia y procesamiento como etapas distintas con tamaño visible', () => {
    const queryClient = new QueryClient()
    const uploading = new File(['1234567890'], 'plan.pdf', {
      type: 'application/pdf',
    })
    const processing = new File(['contenido'], 'mapa.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <FileDropzone
          persistentFiles={[
            {
              id: 'uploading',
              file: uploading,
              uploadStatus: 'subiendo',
              uploadProgress: 40,
              bytesUploaded: 4,
              estimatedSecondsRemaining: 6,
            },
            {
              id: 'processing',
              file: processing,
              uploadStatus: 'procesando',
              uploadProgress: 100,
              bytesUploaded: processing.size,
            },
          ]}
        />
      </QueryClientProvider>,
    )

    expect(html).toContain('Subiendo · 40%')
    expect(html).toContain('4 B de 10 B')
    expect(html).toContain('6 s restantes')
    expect(html).toContain('Procesando · 9 B')
    expect(html).toContain('role="progressbar"')
  })
})

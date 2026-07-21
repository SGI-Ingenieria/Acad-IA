import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { ChatReferenceUploadAttachments } from './ChatReferenceUploadAttachments'

import type { ChatReferenceUploadItem } from './chatReferenceUploads'

function upload(
  overrides: Partial<ChatReferenceUploadItem> = {},
): ChatReferenceUploadItem {
  const file = new File(['imagen'], 'evidencia.png', { type: 'image/png' })
  return {
    id: 'upload-1',
    fingerprint: 'evidencia.png:6:1:image/png',
    file,
    previewUrl: 'blob:preview-inmediata',
    status: 'uploading',
    progress: 42,
    error: null,
    conversationId: null,
    ...overrides,
  }
}

describe('adjuntos visibles durante la carga', () => {
  test('muestra de inmediato la miniatura y el progreso', () => {
    const html = renderToStaticMarkup(
      <ChatReferenceUploadAttachments
        uploads={[upload()]}
        onRetry={() => {}}
        onRemove={() => {}}
      />,
    )

    expect(html).toContain('blob:preview-inmediata')
    expect(html).toContain('Subiendo 42%')
    expect(html).toContain('animate-spin')
  })

  test('mantiene el archivo fallido con acciones para reintentar o quitar', () => {
    const html = renderToStaticMarkup(
      <ChatReferenceUploadAttachments
        uploads={[upload({ status: 'error', error: 'Sin conexión' })]}
        onRetry={() => {}}
        onRemove={() => {}}
      />,
    )

    expect(html).toContain('No se pudo subir')
    expect(html).toContain('Reintentar la carga de evidencia.png')
    expect(html).toContain('Quitar evidencia.png')
  })
})

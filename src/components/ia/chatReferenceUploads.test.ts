import { describe, expect, test } from 'bun:test'

import {
  chatReferenceFileFingerprint,
  chatReferenceUploadReducer,
  extractClipboardReferenceFiles,
  revokeChatReferencePreviewUrls,
  selectChatReferenceUploadBatch,
} from './chatReferenceUploads'

import type { ChatReferenceUploadItem } from './chatReferenceUploads'

function fixture(name: string, lastModified = 1) {
  return new File([name], name, { type: 'text/plain', lastModified })
}

function pending(file = fixture('plan.pdf')): ChatReferenceUploadItem {
  return {
    id: 'pending-1',
    fingerprint: chatReferenceFileFingerprint(file),
    file,
    previewUrl: null,
    status: 'uploading',
    progress: 0,
    error: null,
    conversationId: null,
  }
}

describe('adjuntos optimistas del chat', () => {
  test('deduplica y respeta un máximo de cinco archivos por ingreso', () => {
    const first = fixture('uno.txt')
    const files = [
      first,
      first,
      fixture('dos.txt'),
      fixture('tres.txt'),
      fixture('cuatro.txt'),
      fixture('cinco.txt'),
      fixture('seis.txt'),
    ]

    const result = selectChatReferenceUploadBatch(files, new Set())

    expect(result.accepted.map((file) => file.name)).toEqual([
      'uno.txt',
      'dos.txt',
      'tres.txt',
      'cuatro.txt',
      'cinco.txt',
    ])
    expect(result.duplicateCount).toBe(1)
    expect(result.overflowCount).toBe(1)
  })

  test('el paste de texto no produce archivos y una imagen sin nombre se normaliza', () => {
    expect(extractClipboardReferenceFiles({ files: [], items: [] })).toEqual([])

    const image = new File(['image'], 'image.png', { type: 'image/png' })
    const [normalized] = extractClipboardReferenceFiles(
      { files: [image] },
      () => new Date('2026-07-21T12:00:00.000Z'),
    )
    expect(normalized.name).toBe('imagen-pegada-2026-07-21T12-00-00-000Z-1.png')
  })

  test('expone progreso, error y reintento sin perder el archivo local', () => {
    const item = pending()
    let state = chatReferenceUploadReducer([], {
      type: 'queue',
      items: [item],
    })
    state = chatReferenceUploadReducer(state, {
      type: 'progress',
      id: item.id,
      progress: 63.4,
    })
    expect(state[0]?.progress).toBe(63)

    state = chatReferenceUploadReducer(state, {
      type: 'failed',
      id: item.id,
      error: 'Sin conexión',
    })
    expect(state[0]).toMatchObject({
      file: item.file,
      status: 'error',
      error: 'Sin conexión',
    })

    state = chatReferenceUploadReducer(state, {
      type: 'retry',
      id: item.id,
    })
    expect(state[0]).toMatchObject({
      file: item.file,
      status: 'uploading',
      progress: 0,
      error: null,
    })
  })

  test('revoca y elimina todas las URL temporales', () => {
    const urls = new Map([
      ['uno', 'blob:uno'],
      ['dos', 'blob:dos'],
    ])
    const revoked: Array<string> = []

    revokeChatReferencePreviewUrls(urls, (url) => revoked.push(url))

    expect(revoked).toEqual(['blob:uno', 'blob:dos'])
    expect(urls.size).toBe(0)
  })
})

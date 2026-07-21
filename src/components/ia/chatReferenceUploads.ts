export const MAX_CHAT_REFERENCE_UPLOAD_BATCH = 5
export const CHAT_REFERENCE_FILE_ACCEPT =
  '.pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp'

export type ChatReferenceUploadStatus = 'uploading' | 'error'

export type ChatReferenceUploadItem = {
  id: string
  fingerprint: string
  file: File
  previewUrl: string | null
  status: ChatReferenceUploadStatus
  progress: number
  error: string | null
  conversationId: string | null
}

export type ChatReferenceUploadAction =
  | { type: 'queue'; items: Array<ChatReferenceUploadItem> }
  | { type: 'progress'; id: string; progress: number }
  | { type: 'failed'; id: string; error: string }
  | { type: 'retry'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'clear' }

type ClipboardFileSource = {
  files?: ArrayLike<File> | null
  items?: ArrayLike<{
    kind: string
    getAsFile: () => File | null
  }> | null
}

export function chatReferenceFileFingerprint(file: File) {
  return [
    file.name.trim().toLocaleLowerCase('es-MX'),
    file.size,
    file.lastModified,
    file.type.toLocaleLowerCase('es-MX'),
  ].join(':')
}

export function selectChatReferenceUploadBatch(
  files: Array<File>,
  existingFingerprints: ReadonlySet<string>,
  maximum = MAX_CHAT_REFERENCE_UPLOAD_BATCH,
) {
  const accepted: Array<File> = []
  const seen = new Set(existingFingerprints)
  let duplicateCount = 0
  let overflowCount = 0

  for (const file of files) {
    const fingerprint = chatReferenceFileFingerprint(file)
    if (seen.has(fingerprint)) {
      duplicateCount += 1
      continue
    }
    seen.add(fingerprint)

    if (accepted.length >= maximum) {
      overflowCount += 1
      continue
    }
    accepted.push(file)
  }

  return { accepted, duplicateCount, overflowCount }
}

export function extractClipboardReferenceFiles(
  source: ClipboardFileSource,
  now: () => Date = () => new Date(),
) {
  const direct = Array.from(source.files ?? [])
  const files = direct.length
    ? direct
    : Array.from(source.items ?? []).flatMap((item) => {
        if (item.kind !== 'file') return []
        const file = item.getAsFile()
        return file ? [file] : []
      })

  return files.map((file, index) => {
    if (file.name && file.name !== 'image.png') return file

    const extension =
      (
        {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/webp': 'webp',
        } as Record<string, string>
      )[file.type] ?? 'bin'
    const stamp = now().toISOString().replace(/[:.]/g, '-')
    const generatedName = `imagen-pegada-${stamp}-${index + 1}.${extension}`
    const normalized = new File(
      [file.slice(0, file.size, file.type)],
      generatedName,
      {
        type: file.type,
        lastModified: file.lastModified || now().getTime(),
      },
    )

    // Bun 1.3 conserva a veces el nombre del File de origen aun creando uno
    // nuevo. Los navegadores no entran aquí, pero el fallback mantiene las
    // pruebas y herramientas locales alineadas con el nombre que verá la UI.
    if (normalized.name !== generatedName) {
      Object.defineProperty(normalized, 'name', { value: generatedName })
    }
    return normalized
  })
}

export function chatReferenceUploadReducer(
  state: Array<ChatReferenceUploadItem>,
  action: ChatReferenceUploadAction,
): Array<ChatReferenceUploadItem> {
  switch (action.type) {
    case 'queue':
      return [
        ...state,
        ...action.items.filter(
          (item) => !state.some((current) => current.id === item.id),
        ),
      ]
    case 'progress':
      return state.map((item) =>
        item.id === action.id
          ? {
              ...item,
              progress: Math.max(0, Math.min(100, Math.round(action.progress))),
            }
          : item,
      )
    case 'failed':
      return state.map((item) =>
        item.id === action.id
          ? { ...item, status: 'error', error: action.error }
          : item,
      )
    case 'retry':
      return state.map((item) =>
        item.id === action.id
          ? { ...item, status: 'uploading', progress: 0, error: null }
          : item,
      )
    case 'remove':
      return state.filter((item) => item.id !== action.id)
    case 'clear':
      return []
  }
}

export function revokeChatReferencePreviewUrls(
  urls: Map<string, string>,
  revoke: (url: string) => void = (url) => URL.revokeObjectURL(url),
) {
  urls.forEach((url) => revoke(url))
  urls.clear()
}

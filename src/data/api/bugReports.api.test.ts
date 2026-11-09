import { describe, expect, test } from 'bun:test'

import {
  BUG_REPORT_MAX_ATTACHMENT_BYTES,
  validateBugReportAttachment,
} from './bugReports.api'

describe('bug reports', () => {
  test('acepta imágenes dentro del límite', () => {
    expect(
      validateBugReportAttachment(
        new File(['ok'], 'captura.png', { type: 'image/png' }),
      ),
    ).toBeNull()
  })

  test('rechaza tipos no permitidos y archivos demasiado grandes', () => {
    expect(
      validateBugReportAttachment(
        new File(['x'], 'script.js', { type: 'text/javascript' }),
      ),
    ).toContain('Solo se aceptan')
    const large = new File(
      [new Uint8Array(BUG_REPORT_MAX_ATTACHMENT_BYTES + 1)],
      'grande.png',
      { type: 'image/png' },
    )
    expect(validateBugReportAttachment(large)).toContain('10 MB')
  })
})

import { assert, assertEquals } from 'jsr:@std/assert@1'

import {
  validateBugReportAttachment,
  normalizeBugReportText,
} from '../../create-bug-report/validation.ts'

Deno.test('bug report attachments only accept supported images', () => {
  assert(
    validateBugReportAttachment(
      new File(['ok'], 'captura.png', { type: 'image/png' }),
    ) === null,
  )
  assert(
    validateBugReportAttachment(
      new File(['ok'], 'documento.pdf', { type: 'application/pdf' }),
    ),
  )
})

Deno.test('bug report text is trimmed and bounded', () => {
  assertEquals(normalizeBugReportText('  problema  '), 'problema')
  assertEquals(normalizeBugReportText(42), '')
  assertEquals(normalizeBugReportText('abcdef', 3), 'abc')
})

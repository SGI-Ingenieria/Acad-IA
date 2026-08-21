import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

import {
  parsePublicFunctionNames,
  shouldVerifyFunctionJwt,
} from '../../main/auth-policy.ts'

Deno.test(
  'main router requires JWT except for explicitly public functions',
  () => {
    const publicNames = parsePublicFunctionNames(
      'openai-webhook-responses, observability-health',
    )

    assertEquals(
      shouldVerifyFunctionJwt({
        functionName: 'openai-webhook-responses',
        publicFunctionNames: publicNames,
        legacyVerifyJwt: false,
      }),
      false,
    )
    assertEquals(
      shouldVerifyFunctionJwt({
        functionName: 'ai-generate-plan',
        publicFunctionNames: publicNames,
        legacyVerifyJwt: false,
      }),
      true,
    )
  },
)

Deno.test(
  'la lista pública de despliegue coincide con config.toml',
  async () => {
    const config = await Deno.readTextFile('supabase/config.toml')
    const expected: Array<string> = []
    const sections = config.split(/^\[functions\./m).slice(1)

    for (const section of sections) {
      const endOfName = section.indexOf(']')
      const name = section.slice(0, endOfName)
      const body = section.slice(endOfName + 1).split(/^\[/m)[0]
      if (/^verify_jwt\s*=\s*false\s*$/m.test(body)) expected.push(name)
    }

    const envExample = await Deno.readTextFile('.env.example')
    const envList = envExample.match(/^FUNCTIONS_PUBLIC_NAMES=(.+)$/m)?.[1]
    const values = await Deno.readTextFile(
      'deploy/helm/acad-ia-backend/values.yaml',
    )
    const chartList = values.match(/^\s*publicNames:\s*(.+)$/m)?.[1]

    assertEquals(
      [...(parsePublicFunctionNames(envList) ?? [])].sort(),
      expected.sort(),
    )
    assertEquals(
      [...(parsePublicFunctionNames(chartList) ?? [])].sort(),
      expected,
    )
  },
)

Deno.test(
  'main router preserves the legacy global switch when no list exists',
  () => {
    assertEquals(parsePublicFunctionNames(undefined), null)
    assertEquals(
      shouldVerifyFunctionJwt({
        functionName: 'cualquier-funcion',
        publicFunctionNames: null,
        legacyVerifyJwt: true,
      }),
      true,
    )
  },
)

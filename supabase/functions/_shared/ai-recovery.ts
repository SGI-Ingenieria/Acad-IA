export async function mapWithConcurrency<T>(
  values: Array<T>,
  concurrency: number,
  worker: (value: T) => Promise<void>,
): Promise<void> {
  let cursor = 0
  const runners = Array.from(
    { length: Math.min(Math.max(1, concurrency), values.length) },
    async () => {
      while (cursor < values.length) {
        const index = cursor
        cursor += 1
        await worker(values[index])
      }
    },
  )
  await Promise.all(runners)
}

export async function collectPaginated<T>(
  loadPage: (from: number, to: number) => Promise<Array<T>>,
  pageSize = 100,
): Promise<Array<T>> {
  const size = Math.max(1, Math.floor(pageSize))
  const values: Array<T> = []

  for (let from = 0; ; from += size) {
    const page = await loadPage(from, from + size - 1)
    values.push(...page)
    if (page.length < size) return values
  }
}

export async function secureSecretsMatch(provided: string, expected: string) {
  const encoder = new TextEncoder()
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const left = new Uint8Array(providedHash)
  const right = new Uint8Array(expectedHash)
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index]
  }
  return difference === 0
}

export async function recoveryHeadersAuthorized(
  headers: Headers,
  expectedPublishableKey: string,
  expectedSecret: string,
): Promise<boolean> {
  const apiKey = headers.get('apikey')?.trim() ?? ''
  const authorization = headers.get('authorization')?.trim() ?? ''
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? ''
  const secret = headers.get('x-ai-recovery-secret')?.trim() ?? ''

  if (
    !apiKey ||
    !bearer ||
    !secret ||
    !expectedPublishableKey ||
    !expectedSecret
  ) {
    return false
  }

  const [apiKeyMatches, bearerMatches, secretMatches] = await Promise.all([
    secureSecretsMatch(apiKey, expectedPublishableKey),
    secureSecretsMatch(bearer, expectedPublishableKey),
    secureSecretsMatch(secret, expectedSecret),
  ])
  return apiKeyMatches && bearerMatches && secretMatches
}

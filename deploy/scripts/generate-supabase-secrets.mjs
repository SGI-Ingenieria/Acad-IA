import {
  createHash,
  createHmac,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  sign,
} from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const base64url = (value) => Buffer.from(value).toString('base64url')
const randomBase64Url = (bytes) => randomBytes(bytes).toString('base64url')
const randomHex = (bytes) => randomBytes(bytes).toString('hex')

function signHs256(payload, jwtSecret) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(payload))
  const content = `${header}.${body}`
  const signature = createHmac('sha256', jwtSecret)
    .update(content)
    .digest('base64url')
  return `${content}.${signature}`
}

function opaqueApiKey(prefix) {
  const projectRef = 'supabase-self-hosted'
  const random = randomBase64Url(17).slice(0, 22)
  const intermediate = `${prefix}${random}`
  const checksum = createHash('sha256')
    .update(`${projectRef}|${intermediate}`)
    .digest('base64url')
    .slice(0, 8)
  return `${intermediate}_${checksum}`
}

export function generateApiKeys() {
  return {
    SUPABASE_PUBLISHABLE_KEY: opaqueApiKey('sb_publishable_'),
    SUPABASE_SECRET_KEY: opaqueApiKey('sb_secret_'),
  }
}

export function generateAsymmetricIdentity(jwtSecret) {
  if (!jwtSecret) throw new Error('JWT_SECRET is required')

  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const privateJwk = privateKey.export({ format: 'jwk' })
  const kid = randomUUID()
  const symmetricJwk = {
    kty: 'oct',
    k: base64url(jwtSecret),
    alg: 'HS256',
  }
  const privateSigningJwk = {
    kty: 'EC',
    kid,
    use: 'sig',
    key_ops: ['sign', 'verify'],
    alg: 'ES256',
    ext: true,
    crv: privateJwk.crv,
    x: privateJwk.x,
    y: privateJwk.y,
    d: privateJwk.d,
  }
  const publicSigningJwk = {
    kty: 'EC',
    kid,
    use: 'sig',
    key_ops: ['verify'],
    alg: 'ES256',
    ext: true,
    crv: privateJwk.crv,
    x: privateJwk.x,
    y: privateJwk.y,
  }
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + 5 * 365 * 24 * 60 * 60

  const signEs256 = (role) => {
    const header = base64url(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid }))
    const payload = base64url(
      JSON.stringify({ role, iss: 'supabase', iat: issuedAt, exp: expiresAt }),
    )
    const content = `${header}.${payload}`
    const signature = sign('SHA256', Buffer.from(content), {
      key: privateKey,
      dsaEncoding: 'ieee-p1363',
    }).toString('base64url')
    return `${content}.${signature}`
  }

  return {
    ...generateApiKeys(),
    ANON_KEY_ASYMMETRIC: signEs256('anon'),
    SERVICE_ROLE_KEY_ASYMMETRIC: signEs256('service_role'),
    JWT_KEYS: JSON.stringify([privateSigningJwk, symmetricJwk]),
    JWT_JWKS: JSON.stringify({ keys: [publicSigningJwk, symmetricJwk] }),
  }
}

export function generateBootstrapSecrets() {
  const jwtSecret = randomBytes(30).toString('base64')
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + 5 * 365 * 24 * 60 * 60
  const postgresPassword = randomHex(32)

  return {
    JWT_SECRET: jwtSecret,
    ANON_KEY: signHs256(
      { role: 'anon', iss: 'supabase', iat: issuedAt, exp: expiresAt },
      jwtSecret,
    ),
    SERVICE_ROLE_KEY: signHs256(
      {
        role: 'service_role',
        iss: 'supabase',
        iat: issuedAt,
        exp: expiresAt,
      },
      jwtSecret,
    ),
    ...generateAsymmetricIdentity(jwtSecret),
    POSTGRES_PASSWORD: postgresPassword,
    POSTGRES_PASSWORD_ENCODED: encodeURIComponent(postgresPassword),
    POSTGRES_DB: 'postgres',
    DASHBOARD_USERNAME: 'admin',
    DASHBOARD_PASSWORD: randomBase64Url(32),
    SECRET_KEY_BASE: randomBytes(48).toString('base64'),
    REALTIME_DB_ENC_KEY: randomHex(8),
    VAULT_ENC_KEY: randomHex(16),
    PG_META_CRYPTO_KEY: randomBytes(24).toString('base64'),
    S3_PROTOCOL_ACCESS_KEY_ID: randomHex(16),
    S3_PROTOCOL_ACCESS_KEY_SECRET: randomHex(32),
    INTERNAL_AUTH_SECRET: randomBase64Url(48),
    INTERNAL_AUTH_PEPPER: randomBase64Url(32),
    USER_CREATION_MASTER_PASSWORD: randomBase64Url(32),
  }
}

export function generateRotation(scope, jwtSecret) {
  if (scope === 'api-keys') return generateApiKeys()
  if (scope === 'dashboard') {
    return { DASHBOARD_PASSWORD: randomBase64Url(32) }
  }
  if (scope === 'application') {
    return {
      INTERNAL_AUTH_SECRET: randomBase64Url(48),
      INTERNAL_AUTH_PEPPER: randomBase64Url(32),
      USER_CREATION_MASTER_PASSWORD: randomBase64Url(32),
    }
  }
  if (scope === 'identity') return generateAsymmetricIdentity(jwtSecret)
  if (scope === 'safe') {
    return {
      ...generateApiKeys(),
      DASHBOARD_PASSWORD: randomBase64Url(32),
    }
  }
  throw new Error(`Unsupported rotation scope: ${scope}`)
}

async function main() {
  const [mode = 'bootstrap', outputPath, jwtSecretPath] = process.argv.slice(2)
  if (!outputPath) {
    throw new Error(
      'Usage: node generate-supabase-secrets.mjs <bootstrap|scope> <output.json> [jwt-secret-file]',
    )
  }

  const jwtSecret = jwtSecretPath
    ? (await readFile(jwtSecretPath, 'utf8')).trim()
    : undefined
  const secrets =
    mode === 'bootstrap'
      ? generateBootstrapSecrets()
      : generateRotation(mode, jwtSecret)
  await writeFile(outputPath, `${JSON.stringify(secrets)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}

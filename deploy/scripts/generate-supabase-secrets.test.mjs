import assert from 'node:assert/strict'
import test from 'node:test'

import {
  generateApiKeys,
  generateAsymmetricIdentity,
  generateBootstrapSecrets,
  generateRotation,
} from './generate-supabase-secrets.mjs'

test('bootstrap creates a coherent current self-hosted secret set', () => {
  const secrets = generateBootstrapSecrets()
  assert.match(secrets.SUPABASE_PUBLISHABLE_KEY, /^sb_publishable_/)
  assert.match(secrets.SUPABASE_SECRET_KEY, /^sb_secret_/)
  assert.equal(
    secrets.AI_RECOVERY_CRON_PUBLISHABLE_KEY,
    secrets.SUPABASE_PUBLISHABLE_KEY,
  )
  assert.ok(secrets.AI_RECOVERY_CRON_SECRET.length >= 48)
  assert.equal(
    decodeURIComponent(secrets.POSTGRES_PASSWORD_ENCODED),
    secrets.POSTGRES_PASSWORD,
  )
  assert.equal(JSON.parse(secrets.JWT_KEYS).length, 2)
  assert.equal(JSON.parse(secrets.JWT_JWKS).keys.length, 2)
  assert.equal(secrets.REALTIME_DB_ENC_KEY.length, 16)
  assert.equal(secrets.VAULT_ENC_KEY.length, 32)
})

test('API-key rotation does not replace the signing identity', () => {
  const before = generateAsymmetricIdentity('a'.repeat(32))
  const after = generateApiKeys()
  assert.notEqual(
    before.SUPABASE_PUBLISHABLE_KEY,
    after.SUPABASE_PUBLISHABLE_KEY,
  )
  assert.deepEqual(Object.keys(after).sort(), [
    'AI_RECOVERY_CRON_PUBLISHABLE_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SECRET_KEY',
  ])
})

test('identity rotation preserves the supplied legacy JWT secret in JWKS', () => {
  const jwtSecret = 'legacy-secret-with-at-least-32-characters'
  const rotated = generateRotation('identity', jwtSecret)
  const symmetric = JSON.parse(rotated.JWT_JWKS).keys.find(
    (key) => key.kty === 'oct',
  )
  assert.equal(
    Buffer.from(symmetric.k, 'base64url').toString('utf8'),
    jwtSecret,
  )
})

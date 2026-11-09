// @ts-ignore Deno resolves npm imports at runtime.
import jwt from 'npm:jsonwebtoken'

export type GitHubAppConfig = {
  token: string
  appId: string
  installationId: string
  privateKey: string
  owner: string
  repo: string
  configured: boolean
}

function readEnv(name: string) {
  return Deno.env.get(name)?.trim() ?? ''
}

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, '\n')
}

export function getGitHubAppConfig(): GitHubAppConfig {
  // Use a dedicated hosted secret first. GITHUB_TOKEN is also injected by
  // GitHub Actions and may refer to the workflow token instead of the token
  // authorized to create issues in Acad-IA.
  const token = readEnv('GITHUB_BUG_REPORT_TOKEN') || readEnv('GITHUB_TOKEN')
  const appId = readEnv('GITHUB_APP_ID')
  const installationId = readEnv('GITHUB_APP_INSTALLATION_ID')
  const privateKey = readEnv('GITHUB_APP_PRIVATE_KEY')
  const owner = readEnv('GITHUB_OWNER') || 'SGI-Ingenieria'
  const repo = readEnv('GITHUB_REPO') || 'Acad-IA'
  return {
    token,
    appId,
    installationId,
    privateKey,
    owner,
    repo,
    configured: Boolean(token || (appId && installationId && privateKey)),
  }
}

export async function getGitHubInstallationToken(
  config = getGitHubAppConfig(),
) {
  if (config.token) return config.token
  if (!config.configured) {
    throw new Error('GitHub App no está configurado.')
  }
  const issuedAt = Math.floor(Date.now() / 1000) - 60
  const appJwt = jwt.sign(
    { iat: issuedAt, exp: issuedAt + 9 * 60, iss: config.appId },
    normalizePrivateKey(config.privateKey),
    { algorithm: 'RS256' },
  )
  const response = await fetch(
    `https://api.github.com/app/installations/${encodeURIComponent(config.installationId)}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'acad-ia-bug-reporter',
      },
    },
  )
  if (!response.ok)
    throw new Error(`GitHub rechazó el token (${response.status}).`)
  const body = await response.json()
  if (!body?.token || typeof body.token !== 'string') {
    throw new Error('GitHub no devolvió un token de instalación válido.')
  }
  return body.token as string
}

export function githubHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'acad-ia-bug-reporter',
    'Content-Type': 'application/json',
  }
}

import '@supabase/functions-js/edge-runtime.d.ts'

import { corsHeaders } from '../_shared/cors.ts'
import {
  getGitHubAppConfig,
  getGitHubInstallationToken,
  githubHeaders,
} from '../_shared/github-app.ts'
import {
  createServiceRoleClient,
  requireAuthenticatedUserWithClient,
} from '../_shared/supabase.ts'
import { HttpError, edgeErrorResponse, jsonResponse } from '../_shared/utils.ts'
import {
  BUG_REPORT_MAX_ATTACHMENTS,
  normalizeBugReportText,
  validateBugReportAttachment,
} from './validation.ts'

type RequestBody = {
  summary?: unknown
  description?: unknown
  steps?: unknown
  expected?: unknown
  url?: unknown
  userAgent?: unknown
  viewport?: unknown
}

type GitHubAttachment = {
  name: string
  url: string
}

const MAX_TEXT = 12_000

function text(value: unknown, max = MAX_TEXT) {
  return normalizeBugReportText(value, max)
}

function formText(form: FormData, name: string) {
  const value = form.get(name)
  return value instanceof File ? '' : text(value)
}

async function readRequest(request: Request) {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.toLowerCase().includes('multipart/form-data')) {
    const form = await request.formData()
    const files = form
      .getAll('attachments')
      .filter((value): value is File => value instanceof File)
    return {
      body: {
        summary: formText(form, 'summary'),
        description: formText(form, 'description'),
        steps: formText(form, 'steps'),
        expected: formText(form, 'expected'),
        url: formText(form, 'url'),
        userAgent: formText(form, 'userAgent'),
        viewport: formText(form, 'viewport'),
      } satisfies RequestBody,
      files,
    }
  }

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new HttpError(
      415,
      'El reporte debe enviarse como formulario multipart/form-data.',
      'INVALID_REPORT_CONTENT_TYPE',
    )
  }
  return {
    body: (await request.json()) as RequestBody,
    files: [],
  }
}

function escapeMarkdownAlt(value: string) {
  return (
    value.replace(/[\\[\]]/g, '\\$&').slice(0, 180) || 'Captura del reporte'
  )
}

function markdownSection(title: string, value: string) {
  return value ? `### ${title}\n\n${value}\n` : ''
}

function buildIssueBody(input: {
  description: string
  steps: string
  expected: string
  url: string
  userAgent: string
  viewport: string
  createdAt: string
  attachments: Array<GitHubAttachment>
}) {
  const attachmentLines = input.attachments.length
    ? `### Evidencia visual\n\n${input.attachments
        .map((item) => `![${escapeMarkdownAlt(item.name)}](${item.url})`)
        .join('\n\n')}\n`
    : ''
  return [
    '## Reporte enviado desde Acad-IA',
    '',
    markdownSection('Descripción', input.description),
    markdownSection('Pasos para reproducir', input.steps),
    markdownSection('Resultado esperado', input.expected),
    attachmentLines,
    '### Contexto',
    '',
    `- URL: ${input.url || 'No disponible'}`,
    `- Vista: ${input.viewport || 'No disponible'}`,
    `- Navegador: ${input.userAgent || 'No disponible'}`,
    '- Reportado por: usuario autenticado',
    `- Fecha: ${input.createdAt}`,
  ].join('\n')
}

function issueTitle(summary: string) {
  const clean = summary.replace(/\s+/g, ' ').trim().slice(0, 180)
  return `[Bug] ${clean}`
}

async function getRepositoryId(owner: string, repo: string, token: string) {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { headers: githubHeaders(token) },
  )
  const payload = await response.json().catch(() => null)
  if (!response.ok || !Number.isInteger(payload?.id)) {
    throw new HttpError(
      502,
      'No se pudo validar el acceso del token al repositorio de GitHub.',
      'GITHUB_REPOSITORY_ACCESS_FAILED',
      { status: response.status },
    )
  }
  return Number(payload.id)
}

async function uploadGitHubAttachment(
  file: File,
  repositoryId: number,
  token: string,
): Promise<GitHubAttachment> {
  const validationError = validateBugReportAttachment(file)
  if (validationError) {
    throw new HttpError(400, validationError, 'INVALID_ATTACHMENT')
  }

  const uploadUrl = new URL(
    'https://uploads.github.com/user-attachments/assets',
  )
  uploadUrl.searchParams.set('name', file.name || 'captura.png')
  uploadUrl.searchParams.set('content_type', file.type)
  uploadUrl.searchParams.set('repository_id', String(repositoryId))
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'acad-ia-bug-reporter',
      'Content-Type': 'application/octet-stream',
    },
    body: await file.arrayBuffer(),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || typeof payload?.url !== 'string') {
    throw new HttpError(
      502,
      response.status === 403 || response.status === 404
        ? 'GitHub no permite adjuntar imágenes con este token. Verifica que la cuenta tenga acceso de escritura al repositorio.'
        : 'GitHub no pudo adjuntar la imagen del reporte.',
      'GITHUB_ATTACHMENT_UPLOAD_FAILED',
      { status: response.status },
    )
  }
  return { name: file.name || 'captura.png', url: payload.url }
}

async function handler(request: Request) {
  if (request.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') {
    throw new HttpError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED')
  }

  const serviceClient = createServiceRoleClient()
  await requireAuthenticatedUserWithClient(request, serviceClient)
  const { body, files } = await readRequest(request)
  const summary = text(body.summary, 180)
  const description = text(body.description)
  if (!summary || !description) {
    throw new HttpError(
      400,
      'El resumen y la descripción son obligatorios.',
      'INVALID_REPORT',
    )
  }
  if (files.length > BUG_REPORT_MAX_ATTACHMENTS) {
    throw new HttpError(
      400,
      `Puedes adjuntar hasta ${BUG_REPORT_MAX_ATTACHMENTS} imágenes.`,
      'INVALID_ATTACHMENTS',
    )
  }
  for (const file of files) {
    const validationError = validateBugReportAttachment(file)
    if (validationError) {
      throw new HttpError(400, validationError, 'INVALID_ATTACHMENT')
    }
  }

  const config = getGitHubAppConfig()
  if (!config.configured) {
    throw new HttpError(
      503,
      'La publicación en GitHub no está configurada. Define GITHUB_TOKEN o las credenciales del GitHub App en los secretos del backend.',
      'GITHUB_NOT_CONFIGURED',
    )
  }

  const token = await getGitHubInstallationToken(config)
  const repositoryId = files.length
    ? await getRepositoryId(config.owner, config.repo, token)
    : 0
  const attachments: Array<GitHubAttachment> = []
  for (const file of files) {
    attachments.push(await uploadGitHubAttachment(file, repositoryId, token))
  }

  const createdAt = new Date().toISOString()
  const title = issueTitle(summary)
  const issueBody = buildIssueBody({
    description,
    steps: text(body.steps),
    expected: text(body.expected),
    url: text(body.url, 2_000),
    userAgent: text(body.userAgent, 1_000),
    viewport: text(body.viewport, 100),
    createdAt,
    attachments,
  })
  const issueEndpoint = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/issues`
  let issueResponse = await fetch(issueEndpoint, {
    method: 'POST',
    headers: githubHeaders(token),
    body: JSON.stringify({ title, body: issueBody, labels: ['bug'] }),
  })
  let issuePayload = await issueResponse.json().catch(() => null)
  if (issueResponse.status === 422) {
    issueResponse = await fetch(issueEndpoint, {
      method: 'POST',
      headers: githubHeaders(token),
      body: JSON.stringify({ title, body: issueBody }),
    })
    issuePayload = await issueResponse.json().catch(() => null)
  }
  if (!issueResponse.ok) {
    const isAuthorizationFailure = [401, 403].includes(issueResponse.status)
    throw new HttpError(
      502,
      isAuthorizationFailure
        ? 'GitHub rechazó el token. Verifica que tenga acceso al repositorio SGI-Ingenieria/Acad-IA y permiso de escritura en Issues.'
        : 'GitHub no pudo crear la issue.',
      isAuthorizationFailure
        ? 'GITHUB_TOKEN_NOT_AUTHORIZED'
        : 'GITHUB_ISSUE_CREATE_FAILED',
      { status: issueResponse.status },
    )
  }

  return jsonResponse({
    issueUrl: String(issuePayload?.html_url ?? ''),
    issueNumber: Number(issuePayload?.number ?? 0),
    issueTitle: title,
  })
}

Deno.serve(async (request) => {
  try {
    return await handler(request)
  } catch (error) {
    return edgeErrorResponse(error, 'create-bug-report')
  }
})

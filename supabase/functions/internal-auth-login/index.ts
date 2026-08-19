import '@supabase/functions-js/edge-runtime.d.ts'
import * as tls from 'node:tls'
import { Buffer } from 'node:buffer'
// httpntlm re-exports its low-level NTLM message helpers as `.ntlm`.
// deno-lint-ignore no-explicit-any
import httpntlm from 'httpntlm'
import { preflightResponse } from '../_shared/cors.ts'
import { readJsonBody, requireMethod } from '../_shared/request.ts'
import { createAnonClient, getServiceRoleClient } from '../_shared/supabase.ts'
import { edgeErrorResponse, HttpError, sendSuccess } from '../_shared/utils.ts'
// deno-lint-ignore no-explicit-any
const ntlm = (httpntlm as any).ntlm

const INTERNAL_AUTH_SECRET = Deno.env.get('INTERNAL_AUTH_SECRET')
const INTERNAL_AUTH_PEPPER = Deno.env.get('INTERNAL_AUTH_PEPPER')
const SGU_NTLM_URL = Deno.env.get('SGU_NTLM_URL') ?? 'https://sgu.ulsa.edu.mx/'

type NtlmValidationResult = 'valid' | 'invalid'

interface ParsedResponse {
  statusCode: number
  headers: Record<string, string>
  bodyStart: number
}

// Parse status line + headers from a raw HTTP response buffer. Returns null if
// the header block hasn't fully arrived yet. Intentionally lenient — this is the
// whole reason we bypass Deno's strict HTTP client for IIS NTLM responses.
function parseHttpHead(buf: Buffer): ParsedResponse | null {
  const headerEnd = buf.indexOf('\r\n\r\n')
  if (headerEnd === -1) return null

  const lines = buf.slice(0, headerEnd).toString('latin1').split('\r\n')
  const statusMatch = lines[0].match(/HTTP\/\d\.\d\s+(\d{3})/)
  const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 0

  const headers: Record<string, string> = {}
  for (let i = 1; i < lines.length; i++) {
    const idx = lines[i].indexOf(':')
    if (idx === -1) continue
    const key = lines[i].slice(0, idx).trim().toLowerCase()
    const value = lines[i].slice(idx + 1).trim()
    headers[key] = headers[key] ? `${headers[key]}, ${value}` : value
  }

  return { statusCode, headers, bodyStart: headerEnd + 4 }
}

// Given a fully-parsed head, return the absolute byte length of head+body within
// `buf`, or null if the body hasn't fully arrived. Needed so we can realign the
// stream before sending the Type 3 message on the same keep-alive connection.
function bodyConsumedLength(
  buf: Buffer,
  parsed: ParsedResponse,
): number | null {
  const te = (parsed.headers['transfer-encoding'] ?? '').toLowerCase()
  if (te.includes('chunked')) {
    let pos = parsed.bodyStart
    for (;;) {
      const lineEnd = buf.indexOf('\r\n', pos)
      if (lineEnd === -1) return null
      const size = parseInt(
        buf.slice(pos, lineEnd).toString('latin1').trim(),
        16,
      )
      if (Number.isNaN(size)) return null
      const dataStart = lineEnd + 2
      if (size === 0) {
        const termEnd = buf.indexOf('\r\n', dataStart)
        return termEnd === -1 ? null : termEnd + 2
      }
      const chunkEnd = dataStart + size + 2 // chunk data + trailing CRLF
      if (buf.length < chunkEnd) return null
      pos = chunkEnd
    }
  }

  const cl = parsed.headers['content-length']
  if (cl !== undefined) {
    const len = parseInt(cl, 10)
    const total = parsed.bodyStart + (Number.isNaN(len) ? 0 : len)
    return buf.length < total ? null : total
  }

  // No framing info on the negotiate response: assume an empty body.
  return parsed.bodyStart
}

// Manual NTLM handshake over a raw TLS socket. NTLM is connection-bound: the
// Type 1 (negotiate) and Type 3 (authenticate) messages must travel over the
// same TCP connection, and we parse the HTTP responses ourselves because Deno's
// HTTP client rejects IIS's non-RFC-compliant headers ("invalid HTTP header
// parsed").
const MAX_NTLM_REDIRECTS = 5

// Run the NTLM handshake against a single URL over one TLS connection. Resolves
// to a validation result, or to a `{ redirect }` URL when the server answers the
// negotiate request with a 3xx instead of a 401 challenge.
function ntlmHandshake(
  target: URL,
  username: string,
  password: string,
): Promise<NtlmValidationResult | { redirect: URL }> {
  return new Promise((resolve, reject) => {
    const host = target.hostname
    const port = target.port ? parseInt(target.port, 10) : 443
    const path = (target.pathname || '/') + target.search

    let settled = false
    let stage: 1 | 2 = 1
    let buffer = Buffer.alloc(0)

    const socket = tls.connect({ host, port, servername: host }, () => {
      writeRequest(
        ntlm.createType1Message({ domain: '', workstation: '' }),
        'keep-alive',
      )
    })
    socket.setTimeout(15000)

    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      socket.destroy()
      fn()
    }
    const done = (r: NtlmValidationResult | { redirect: URL }) =>
      finish(() => resolve(r))
    const fail = (err: Error) => finish(() => reject(err))

    function writeRequest(
      authHeader: string,
      connection: 'keep-alive' | 'close',
    ) {
      socket.write(
        [
          `GET ${path} HTTP/1.1`,
          `Host: ${host}`,
          `Authorization: ${authHeader}`,
          `Connection: ${connection}`,
          'User-Agent: acad-ia-internal-auth',
          'Accept: */*',
          'Content-Length: 0',
          '',
          '',
        ].join('\r\n'),
      )
    }

    function processBuffer() {
      if (settled) return
      const parsed = parseHttpHead(buffer)
      if (!parsed) return // headers not fully received yet

      if (stage === 1) {
        // Some IIS front-ends redirect unauthenticated requests to the actual
        // NTLM-protected path. Follow the Location to find the 401 challenge.
        if (parsed.statusCode >= 300 && parsed.statusCode < 400) {
          const location = parsed.headers['location']
          if (!location) {
            return fail(
              new Error(
                `SGU sent ${parsed.statusCode} without a Location header`,
              ),
            )
          }
          try {
            return done({ redirect: new URL(location, target) })
          } catch {
            return fail(
              new Error(`SGU sent an invalid redirect Location: ${location}`),
            )
          }
        }

        if (parsed.statusCode !== 401) {
          // Server didn't issue an NTLM challenge.
          if (parsed.statusCode >= 200 && parsed.statusCode < 300)
            return done('valid')
          if (parsed.statusCode >= 400 && parsed.statusCode < 500)
            return done('invalid')
          return fail(
            new Error(
              `SGU responded with status ${parsed.statusCode} on negotiate`,
            ),
          )
        }

        // Must drain the challenge response's body before reusing the connection.
        const consumed = bodyConsumedLength(buffer, parsed)
        if (consumed === null) return // wait for the rest of the body

        const wwwAuth = parsed.headers['www-authenticate'] ?? ''
        let parseErr: Error | null = null
        const type2msg = ntlm.parseType2Message(wwwAuth, (err: Error) => {
          parseErr = err
        })
        if (parseErr || !type2msg) {
          return fail(
            parseErr ??
              new Error(`No NTLM challenge in WWW-Authenticate: ${wwwAuth}`),
          )
        }

        const type3msg = ntlm.createType3Message(type2msg, {
          username,
          password,
          domain: '',
          workstation: '',
        })

        buffer = buffer.slice(consumed)
        stage = 2
        writeRequest(type3msg, 'close')
        processBuffer() // in case the next response is already buffered
        return
      }

      // stage 2: the status line alone tells us whether auth succeeded. A 3xx
      // here means the credentials were accepted (server now redirects the
      // now-authenticated request), so treat any non-4xx as valid.
      if (parsed.statusCode >= 400 && parsed.statusCode < 500)
        return done('invalid')
      if (parsed.statusCode >= 500) {
        return fail(new Error(`SGU responded with status ${parsed.statusCode}`))
      }
      done('valid')
    }

    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk])
      processBuffer()
    })
    socket.on('error', (err: Error) => fail(err))
    socket.on('timeout', () => fail(new Error('SGU connection timed out')))
    socket.on('close', () => {
      if (!settled)
        fail(
          new Error(
            'SGU closed the connection before completing NTLM handshake',
          ),
        )
    })
  })
}

async function validateNtlm(
  url: string,
  username: string,
  password: string,
): Promise<NtlmValidationResult> {
  let current = new URL(url)
  for (let hop = 0; hop <= MAX_NTLM_REDIRECTS; hop++) {
    const result = await ntlmHandshake(current, username, password)
    if (typeof result === 'string') return result

    if (result.redirect.protocol !== 'https:') {
      throw new Error(
        `SGU redirected to a non-HTTPS URL: ${result.redirect.href}`,
      )
    }
    console.log(
      `[internal-auth-login] following SGU redirect to ${result.redirect.href}`,
    )
    current = result.redirect
  }
  throw new Error(
    `SGU exceeded ${MAX_NTLM_REDIRECTS} redirects without an NTLM challenge`,
  )
}

async function deriveInternalPassword(
  clave: string,
  userId: string,
  secret: string,
  pepper: string,
): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(`${pepper}|${clave}|${userId}`),
  )
  return (
    btoa(String.fromCharCode(...new Uint8Array(sig))).substring(0, 32) + 'Aa1!'
  )
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return preflightResponse()
  }

  try {
    requireMethod(req, 'POST')
    if (!INTERNAL_AUTH_SECRET || !INTERNAL_AUTH_PEPPER) {
      console.error(
        '[internal-auth-login] INTERNAL_AUTH_SECRET o INTERNAL_AUTH_PEPPER no configurados',
      )
      throw new HttpError(
        500,
        'Autenticación interna no configurada.',
        'INTERNAL_SERVER_ERROR',
      )
    }
    const rawBody = await readJsonBody(req)

    const body = rawBody as Record<string, unknown>
    const rawClave = body.clave
    const password = body.password

    // Validate clave format
    const clave = String(rawClave ?? '')
      .toLowerCase()
      .trim()
    if (!clave || !/^(ad|do)\d{6}$/.test(clave)) {
      throw new HttpError(
        400,
        'Formato de clave inválido. Debe ser ad o do seguido de 6 dígitos.',
        'INVALID_CLAVE_FORMAT',
      )
    }

    // Validate password
    if (!password || typeof password !== 'string' || !password.trim()) {
      throw new HttpError(
        400,
        'La contraseña es requerida.',
        'MISSING_PASSWORD',
      )
    }

    // NTLM validation against SGU — institutional password used here and nowhere else
    let ntlmResult: NtlmValidationResult
    try {
      ntlmResult = await validateNtlm(SGU_NTLM_URL, clave, password)
    } catch (ntlmErr) {
      console.error('[internal-auth-login] NTLM error:', ntlmErr)
      throw new HttpError(
        503,
        'El servidor institucional no está disponible. Intenta más tarde.',
        'NTLM_SERVICE_UNAVAILABLE',
      )
    }

    if (ntlmResult === 'invalid') {
      throw new HttpError(
        401,
        'Credenciales institucionales inválidas.',
        'INVALID_INTERNAL_CREDENTIALS',
      )
    }

    const supabase = getServiceRoleClient()
    const { data: usuario, error: lookupError } = await supabase
      .from('usuarios_app')
      .select('id, dado_de_baja_en')
      .eq('clave', clave)
      .maybeSingle()

    if (lookupError) {
      console.error(
        '[internal-auth-login] DB lookup error:',
        lookupError.message,
      )
      throw new HttpError(500, 'Error al buscar usuario.', 'DB_ERROR')
    }

    if (!usuario || usuario.dado_de_baja_en) {
      throw new HttpError(
        404,
        'No existe una cuenta vinculada a esta Clave La Salle.',
        'INTERNAL_USER_NOT_FOUND',
      )
    }

    const { data: authUserData, error: authUserError } =
      await supabase.auth.admin.getUserById(usuario.id)

    if (authUserError) {
      console.error(
        '[internal-auth-login] getUserById error:',
        authUserError.message,
      )
      throw new HttpError(
        500,
        'Error al buscar credenciales.',
        'SUPABASE_AUTH_ERROR',
      )
    }

    const email = authUserData.user?.email
    if (!email) {
      throw new HttpError(
        422,
        'La cuenta interna no tiene correo electrónico vinculado.',
        'INTERNAL_USER_WITHOUT_EMAIL',
      )
    }

    const derivedPassword = await deriveInternalPassword(
      clave,
      usuario.id,
      INTERNAL_AUTH_SECRET,
      INTERNAL_AUTH_PEPPER,
    )

    const authClient = createAnonClient()
    let { data: sessionData, error: sessionError } =
      await authClient.auth.signInWithPassword({
        email,
        password: derivedPassword,
      })

    if (sessionError || !sessionData.session) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        usuario.id,
        {
          password: derivedPassword,
          app_metadata: {
            ...(authUserData.user.app_metadata ?? {}),
            user_type: 'internal',
            auth_provider: 'ulsa_ntlm',
          },
        },
      )

      if (updateError) {
        console.error(
          '[internal-auth-login] updateUserById error:',
          updateError.message,
        )
        throw new HttpError(
          500,
          'Error al actualizar credenciales.',
          'SUPABASE_AUTH_ERROR',
        )
      }

      const retry = await authClient.auth.signInWithPassword({
        email,
        password: derivedPassword,
      })
      sessionData = retry.data
      sessionError = retry.error
    }

    if (sessionError || !sessionData?.session) {
      console.error(
        '[internal-auth-login] signInWithPassword error:',
        sessionError?.message,
      )
      throw new HttpError(500, 'Error al crear sesión.', 'SUPABASE_AUTH_ERROR')
    }

    return sendSuccess({ session: sessionData.session })
  } catch (error) {
    return edgeErrorResponse(
      error,
      'internal-auth-login',
      'Error inesperado en el servidor.',
    )
  }
})

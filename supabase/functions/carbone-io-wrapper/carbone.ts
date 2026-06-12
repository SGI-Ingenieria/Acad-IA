const CARBONE_VERSION = '5'

export type CarboneSuccess<T> = {
  success: true
  data: T
  hasMore?: boolean
  nextCursor?: string
}

export type CarboneError = {
  success: false
  error: string
}

export type CarboneResponse<T> = CarboneSuccess<T> | CarboneError

export type CarboneDownloadResult = {
  buffer: Uint8Array
  contentType: string | null
  contentDisposition: string | null
}

export class CarboneClient {
  constructor(
    private baseUrl: string,
    private apiToken: string,
  ) {}

  private buildHeaders(extra?: Record<string, string>) {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      'carbone-version': CARBONE_VERSION,
      ...extra,
    }
  }

  private async parseResponse<T>(res: Response): Promise<T> {
    const contentType = res.headers.get('content-type') || ''

    if (!res.ok) {
      let message = `Carbone request failed: ${res.status}`
      try {
        const err = await res.json()
        message = err?.error || err?.message || message
      } catch {
        // ignore json parse errors
      }
      throw new Error(message)
    }

    if (contentType.includes('application/json')) {
      return res.json() as Promise<T>
    }

    return res as unknown as T
  }

  private toQuery(params?: Record<string, unknown>) {
    const qs = new URLSearchParams()
    if (!params) return ''
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue
      qs.set(key, String(value))
    }
    const s = qs.toString()
    return s ? `?${s}` : ''
  }

  async listTemplates(params?: {
    id?: string
    versionId?: string
    category?: string
    origin?: 0 | 1
    includeVersions?: boolean
    search?: string
    limit?: number
    cursor?: string
  }) {
    const res = await fetch(
      `${this.baseUrl}/templates${this.toQuery(params)}`,
      {
        method: 'GET',
        headers: this.buildHeaders(),
      },
    )
    return this.parseResponse<
      CarboneResponse<
        Array<{
          id: string
          versionId: string
          deployedAt: number
          createdAt: number
          expireAt?: number
          size: number
          type: string
          name?: string
          category?: string
          comment?: string
          tags?: string[]
          origin?: number
        }>
      >
    >(res)
  }

  async listCategories() {
    const res = await fetch(`${this.baseUrl}/templates/categories`, {
      method: 'GET',
      headers: this.buildHeaders(),
    })
    return this.parseResponse<CarboneResponse<Array<{ name: string }>>>(res)
  }

  async listTags() {
    const res = await fetch(`${this.baseUrl}/templates/tags`, {
      method: 'GET',
      headers: this.buildHeaders(),
    })
    return this.parseResponse<CarboneResponse<Array<{ name: string }>>>(res)
  }

  async uploadTemplateJson(body: {
    template: string
    versioning?: boolean
    id?: string
    name?: string
    comment?: string
    tags?: string[]
    category?: string
    sample?: unknown[]
    deployedAt?: number
    expireAt?: number
  }) {
    const res = await fetch(`${this.baseUrl}/template`, {
      method: 'POST',
      headers: this.buildHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(body),
    })
    return this.parseResponse<
      CarboneResponse<{
        id?: string
        versionId?: string
        templateId?: string
        type?: string
        size?: number
        createdAt?: number
      }>
    >(res)
  }

  async uploadTemplateFile(input: {
    file: Blob
    filename: string
    versioning?: boolean
    id?: string
    name?: string
    comment?: string
    tags?: string[]
    category?: string
    sample?: unknown[]
    deployedAt?: number
    expireAt?: number
  }) {
    const form = new FormData()

    if (input.versioning !== undefined) {
      form.append('versioning', String(input.versioning))
    }
    if (input.id) form.append('id', input.id)
    if (input.name) form.append('name', input.name)
    if (input.comment) form.append('comment', input.comment)
    if (input.category) form.append('category', input.category)
    if (input.tags) {
      for (const tag of input.tags) form.append('tags[]', tag)
    }
    if (input.sample) form.append('sample', JSON.stringify(input.sample))
    if (input.deployedAt !== undefined) {
      form.append('deployedAt', String(input.deployedAt))
    }
    if (input.expireAt !== undefined) {
      form.append('expireAt', String(input.expireAt))
    }

    // template should be appended last
    form.append('template', input.file, input.filename)

    const res = await fetch(`${this.baseUrl}/template`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: form,
    })
    return this.parseResponse<
      CarboneResponse<{
        id?: string
        versionId?: string
        templateId?: string
        type?: string
        size?: number
        createdAt?: number
      }>
    >(res)
  }

  async patchTemplate(
    id: string,
    body: {
      name?: string
      comment?: string
      tags?: string[]
      category?: string
      deployedAt?: number
      expireAt?: number
    },
  ) {
    const res = await fetch(`${this.baseUrl}/template/${id}`, {
      method: 'PATCH',
      headers: this.buildHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(body),
    })
    return this.parseResponse<CarboneResponse<true>>(res)
  }

  async deleteTemplate(id: string) {
    const res = await fetch(`${this.baseUrl}/template/${id}`, {
      method: 'DELETE',
      headers: this.buildHeaders(),
    })
    return this.parseResponse<CarboneResponse<true>>(res)
  }

  async downloadTemplate(id: string): Promise<CarboneDownloadResult> {
    const res = await fetch(`${this.baseUrl}/template/${id}`, {
      method: 'GET',
      headers: this.buildHeaders(),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => null)
      throw new Error(
        err?.error || `Failed to download template: ${res.status}`,
      )
    }

    return {
      buffer: new Uint8Array(await res.arrayBuffer()),
      contentType: res.headers.get('content-type'),
      contentDisposition: res.headers.get('content-disposition'),
    }
  }

  async render(
    templateIdOrVersionId: string,
    body: Record<string, unknown>,
    opts?: { download?: boolean; format?: 'pdf' | 'xlsx' },
  ) {
    const params = new URLSearchParams()
    if (opts?.download) params.set('download', 'true')

    if (opts?.format) params.set('format', opts.format)

    const query = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(
      `${this.baseUrl}/render/${templateIdOrVersionId}${query}`,
      {
        method: 'POST',
        headers: this.buildHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(body),
      },
    )

    if (opts?.download) {
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || `Render failed: ${res.status}`)
      }
      return {
        buffer: new Uint8Array(await res.arrayBuffer()),
        contentType: res.headers.get('content-type'),
        contentDisposition: res.headers.get('content-disposition'),
      } satisfies CarboneDownloadResult
    }

    return this.parseResponse<CarboneResponse<{ renderId: string }>>(res)
  }

  async renderFromTemplate(
    body: Record<string, unknown>,
    opts?: { download?: boolean },
  ) {
    const query = opts?.download ? '?download=true' : ''
    const res = await fetch(`${this.baseUrl}/render/template${query}`, {
      method: 'POST',
      headers: this.buildHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(body),
    })

    if (opts?.download) {
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || `Render failed: ${res.status}`)
      }
      return {
        buffer: new Uint8Array(await res.arrayBuffer()),
        contentType: res.headers.get('content-type'),
        contentDisposition: res.headers.get('content-disposition'),
      } satisfies CarboneDownloadResult
    }

    return this.parseResponse<CarboneResponse<{ renderId: string }>>(res)
  }

  async downloadRender(renderId: string): Promise<CarboneDownloadResult> {
    const res = await fetch(`${this.baseUrl}/render/${renderId}`, {
      method: 'GET',
    })

    if (!res.ok) {
      const err = await res.json().catch(() => null)
      throw new Error(err?.error || `Failed to download render: ${res.status}`)
    }

    return {
      buffer: new Uint8Array(await res.arrayBuffer()),
      contentType: res.headers.get('content-type'),
      contentDisposition: res.headers.get('content-disposition'),
    }
  }
}

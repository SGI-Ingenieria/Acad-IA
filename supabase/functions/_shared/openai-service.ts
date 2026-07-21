// supabase/functions/_shared/openai-service.ts
/// <reference lib="dom" />
// @ts-ignore Deno supports `npm:` specifiers at runtime
import OpenAI from 'npm:openai@6.16.0'

// @ts-ignore Deno supports `npm:` specifiers at runtime
import type * as OpenAITypes from 'npm:openai@6.16.0'

declare const Deno: {
  env: {
    get: (key: string) => string | undefined
  }
}
// Use non-streaming params to ensure `responses.create` returns a typed Response
export type StructuredResponseOptions =
  OpenAITypes.OpenAI.Responses.ResponseCreateParamsNonStreaming
export type StructuredResponseSuccess<TOutput = unknown> = {
  ok: true
  output?: TOutput // parsed JSON when available
  outputText?: string // raw text when parsing is not possible
  model: string
  usage?: OpenAITypes.OpenAI.Responses.Response['usage'] | null
  responseId: string
  conversationId?: string | null
  references: {
    openaiFileIds: Array<string> // file ids in OpenAI
  }
  openaiRaw: OpenAITypes.OpenAI.Responses.Response // keep for advanced consumers
}
export type StructuredResponseFailure = {
  ok: false
  code: 'MissingEnv' | 'OpenAIFileUploadFailed' | 'OpenAIRequestFailed'
  message: string
  cause?: unknown
}
export type StructuredResponseResult<TOutput = unknown> =
  | StructuredResponseSuccess<TOutput>
  | StructuredResponseFailure
export interface OpenAIServiceConfig {
  openAIApiKey: string
}

export type OpenAIFileObject = OpenAITypes.OpenAI.Files.FileObject
export type OpenAIFileDeleted = OpenAITypes.OpenAI.Files.FileDeleted

export class OpenAIService {
  private readonly openai: OpenAI
  private constructor(openai: OpenAI) {
    this.openai = openai
  }
  static fromEnv(): StructuredResponseFailure | OpenAIService {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY') ?? ''
    if (!openAIApiKey) {
      return {
        ok: false,
        code: 'MissingEnv',
        message: 'Required env vars missing: OPENAI_API_KEY',
      }
    }
    const openai = new OpenAI({ apiKey: openAIApiKey })
    return new OpenAIService(openai)
  }

  private parseStructuredOutput<TOutput>(
    openaiRaw: OpenAITypes.OpenAI.Responses.Response,
  ): { output?: TOutput; outputText?: string } {
    let output: TOutput | undefined = undefined
    let outputText: string | undefined = undefined

    const maybeOutputText = openaiRaw.output_text
    if (typeof maybeOutputText === 'string' && maybeOutputText.length > 0) {
      outputText = maybeOutputText
    } else {
      const maybeOutput = openaiRaw.output as unknown
      if (Array.isArray(maybeOutput)) {
        const chunks: Array<string> = []
        for (const item of maybeOutput) {
          const record =
            item && typeof item === 'object'
              ? (item as Record<string, unknown>)
              : null
          const content = record?.content
          if (!Array.isArray(content)) continue

          for (const part of content) {
            const partRecord =
              part && typeof part === 'object'
                ? (part as Record<string, unknown>)
                : null
            if (
              partRecord?.type === 'output_text' &&
              typeof partRecord.text === 'string'
            ) {
              chunks.push(partRecord.text)
            }
          }
        }
        if (chunks.length) outputText = chunks.join('')
      }
    }

    if (outputText) {
      try {
        output = JSON.parse(outputText) as TOutput
      } catch {
        /* non-JSON text, keep as text only */
      }
    } else {
      const maybeOutput = openaiRaw.output as unknown
      if (typeof maybeOutput === 'object' && maybeOutput != null) {
        try {
          outputText = JSON.stringify(maybeOutput)
          output = maybeOutput as TOutput
        } catch {
          /* ignore */
        }
      }
    }

    return { output, outputText }
  }

  private buildStructuredResponseSuccess<TOutput>(args: {
    openaiRaw: OpenAITypes.OpenAI.Responses.Response
    openaiFileIds: Array<string>
    parseOutput: boolean
  }): StructuredResponseSuccess<TOutput> {
    const { openaiRaw, openaiFileIds, parseOutput } = args
    const { model, id: responseId } = openaiRaw
    const usage = openaiRaw?.usage ?? null
    const conversationId =
      (
        openaiRaw as OpenAITypes.OpenAI.Responses.Response & {
          conversation_id?: string | null
        }
      ).conversation_id ?? null
    const parsed = parseOutput
      ? this.parseStructuredOutput<TOutput>(openaiRaw)
      : { output: undefined, outputText: undefined }

    return {
      ok: true,
      output: parsed.output,
      outputText: parsed.outputText,
      model: String(model),
      usage,
      responseId: String(responseId),
      conversationId: conversationId ? String(conversationId) : null,
      references: { openaiFileIds },
      openaiRaw,
    }
  }

  async createConversation(metadata?: Record<string, string>) {
    const conversation = await this.openai.conversations.create({
      metadata,
    })
    return conversation
  }
  async createStructuredResponse<TOutput = unknown>(
    options: StructuredResponseOptions,
  ): Promise<StructuredResponseResult<TOutput>> {
    try {
      // Extraer los IDs de los archivos directamente del input si existen
      const openaiFileIds: Array<string> = []
      if (Array.isArray(options.input)) {
        for (const msg of options.input) {
          if (!msg || typeof msg !== 'object') continue

          // `options.input` es un union amplio (incluye tool calls). Hacemos narrowing por shape.
          const maybeMsg = msg as unknown as Record<string, unknown>
          if (maybeMsg['role'] !== 'user') continue

          const content = maybeMsg['content']
          if (!Array.isArray(content)) continue

          for (const part of content) {
            if (!part || typeof part !== 'object') continue
            const maybePart = part as unknown as Record<string, unknown>
            if (maybePart['type'] === 'input_file' && maybePart['file_id']) {
              openaiFileIds.push(String(maybePart['file_id']))
            }
          }
        }
      }

      // Pasar options directamente
      const openaiRaw = (await this.openai.responses.create(
        options,
      )) as OpenAITypes.OpenAI.Responses.Response

      const isBackground =
        (options as unknown as { background?: boolean }).background === true

      if (isBackground) {
        return this.buildStructuredResponseSuccess<TOutput>({
          openaiRaw,
          openaiFileIds,
          parseOutput: false,
        })
      }
      return this.buildStructuredResponseSuccess<TOutput>({
        openaiRaw,
        openaiFileIds,
        parseOutput: true,
      })
    } catch (err) {
      console.error('OPENAI RAW ERROR:', err)

      const e = err as Error & {
        status?: number
        error?: unknown
        response?: unknown
      }

      const message = e.message || 'Unknown error'
      const code = message.includes('OpenAI file upload failed')
        ? 'OpenAIFileUploadFailed'
        : 'OpenAIRequestFailed'
      return { ok: false, code, message, cause: err }
    }
  }

  async retrieveStructuredResponse<TOutput = unknown>(
    responseId: string,
  ): Promise<StructuredResponseResult<TOutput>> {
    try {
      const openaiRaw = (await this.openai.responses.retrieve(
        responseId,
      )) as OpenAITypes.OpenAI.Responses.Response

      return this.buildStructuredResponseSuccess<TOutput>({
        openaiRaw,
        openaiFileIds: [],
        parseOutput: true,
      })
    } catch (err) {
      console.error('OPENAI RETRIEVE ERROR:', err)
      const e = err as Error
      return {
        ok: false,
        code: 'OpenAIRequestFailed',
        message: e.message || 'Unknown error',
        cause: err,
      }
    }
  }

  async cancelResponse(responseId: string) {
    return await this.openai.responses.cancel(responseId)
  }

  /**
   * Transcribe audio (speech-to-text) using the OpenAI Audio API.
   * The `File` produced by `req.formData()` is a valid Uploadable in Deno.
   */
  async transcribe(input: {
    file: File
    model?: string
    prompt?: string
    language?: string
  }): Promise<{ text: string }> {
    const res = await this.openai.audio.transcriptions.create({
      file: input.file,
      model: input.model ?? 'gpt-4o-transcribe',
      response_format: 'text',
      ...(input.prompt ? { prompt: input.prompt } : {}),
      ...(input.language ? { language: input.language } : {}),
    })

    // With response_format: 'text' the SDK returns the raw string; other
    // formats return an object with a `.text` field.
    const text =
      typeof res === 'string'
        ? res
        : ((res as { text?: string } | null)?.text ?? '')

    return { text: text.trim() }
  }

  /**
   * Uploads files to OpenAI Files API (purpose: user_data) and returns their ids.
   * Exposed for edge functions that need to persist `openai_file_id` before a response.
   */
  async uploadFilesToOpenAI(files: Array<File>): Promise<Array<string>> {
    const ids: Array<string> = []
    for (const file of files) {
      try {
        const created = await this.openai.files.create({
          file,
          purpose: 'user_data',
        })
        ids.push(created.id)
      } catch (e) {
        throw new Error(
          `OpenAI file upload failed: ${(e as Error).message || String(e)}`,
        )
      }
    }
    return ids
  }

  async createFile(file: File, purpose: 'user_data' = 'user_data') {
    const created = await this.openai.files.create({
      file,
      purpose,
    })
    return created as OpenAIFileObject
  }

  async retrieveFile(fileId: string) {
    const file = await this.openai.files.retrieve(fileId)
    return file as OpenAIFileObject
  }

  async deleteFile(fileId: string) {
    const filesAny = this.openai.files as unknown as {
      delete?: (id: string) => Promise<unknown>
      del?: (id: string) => Promise<unknown>
    }

    if (typeof filesAny.delete === 'function') {
      const deleted = await filesAny.delete(fileId)
      return deleted as OpenAIFileDeleted
    }

    if (typeof filesAny.del === 'function') {
      const deleted = await filesAny.del(fileId)
      return deleted as OpenAIFileDeleted
    }

    throw new TypeError(
      'OpenAI SDK no expone files.delete/files.del; revisa la versión del paquete openai.',
    )
  }

  async deleteVectorStoreFile(vectorStoreId: string, openaiFileId: string) {
    const vectorStoresAny = this.openai as unknown as {
      vectorStores?: {
        files?: {
          delete?: (
            fileId: string,
            opts: { vector_store_id: string },
          ) => Promise<unknown>
        }
      }
    }

    const del = vectorStoresAny.vectorStores?.files?.delete
    if (typeof del !== 'function') {
      throw new TypeError(
        'OpenAI SDK no expone vectorStores.files.delete; revisa la versión del paquete openai.',
      )
    }

    return del(openaiFileId, { vector_store_id: vectorStoreId })
  }

  async createVectorStore(name: string) {
    const openaiAny = this.openai as unknown as {
      vectorStores?: {
        create?: (params: { name: string }) => Promise<unknown>
      }
    }

    if (
      !openaiAny.vectorStores ||
      typeof openaiAny.vectorStores.create !== 'function'
    ) {
      throw new TypeError('OpenAI SDK no expone vectorStores.create')
    }

    return await openaiAny.vectorStores.create({
      name,
    })
  }

  async listVectorStoreFiles(vectorStoreId: string) {
    try {
      const openaiAny = this.openai as unknown as {
        vectorStores?: {
          files?: {
            list?: (vectorStoreId: string) => Promise<unknown>
          }
        }
      }

      console.log(
        'vectorStores?.files?.list',
        typeof openaiAny.vectorStores?.files?.list,
      )

      if (
        !openaiAny.vectorStores?.files ||
        typeof openaiAny.vectorStores.files.list !== 'function'
      ) {
        throw new TypeError('OpenAI SDK no expone vectorStores.files.list')
      }

      return await openaiAny.vectorStores.files.list(vectorStoreId)
    } catch (e) {
      console.error('listVectorStoreFiles ERROR:', e)
      throw e
    }
  }

  async listVectorStores() {
    const openaiAny = this.openai as unknown as {
      vectorStores?: {
        list?: () => Promise<unknown>
      }
    }

    if (
      !openaiAny.vectorStores ||
      typeof openaiAny.vectorStores.list !== 'function'
    ) {
      throw new TypeError('OpenAI SDK no expone vectorStores.list')
    }

    return await openaiAny.vectorStores.list()
  }

  async deleteVectorStore(vectorStoreId: string) {
    const vectorStoresAny = this.openai as unknown as {
      vectorStores?: {
        delete?: (id: string) => Promise<unknown>
      }
    }

    const del = vectorStoresAny.vectorStores?.delete

    if (typeof del !== 'function') {
      throw new TypeError('OpenAI SDK no expone vectorStores.delete')
    }

    return await del(vectorStoreId)
  }

  async attachFileToVectorStore(vectorStoreId: string, fileId: string) {
    return await this.openai.vectorStores.files.create(vectorStoreId, {
      file_id: fileId,
    })
  }
}

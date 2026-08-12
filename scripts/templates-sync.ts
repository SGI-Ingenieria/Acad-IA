import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'
import { strFromU8, unzipSync } from 'fflate'

type AssetKey = 'plan_word' | 'mapa_xlsx' | 'asignatura_word'

type TemplateAsset = {
  path: string
  sha256?: string
  templateId: string
  category: string
  allowedRoots: Array<string>
}

type TemplateManifest = {
  manifestVersion: number
  packageId: string
  authority: string
  normativeVersion: string
  applicableFrom: string
  referenceUrl: string
  sources: Array<{ kind: string; path: string; sha256: string }>
  assets: Record<AssetKey, TemplateAsset>
}

const projectRoot = resolve(import.meta.dir, '..')
const manifestPath = resolve(
  projectRoot,
  'supabase/template-assets/sep-rvoe/vigente/manifest.json',
)
const assetRoot = dirname(manifestPath)

const sha256 = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex')

async function loadManifest(): Promise<TemplateManifest> {
  return JSON.parse(await readFile(manifestPath, 'utf8')) as TemplateManifest
}

function extractPlaceholders(bytes: Uint8Array): Array<string> {
  const entries = unzipSync(bytes)
  const xml = Object.entries(entries)
    .filter(([name]) => name.endsWith('.xml'))
    // Word puede fragmentar un placeholder entre varios runs. Quitar solo el
    // marcado XML recompone el texto sin alterar el archivo binario.
    .map(([, value]) =>
      strFromU8(value)
        .replace(/<[^>]+>/g, '')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"'),
    )
    .join('\n')

  return Array.from(
    new Set(
      Array.from(xml.matchAll(/\{d\.([^{}]{1,220})\}/g), (match) =>
        match[1].trim(),
      ),
    ),
  ).sort()
}

function placeholderRoot(placeholder: string): string {
  return placeholder
    .trim()
    .replace(/\[[^\]]*\]/g, '')
    .replace(/:[^(]+\([^)]*\)/g, '')
    .split(/[.+\s]/, 1)[0]
}

function validatePlaceholders(
  asset: TemplateAsset,
  placeholders: Array<string>,
): void {
  if (placeholders.length === 0) {
    throw new Error(
      `La plantilla ${asset.path} no contiene placeholders Carbone.`,
    )
  }

  const unknown = placeholders.filter(
    (placeholder) => !asset.allowedRoots.includes(placeholderRoot(placeholder)),
  )
  if (unknown.length > 0) {
    throw new Error(
      `Placeholders no reconocidos en ${asset.path}: ${unknown.join(', ')}`,
    )
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Falta ${name}.`)
  return value
}

async function carboneDownload(templateId: string): Promise<Uint8Array> {
  const token = requireEnv('CARBONE_API_TOKEN')
  const baseUrl =
    process.env.CARBONE_BASE_URL?.trim() || 'https://carbone.lci.ulsa.mx'
  const response = await fetch(`${baseUrl}/template/${templateId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'carbone-version': '5',
    },
  })
  if (!response.ok) {
    throw new Error(`Carbone no devolvió la plantilla ${templateId}.`)
  }
  return new Uint8Array(await response.arrayBuffer())
}

async function carboneUpload(
  asset: TemplateAsset,
  bytes: Uint8Array,
): Promise<string> {
  const token = requireEnv('CARBONE_API_TOKEN')
  const baseUrl =
    process.env.CARBONE_BASE_URL?.trim() || 'https://carbone.lci.ulsa.mx'
  const form = new FormData()
  form.append('versioning', 'true')
  form.append('id', asset.templateId)
  form.append('name', asset.path)
  form.append('category', asset.category)
  form.append(
    'comment',
    'Sincronizado desde el manifiesto versionado de Acad-IA',
  )
  form.append('deployedAt', String(Math.max(Date.now(), 42_000_000_000)))
  form.append('template', new Blob([Uint8Array.from(bytes).buffer]), asset.path)

  const response = await fetch(`${baseUrl}/template`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'carbone-version': '5',
    },
    body: form,
  })
  if (!response.ok) throw new Error(`No se pudo publicar ${asset.path}.`)
  const body = (await response.json()) as {
    success?: boolean
    data?: { id?: string; templateId?: string }
    id?: string
    templateId?: string
  }
  const nextId =
    body.data?.templateId ?? body.data?.id ?? body.templateId ?? body.id
  if (!nextId) throw new Error(`Carbone no devolvió id para ${asset.path}.`)
  return nextId
}

async function recoverActiveTemplates(manifest: TemplateManifest) {
  const recover: Array<AssetKey> = ['plan_word', 'asignatura_word']
  for (const key of recover) {
    const asset = manifest.assets[key]
    const bytes = await carboneDownload(asset.templateId)
    await mkdir(assetRoot, { recursive: true })
    await writeFile(resolve(assetRoot, asset.path), bytes)
    asset.sha256 = sha256(bytes)
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

async function validateTemplates(manifest: TemplateManifest) {
  for (const source of manifest.sources) {
    const bytes = new Uint8Array(
      await readFile(resolve(assetRoot, source.path)),
    )
    if (sha256(bytes) !== source.sha256) {
      throw new Error(
        `Cambió el hash de ${source.path}; actualiza el manifiesto.`,
      )
    }
  }

  const templateManifest: Record<string, unknown> = {}

  for (const [key, asset] of Object.entries(manifest.assets) as Array<
    [AssetKey, TemplateAsset]
  >) {
    const bytes = new Uint8Array(await readFile(resolve(assetRoot, asset.path)))
    const hash = sha256(bytes)
    if (asset.sha256 && asset.sha256 !== hash) {
      throw new Error(
        `Cambió el hash de ${asset.path}; actualiza el manifiesto.`,
      )
    }
    const placeholders = extractPlaceholders(bytes)
    validatePlaceholders(asset, placeholders)
    asset.sha256 = hash
    templateManifest[key] = {
      sha256: hash,
      placeholders,
      placeholders_validos: true,
      sincronizado_en: new Date().toISOString(),
    }
  }

  return templateManifest
}

async function syncTemplates(manifest: TemplateManifest) {
  const templateManifest = await validateTemplates(manifest)

  for (const asset of Object.values(manifest.assets)) {
    const bytes = new Uint8Array(await readFile(resolve(assetRoot, asset.path)))
    asset.templateId = await carboneUpload(asset, bytes)
  }

  const supabase = createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  )
  const { error } = await supabase
    .from('estructuras_plan')
    .update({
      template_id: manifest.assets.plan_word.templateId,
      excel_template_id: manifest.assets.mapa_xlsx.templateId,
      manifest_plantillas: templateManifest,
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', manifest.packageId)
    .eq('estado_publicacion', 'BORRADOR')
  if (error) throw error

  const { error: subjectError } = await supabase
    .from('estructuras_asignatura')
    .update({
      template_id: manifest.assets.asignatura_word.templateId,
      actualizado_en: new Date().toISOString(),
    })
    .eq('estructura_plan_id', manifest.packageId)
  if (subjectError) throw subjectError

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

const manifest = await loadManifest()
if (process.argv.includes('--recover-active')) {
  await recoverActiveTemplates(manifest)
} else if (process.argv.includes('--validate')) {
  await validateTemplates(manifest)
} else {
  await syncTemplates(manifest)
}

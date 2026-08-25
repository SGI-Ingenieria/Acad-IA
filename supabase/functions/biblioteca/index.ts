// Setup type definitions for built-in Supabase Runtime APIs
import '@supabase/functions-js/edge-runtime.d.ts'
import { XMLParser } from 'npm:fast-xml-parser'

import { corsHeaders, preflightResponse } from '../_shared/cors.ts'

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return preflightResponse()
  }

  try {
    const { titulo, autor, isbn } = await req.json()

    if (!titulo && !isbn) {
      return Response.json(
        { error: 'Debe enviarse titulo o isbn' },
        { status: 400, headers: corsHeaders },
      )
    }

    let xml = ''

    // 1. BÚSQUEDA POR ISBN
    if (isbn) {
      xml = await searchSRU(`bath.isbn="${isbn}"`)
      if (hasResults(xml)) console.log('Encontrado por ISBN')
    }

    // 2. BÚSQUEDA POR TÍTULO LIMPIO
    if (!hasResults(xml) && titulo) {
      xml = await searchSRU(`dc.title="${cleanTitle(titulo)}"`)
      if (hasResults(xml)) console.log('Encontrado por título limpio')
    }

    // 3. BÚSQUEDA POR PALABRAS CLAVE
    if (!hasResults(xml) && titulo) {
      const query = extractKeywords(titulo)
        .map((word) => `cql.anywhere="${word}"`)
        .join(' AND ')
      xml = await searchSRU(query)
      console.log('Busqueda fallback keywords:', query)
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    })

    const json = parser.parse(xml)
    const records =
      json['zs:searchRetrieveResponse']?.['zs:records']?.['zs:record'] ?? []

    const results = (Array.isArray(records) ? records : [records]).map(
      (r: any) => {
        const record = r['zs:recordData']?.record
        return {
          id: getControlField(record, '001'),
          titulo: getSubfield(record, '245', 'a'),
          descripcion: getSubfield(record, '245', 'c'),
          autor: getSubfield(record, '100', 'a'),
          isbn: getSubfield(record, '020', 'a'),
          editorial:
            getSubfield(record, '264', 'b') ?? getSubfield(record, '260', 'b'),
          anio:
            getSubfield(record, '264', 'c') ?? getSubfield(record, '260', 'c'),
        }
      },
    )

    const searchTitle = cleanTitle(titulo)

    const rankedResults = results
      .map((item) => ({
        ...item,
        score:
          similarity(searchTitle, item.titulo ?? '') * 0.9 +
          (autor && item.autor ? similarity(autor, item.autor) * 0.1 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    return Response.json(
      { total: rankedResults.length, results: rankedResults },
      { headers: corsHeaders },
    )
  } catch (error) {
    console.error(error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500, headers: corsHeaders },
    )
  }
})

// ── SRU ─────────────────────────────────────────────────────────────────────

async function searchSRU(query: string): Promise<string> {
  const params = new URLSearchParams({
    version: '1.1',
    operation: 'searchRetrieve',
    query,
    maximumRecords: '50',
    startRecord: '1',
    recordSchema: 'marcxml',
  })
  const response = await fetch(
    `https://catalogo.biblioteca.lasalle.mx/sru/lasalle?${params}`,
  )
  return response.text()
}

function hasResults(xml: string): boolean {
  return (
    xml.includes('<zs:numberOfRecords>') &&
    !xml.includes('<zs:numberOfRecords>0</zs:numberOfRecords>')
  )
}

// ── Ranking ──────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/open\s+gl/g, 'opengl')
    .replace(/c\s*\+\+\s*/g, 'cplusplus')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim()
}

const STOP_WORDS = new Set([
  'de',
  'del',
  'la',
  'las',
  'el',
  'los',
  'con',
  'para',
  'por',
  'en',
  'and',
  'the',
])

function similarity(search: string, candidate: string) {
  const searchWords = new Set(
    normalize(search)
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  )

  const candidateWords = new Set(
    normalize(candidate)
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  )

  let matches = 0

  for (const word of searchWords) {
    if (candidateWords.has(word)) {
      matches++
    }
  }

  return matches / Math.max(searchWords.size, 1)
}

// ── Título ───────────────────────────────────────────────────────────────────

function cleanTitle(title: string) {
  let clean = title

  // Tomar solo la primera parte si viene traducido
  if (clean.includes('/')) {
    clean = clean.split('/')[0]
  }

  return clean
    .replace(/\[.*?\]/g, '')
    .replace(/[.,;:()[\]®]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractKeywords(title: string): Array<string> {
  const stopWords = new Set([
    'de',
    'del',
    'la',
    'las',
    'el',
    'los',
    'con',
    'para',
    'por',
    'en',
    'and',
    'the',
  ])
  return cleanTitle(title)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word.toLowerCase()))
}

// ── MARC ─────────────────────────────────────────────────────────────────────

function getControlField(record: any, tag: string): string | null {
  const fields = Array.isArray(record?.controlfield)
    ? record.controlfield
    : [record?.controlfield]
  const field = fields.find((f: any) => f?.['@_tag'] === tag)
  return field?.['#text'] ?? null
}

function getSubfield(record: any, tag: string, code: string): string | null {
  const fields = Array.isArray(record?.datafield)
    ? record.datafield
    : [record?.datafield]
  const field = fields.find((f: any) => f?.['@_tag'] === tag)
  if (!field) return null
  const subfields = Array.isArray(field.subfield)
    ? field.subfield
    : [field.subfield]
  const subfield = subfields.find((s: any) => s?.['@_code'] === code)
  return subfield?.['#text'] ?? null
}

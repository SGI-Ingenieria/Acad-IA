import { XMLParser } from 'npm:fast-xml-parser'

export type BibliotecaInstitucionalItem = {
  id: string
  titulo: string
  descripcion?: string
  autor?: string
  editorial?: string
  anio?: string
  isbn?: string
}

const SRU_URL = 'https://catalogo.biblioteca.lasalle.mx/sru/lasalle'

export async function buscarBibliotecaInstitucional(
  titulo: string,
): Promise<Array<BibliotecaInstitucionalItem>> {
  const limpio = limpiarTitulo(titulo)
  let xml = await consultarSRU(`dc.title="${limpio}"`)
  if (!tieneResultados(xml)) {
    const query = extraerPalabrasClave(limpio)
      .map((word) => `cql.anywhere="${word}"`)
      .join(' AND ')
    if (query) xml = await consultarSRU(query)
  }

  const json = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  }).parse(xml)
  const rawRecords =
    json['zs:searchRetrieveResponse']?.['zs:records']?.['zs:record']
  const records = Array.isArray(rawRecords)
    ? rawRecords
    : rawRecords
      ? [rawRecords]
      : []

  return records
    .map((raw: Record<string, unknown>) => {
      const record = (raw['zs:recordData'] as Record<string, unknown>)?.record
      const biblionumber = subcampo(record, '999', 'c')
      const controlNumber = campoControl(record, '001')
      return {
        // Koha navega sus fichas con el biblionumber (MARC 999$c), no con el
        // número de control institucional 001 (p. ej. LASALLE-2201).
        id: String(biblionumber ?? controlNumber ?? crypto.randomUUID()),
        titulo: subcampo(record, '245', 'a') ?? 'Sin título',
        descripcion: subcampo(record, '245', 'c') ?? undefined,
        // Algunos registros no tienen autor principal (100), pero Koha los
        // presenta como "Colaborador(es)" en MARC 700/710/711.
        autor:
          subcampo(record, '100', 'a') ??
          subcampo(record, '110', 'a') ??
          subcampo(record, '111', 'a') ??
          subcampo(record, '700', 'a') ??
          subcampo(record, '710', 'a') ??
          subcampo(record, '711', 'a') ??
          undefined,
        isbn: subcampo(record, '020', 'a') ?? undefined,
        editorial:
          subcampo(record, '264', 'b') ??
          subcampo(record, '260', 'b') ??
          undefined,
        anio:
          subcampo(record, '264', 'c') ??
          subcampo(record, '260', 'c') ??
          undefined,
      }
    })
    .slice(0, 10)
}

async function consultarSRU(query: string) {
  const params = new URLSearchParams({
    version: '1.1',
    operation: 'searchRetrieve',
    query,
    maximumRecords: '10',
    startRecord: '1',
    recordSchema: 'marcxml',
  })
  const response = await fetch(`${SRU_URL}?${params}`)
  if (!response.ok)
    throw new Error(`La Biblioteca La Salle respondió ${response.status}`)
  return await response.text()
}

function tieneResultados(xml: string) {
  return (
    xml.includes('<zs:numberOfRecords>') &&
    !xml.includes('<zs:numberOfRecords>0</zs:numberOfRecords>')
  )
}

function limpiarTitulo(titulo: string) {
  return titulo
    .split('/')[0]
    .replace(/\[.*?\]/g, '')
    .replace(/[.,;:()[\]®]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extraerPalabrasClave(titulo: string) {
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
  return limpiarTitulo(titulo)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word.toLowerCase()))
}

function campoControl(record: unknown, tag: string): string | null {
  const fields = Array.isArray((record as any)?.controlfield)
    ? (record as any).controlfield
    : [(record as any)?.controlfield]
  return fields.find((item: any) => item?.['@_tag'] === tag)?.['#text'] ?? null
}

function subcampo(record: unknown, tag: string, code: string): string | null {
  const fields = Array.isArray((record as any)?.datafield)
    ? (record as any).datafield
    : [(record as any)?.datafield]
  const field = fields.find((item: any) => item?.['@_tag'] === tag)
  const subfields = Array.isArray(field?.subfield)
    ? field.subfield
    : [field?.subfield]
  return (
    subfields.find((item: any) => item?.['@_code'] === code)?.['#text'] ?? null
  )
}

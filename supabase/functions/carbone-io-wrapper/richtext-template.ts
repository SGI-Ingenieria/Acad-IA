import { strFromU8, strToU8, unzipSync, zipSync } from 'npm:fflate@0.8.3'

const TEXT_NODE_RE = /<([A-Za-z0-9]+):t\b[^>]*>([\s\S]*?)<\/\1:t>/g

const BULLET_NUM_ID = 9010
const ORDERED_NUM_ID = 9011
const BULLET_ABSTRACT_NUM_ID = 9010
const ORDERED_ABSTRACT_NUM_ID = 9011

type DecodedTextNode = {
  contentStart: number
  contentEnd: number
  rawText: string
  decodedText: string
  concatStart: number
  concatEnd: number
}

export type RichtextTemplatePatchResult = {
  buffer: Uint8Array
  patchedTags: number
}

type InlineMarks = {
  bold: number
  italic: number
  underline: number
  strike: number
  code: number
  link: number
}

type ListContext = {
  type: 'ul' | 'ol'
}

type ParagraphAlign = 'left' | 'right' | 'center' | 'both'

type WordParagraph = {
  runs: string[]
  headingLevel?: number
  align?: ParagraphAlign
  listType?: 'ul' | 'ol'
  listLevel?: number
  quote?: boolean
  codeBlock?: boolean
}

type WordRichtextXml = {
  xml: string
  usesNumbering: boolean
}

function decodeEntityBody(body: string): string | null {
  const lower = body.toLowerCase()
  if (lower === 'amp') return '&'
  if (lower === 'lt') return '<'
  if (lower === 'gt') return '>'
  if (lower === 'quot') return '"'
  if (lower === 'apos') return "'"
  if (lower === 'nbsp') return ' '
  if (lower.startsWith('#x')) {
    const codePoint = Number.parseInt(lower.slice(2), 16)
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : null
  }
  if (lower.startsWith('#')) {
    const codePoint = Number.parseInt(lower.slice(1), 10)
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : null
  }
  return null
}

function decodeXmlText(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp);/gi,
    (entity, body: string) => decodeEntityBody(body) ?? entity,
  )
}

function readDecodedXmlTextChar(
  rawText: string,
  offset: number,
): { text: string; nextOffset: number } {
  if (rawText[offset] === '&') {
    const semi = rawText.indexOf(';', offset + 1)
    if (semi > offset) {
      const entity = rawText.slice(offset + 1, semi)
      const decoded = decodeEntityBody(entity)
      if (decoded != null) return { text: decoded, nextOffset: semi + 1 }
    }
  }

  const codePoint = rawText.codePointAt(offset)
  if (codePoint == null) return { text: '', nextOffset: offset + 1 }
  const text = String.fromCodePoint(codePoint)
  return { text, nextOffset: offset + text.length }
}

function rawOffsetForDecodedOffset(
  rawText: string,
  decodedOffset: number,
): number {
  if (decodedOffset <= 0) return 0

  let rawOffset = 0
  let consumedDecoded = 0
  while (rawOffset < rawText.length && consumedDecoded < decodedOffset) {
    const next = readDecodedXmlTextChar(rawText, rawOffset)
    if (!next.text) break
    rawOffset = next.nextOffset
    consumedDecoded += next.text.length
  }
  return rawOffset
}

function collectDecodedTextNodes(xml: string): DecodedTextNode[] {
  const nodes: DecodedTextNode[] = []
  let concatOffset = 0
  for (const match of xml.matchAll(TEXT_NODE_RE)) {
    const full = match[0]
    const rawText = match[2] ?? ''
    const decodedText = decodeXmlText(rawText)
    const index = match.index ?? 0
    const contentStart = index + full.indexOf('>') + 1
    const contentEnd = contentStart + rawText.length
    nodes.push({
      contentStart,
      contentEnd,
      rawText,
      decodedText,
      concatStart: concatOffset,
      concatEnd: concatOffset + decodedText.length,
    })
    concatOffset += decodedText.length
  }
  return nodes
}

function findDecodedNodeForConcatOffset(
  nodes: DecodedTextNode[],
  offset: number,
) {
  return nodes.find((node, index) => {
    const isLast = index === nodes.length - 1
    return (
      offset >= node.concatStart &&
      (offset < node.concatEnd || (isLast && offset <= node.concatEnd))
    )
  })
}

function xmlPositionForDecodedConcatOffset(
  nodes: DecodedTextNode[],
  offset: number,
): number | null {
  const node = findDecodedNodeForConcatOffset(nodes, offset)
  if (!node) return null

  const decodedOffset = Math.min(
    Math.max(offset - node.concatStart, 0),
    node.decodedText.length,
  )
  return (
    node.contentStart + rawOffsetForDecodedOffset(node.rawText, decodedOffset)
  )
}

function findParagraphRange(
  xml: string,
  xmlPosition: number,
): { start: number; end: number } | null {
  const paragraphStartRe = /<w:p(?:\s|>)/g
  let start = -1
  for (const match of xml.matchAll(paragraphStartRe)) {
    const index = match.index ?? 0
    if (index > xmlPosition) break
    start = index
  }

  const close = '</w:p>'
  const end = xml.indexOf(close, xmlPosition)
  if (start < 0 || end < 0) return null
  return { start, end: end + close.length }
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value).replace(/"/g, '&quot;')
}

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp);/gi,
    (entity, body: string) => decodeEntityBody(body) ?? entity,
  )
}

function currentMarks(marks: InlineMarks): Record<string, boolean> {
  return {
    bold: marks.bold > 0,
    italic: marks.italic > 0,
    underline: marks.underline > 0,
    strike: marks.strike > 0,
    code: marks.code > 0,
    link: marks.link > 0,
  }
}

// Tamaño (en medios-puntos) de los encabezados. Se aplica como w:sz explícito
// en lugar de un estilo "HeadingN" del template para garantizar que se vean más
// grandes sin heredar otra tipografía.
function headingSizeHalfPoints(level?: number): number | null {
  if (!level) return null
  if (level === 1) return 32
  if (level === 2) return 28
  if (level === 3) return 26
  return 24
}

function buildRun(
  rawText: string,
  marks: Record<string, boolean>,
  preserveWhitespace = false,
  headingLevel?: number,
): string {
  const decoded = decodeHtmlEntities(rawText)
  const text = preserveWhitespace ? decoded : decoded.replace(/\s+/g, ' ')
  if (!text) return ''

  const props: string[] = []
  if (marks.bold) props.push('<w:b/>')
  if (marks.italic) props.push('<w:i/>')
  if (marks.underline || marks.link) props.push('<w:u w:val="single"/>')
  if (marks.strike) props.push('<w:strike/>')
  if (marks.link) props.push('<w:color w:val="0563C1"/>')
  if (marks.code) {
    props.push(
      '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>',
      '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>',
    )
  }
  const headingSize = headingSizeHalfPoints(headingLevel)
  if (headingSize) {
    props.push(`<w:sz w:val="${headingSize}"/>`, `<w:szCs w:val="${headingSize}"/>`)
  }

  const needsPreserve = /^\s|\s$|\s{2,}|\n|\t/.test(text)
  const textTag = `<w:t${needsPreserve ? ' xml:space="preserve"' : ''}>${escapeXmlText(
    text,
  )}</w:t>`
  return `<w:r>${props.length ? `<w:rPr>${props.join('')}</w:rPr>` : ''}${textTag}</w:r>`
}

function buildBreakRun(): string {
  return '<w:r><w:br/></w:r>'
}

// Extrae la alineación del atributo style de una etiqueta de apertura
// (text-align). justify se mapea a "both" (valor de OOXML).
function parseAlign(openTag: string): ParagraphAlign | undefined {
  const match = openTag.match(/text-align:\s*(left|right|center|justify)/i)
  if (!match) return undefined
  const value = match[1].toLowerCase()
  return value === 'justify' ? 'both' : (value as 'left' | 'right' | 'center')
}

function buildParagraph(paragraph: WordParagraph): string {
  const props: string[] = []
  // Los encabezados no usan el estilo "HeadingN" del template (evita heredar
  // otra tipografía); el tamaño se aplica a nivel de run en buildRun.
  if (paragraph.align) {
    props.push(`<w:jc w:val="${paragraph.align}"/>`)
  }
  if (paragraph.listType) {
    props.push(
      `<w:numPr><w:ilvl w:val="${paragraph.listLevel ?? 0}"/><w:numId w:val="${
        paragraph.listType === 'ul' ? BULLET_NUM_ID : ORDERED_NUM_ID
      }"/></w:numPr>`,
    )
  }
  if (paragraph.quote) {
    props.push('<w:ind w:left="720"/>')
  }
  if (paragraph.codeBlock) {
    props.push('<w:shd w:val="clear" w:color="auto" w:fill="F6F8FA"/>')
  }

  const pPr = props.length ? `<w:pPr>${props.join('')}</w:pPr>` : ''
  return `<w:p>${pPr}${paragraph.runs.join('')}</w:p>`
}

export function richtextHtmlToWordXml(html: string): WordRichtextXml {
  const paragraphs: WordParagraph[] = []
  const marks: InlineMarks = {
    bold: 0,
    italic: 0,
    underline: 0,
    strike: 0,
    code: 0,
    link: 0,
  }
  const listStack: ListContext[] = []
  let current: WordParagraph | null = null
  let usesNumbering = false

  const closeParagraph = () => {
    if (current && current.runs.length > 0) paragraphs.push(current)
    current = null
  }
  const ensureParagraph = () => {
    if (!current) current = { runs: [] }
    return current
  }
  const startParagraph = (paragraph: Omit<WordParagraph, 'runs'> = {}) => {
    closeParagraph()
    current = { ...paragraph, runs: [] }
  }

  const tokenRe = /<[^>]+>|[^<]+/g
  for (const match of html.matchAll(tokenRe)) {
    const token = match[0]
    if (token.startsWith('<')) {
      const tagMatch = token.match(/^<\s*(\/)?\s*([a-zA-Z0-9]+)\b/)
      if (!tagMatch) continue
      const isClosing = Boolean(tagMatch[1])
      const tag = tagMatch[2].toLowerCase()

      if (!isClosing) {
        if (tag === 'p') startParagraph({ align: parseAlign(token) })
        else if (/^h[1-6]$/.test(tag)) {
          startParagraph({
            headingLevel: Number(tag.slice(1)),
            align: parseAlign(token),
          })
          marks.bold += 1
        } else if (tag === 'blockquote') startParagraph({ quote: true })
        else if (tag === 'pre') {
          startParagraph({ codeBlock: true })
          marks.code += 1
        } else if (tag === 'ul' || tag === 'ol') {
          closeParagraph()
          listStack.push({ type: tag })
        } else if (tag === 'li') {
          const list = listStack[listStack.length - 1]
          startParagraph({
            listType: list?.type ?? 'ul',
            listLevel: Math.max(listStack.length - 1, 0),
          })
          usesNumbering = true
        } else if (tag === 'br') {
          ensureParagraph().runs.push(buildBreakRun())
        } else if (tag === 'strong' || tag === 'b') marks.bold += 1
        else if (tag === 'em' || tag === 'i') marks.italic += 1
        else if (tag === 'u') marks.underline += 1
        else if (tag === 's' || tag === 'del') marks.strike += 1
        else if (tag === 'code') marks.code += 1
        else if (tag === 'a') marks.link += 1
        continue
      }

      if (tag === 'p' || tag === 'li' || tag === 'blockquote') {
        closeParagraph()
      } else if (/^h[1-6]$/.test(tag)) {
        marks.bold = Math.max(0, marks.bold - 1)
        closeParagraph()
      } else if (tag === 'pre') {
        marks.code = Math.max(0, marks.code - 1)
        closeParagraph()
      } else if (tag === 'ul' || tag === 'ol') {
        closeParagraph()
        listStack.pop()
      } else if (tag === 'strong' || tag === 'b') {
        marks.bold = Math.max(0, marks.bold - 1)
      } else if (tag === 'em' || tag === 'i') {
        marks.italic = Math.max(0, marks.italic - 1)
      } else if (tag === 'u') marks.underline = Math.max(0, marks.underline - 1)
      else if (tag === 's' || tag === 'del') {
        marks.strike = Math.max(0, marks.strike - 1)
      } else if (tag === 'code') marks.code = Math.max(0, marks.code - 1)
      else if (tag === 'a') marks.link = Math.max(0, marks.link - 1)
      continue
    }

    const paragraph = ensureParagraph()
    const run = buildRun(
      token,
      currentMarks(marks),
      paragraph.codeBlock || marks.code > 0,
      paragraph.headingLevel,
    )
    if (run) paragraph.runs.push(run)
  }
  closeParagraph()

  return {
    xml: paragraphs.length ? paragraphs.map(buildParagraph).join('') : '<w:p/>',
    usesNumbering,
  }
}

function valueForKey(data: Record<string, unknown>, key: string): string {
  const value = data[key]
  if (typeof value === 'string') return value
  return value == null ? '' : String(value)
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function richtextHtmlValuesForData(
  data: Record<string, unknown>,
  richtextKeys: ReadonlyArray<string>,
): string[] {
  const seen = new Set<string>()
  const values: string[] = []

  for (const key of richtextKeys) {
    const value = valueForKey(data, key).trim()
    if (!value || !looksLikeHtml(value) || seen.has(value)) continue
    seen.add(value)
    values.push(value)
  }

  return values
}

function paragraphDecodedText(xml: string): string {
  return collectDecodedTextNodes(xml)
    .map((node) => node.decodedText)
    .join('')
}

export function patchRenderedRichtextHtmlInXml(
  xml: string,
  data: Record<string, unknown>,
  richtextKeys: ReadonlyArray<string>,
): { xml: string; patchedTags: number; usesNumbering: boolean } {
  const values = richtextHtmlValuesForData(data, richtextKeys)
  if (!values.length) return { xml, patchedTags: 0, usesNumbering: false }

  const nodes = collectDecodedTextNodes(xml)
  if (!nodes.length) return { xml, patchedTags: 0, usesNumbering: false }

  const plainText = nodes.map((node) => node.decodedText).join('')
  const replacements: Array<{ start: number; end: number; xml: string }> = []
  const replacedParagraphs = new Set<string>()
  let usesNumbering = false

  for (const value of values.sort((a, b) => b.length - a.length)) {
    let searchFrom = 0
    while (searchFrom < plainText.length) {
      const startOffset = plainText.indexOf(value, searchFrom)
      if (startOffset < 0) break

      searchFrom = startOffset + Math.max(value.length, 1)
      const xmlPosition = xmlPositionForDecodedConcatOffset(nodes, startOffset)
      if (xmlPosition == null) continue

      const range = findParagraphRange(xml, xmlPosition)
      if (!range) continue

      const replacementId = `${range.start}:${range.end}`
      if (replacedParagraphs.has(replacementId)) continue

      const existingText = paragraphDecodedText(
        xml.slice(range.start, range.end),
      )
      if (existingText.trim() !== value.trim()) continue

      const wordXml = richtextHtmlToWordXml(value)
      usesNumbering ||= wordXml.usesNumbering
      replacements.push({ ...range, xml: wordXml.xml })
      replacedParagraphs.add(replacementId)
    }
  }

  if (!replacements.length) {
    return { xml, patchedTags: 0, usesNumbering: false }
  }

  let patched = xml
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    patched = `${patched.slice(0, replacement.start)}${replacement.xml}${patched.slice(
      replacement.end,
    )}`
  }

  return { xml: patched, patchedTags: replacements.length, usesNumbering }
}

function ensureRichtextNumberingParts(zip: Record<string, Uint8Array>) {
  const numberingDefs = `<w:abstractNum w:abstractNumId="${BULLET_ABSTRACT_NUM_ID}"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="${BULLET_NUM_ID}"><w:abstractNumId w:val="${BULLET_ABSTRACT_NUM_ID}"/></w:num><w:abstractNum w:abstractNumId="${ORDERED_ABSTRACT_NUM_ID}"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="${ORDERED_NUM_ID}"><w:abstractNumId w:val="${ORDERED_ABSTRACT_NUM_ID}"/></w:num>`

  const existingNumbering = zip['word/numbering.xml']
  if (existingNumbering) {
    const xml = strFromU8(existingNumbering)
    if (!xml.includes(`w:numId="${BULLET_NUM_ID}"`)) {
      zip['word/numbering.xml'] = strToU8(
        xml.replace('</w:numbering>', `${numberingDefs}</w:numbering>`),
      )
    }
  } else {
    zip['word/numbering.xml'] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${numberingDefs}</w:numbering>`,
    )
  }

  const contentTypes = zip['[Content_Types].xml']
  if (contentTypes) {
    const xml = strFromU8(contentTypes)
    if (!xml.includes('PartName="/word/numbering.xml"')) {
      zip['[Content_Types].xml'] = strToU8(
        xml.replace(
          '</Types>',
          '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>',
        ),
      )
    }
  }

  const relPath = 'word/_rels/document.xml.rels'
  const relType =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering'
  const existingRels = zip[relPath]
  if (existingRels) {
    const xml = strFromU8(existingRels)
    if (!xml.includes(relType)) {
      zip[relPath] = strToU8(
        xml.replace(
          '</Relationships>',
          `<Relationship Id="${escapeXmlAttribute(
            'rIdAcadRichtextNumbering',
          )}" Type="${relType}" Target="numbering.xml"/></Relationships>`,
        ),
      )
    }
  } else {
    zip[relPath] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdAcadRichtextNumbering" Type="${relType}" Target="numbering.xml"/></Relationships>`,
    )
  }
}

export function postProcessRenderedDocxRichtext(
  buffer: Uint8Array,
  data: Record<string, unknown>,
  richtextKeys: ReadonlyArray<string>,
): RichtextTemplatePatchResult {
  if (!richtextKeys.length) return { buffer, patchedTags: 0 }

  const zip = unzipSync(buffer)
  let patchedTags = 0
  let usesNumbering = false

  for (const [path, entry] of Object.entries(zip)) {
    if (!path.startsWith('word/') || !path.endsWith('.xml')) continue
    const xml = strFromU8(entry)
    const patched = patchRenderedRichtextHtmlInXml(xml, data, richtextKeys)
    if (patched.patchedTags > 0) {
      zip[path] = strToU8(patched.xml)
      patchedTags += patched.patchedTags
      usesNumbering ||= patched.usesNumbering
    }
  }

  if (patchedTags === 0) return { buffer, patchedTags }
  if (usesNumbering) ensureRichtextNumberingParts(zip)

  return { buffer: zipSync(zip), patchedTags }
}

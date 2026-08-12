import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'

const PROJECT_ROOT = process.cwd()
const SOURCE_ROOT = join(PROJECT_ROOT, 'src')
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.css'])

const ALLOWED_SPACING_VALUES = new Set([
  '0',
  '0!',
  'auto',
  'px',
  'micro',
  'relacionado',
  'control',
  'grupo',
  'seccion',
  'region',
  'pagina',
  'exhibicion',
])

const SPACING_UTILITY =
  /(?<![\w-])-?(?:gap(?:-[xy])?|space-[xy]|p[trblxyse]?|m[trblxyse]?)-([^\s"'`}>]+)/g
const EXCEPTION_MARKER = 'design-spacing-exception:'

type Violation = {
  file: string
  line: number
  utility: string
}

async function sourceFiles(directory: string): Promise<Array<string>> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return sourceFiles(path)
      return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : []
    }),
  )

  return nested.flat()
}

function normalizedValue(rawValue: string) {
  return rawValue.replace(/[),;\]]+$/, '')
}

function hasDocumentedException(lines: Array<string>, index: number) {
  return lines
    .slice(Math.max(0, index - 4), index + 1)
    .some((line) => line.includes(EXCEPTION_MARKER))
}

function inspectFile(file: string, source: string): Array<Violation> {
  const violations: Array<Violation> = []
  const lines = source.split(/\r?\n/)

  lines.forEach((line, index) => {
    const trimmed = line.trimStart()
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*')
    ) {
      return
    }

    SPACING_UTILITY.lastIndex = 0
    for (const match of line.matchAll(SPACING_UTILITY)) {
      const value = normalizedValue(match[1])
      if (
        ALLOWED_SPACING_VALUES.has(value) ||
        hasDocumentedException(lines, index)
      ) {
        continue
      }

      violations.push({
        file: relative(PROJECT_ROOT, file).replaceAll('\\', '/'),
        line: index + 1,
        utility: match[0],
      })
    }
  })

  return violations
}

const files = await sourceFiles(SOURCE_ROOT)
const violations = (
  await Promise.all(
    files.map(async (file) => inspectFile(file, await readFile(file, 'utf8'))),
  )
).flat()

if (violations.length > 0) {
  console.error('Espaciado fuera de la gramática de proximidad:\n')
  violations.forEach(({ file, line, utility }) => {
    console.error(`  ${file}:${line}  ${utility}`)
  })
  console.error(
    `\nUsa micro, relacionado, control, grupo, seccion, region, pagina o ` +
      `exhibicion. Para una excepción técnica, documenta la línea con ` +
      `"${EXCEPTION_MARKER} <motivo>".`,
  )
  process.exit(1)
}

console.log(
  `Espaciado validado: ${files.length} archivos usan la gramática semántica.`,
)

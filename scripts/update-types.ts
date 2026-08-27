// scripts/update-types.ts
/* Uso:
bun run scripts/update-types.ts
*/
import { $ } from 'bun'

const linked = process.argv.includes('--linked')
const target = linked ? '--linked' : '--local'

console.log(`🔄 Generando tipos de Supabase (${target})...`)

try {
  const result = await (
    linked
      ? $`supabase gen types typescript --linked --schema public`
      : $`supabase gen types typescript --local --schema public`
  )
    .nothrow()
    .quiet()
  const output = result.stdout.toString()

  // El CLI puede cerrar con código distinto de cero al agotar el tiempo de
  // telemetría, aun cuando ya emitió el esquema completo. No persistimos una
  // salida incompleta, pero sí conservamos un esquema verificablemente válido.
  if (
    !output.startsWith('export type Json =') ||
    !output.includes('export const Constants =')
  ) {
    throw new Error(
      `Supabase no generó un esquema válido (código ${result.exitCode}): ${result.stderr.toString().trim()}`,
    )
  }

  if (result.exitCode !== 0) {
    console.warn(
      `⚠️ Supabase generó el esquema con código ${result.exitCode}; se usó la salida completa emitida por el CLI.`,
    )
  }

  // Escribimos el archivo directamente con Bun (garantiza UTF-8)
  await Bun.write('src/types/supabase.ts', output)
  await Bun.write('supabase/functions/_shared/database.types.ts', output)

  console.log('✅ Tipos actualizados correctamente con acentos.')
} catch (error) {
  console.error('❌ Error generando tipos:', error)
}

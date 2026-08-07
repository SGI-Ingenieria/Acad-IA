// scripts/update-types.ts
/* Uso:
bun run scripts/update-types.ts
*/
import { $ } from 'bun'

const linked = process.argv.includes('--linked')
const target = linked ? '--linked' : '--local'

console.log(`🔄 Generando tipos de Supabase (${target})...`)

try {
  // Ejecutamos el comando y capturamos la salida como texto
  const output = linked
    ? await $`supabase gen types typescript --linked --schema public`.text()
    : await $`supabase gen types typescript --local --schema public`.text()

  // Escribimos el archivo directamente con Bun (garantiza UTF-8)
  await Bun.write('src/types/supabase.ts', output)
  await Bun.write('supabase/functions/_shared/database.types.ts', output)

  console.log('✅ Tipos actualizados correctamente con acentos.')
} catch (error) {
  console.error('❌ Error generando tipos:', error)
}

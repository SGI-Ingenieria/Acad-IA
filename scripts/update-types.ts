// scripts/update-types.ts
/* Uso:
bun run scripts/update-types.ts
*/
import { $ } from 'bun'

console.log('🔄 Generando tipos de Supabase...')

try {
  // Ejecutamos el comando y capturamos la salida como texto
  const output = await $`supabase gen types typescript --linked`.text()

  // Escribimos el archivo directamente con Bun (garantiza UTF-8)
  await Bun.write('src/types/supabase.ts', output)

  console.log('✅ Tipos actualizados correctamente con acentos.')
} catch (error) {
  console.error('❌ Error generando tipos:', error)
}

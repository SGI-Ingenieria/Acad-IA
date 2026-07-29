// Inserción quirúrgica de las columnas nuevas en las dos copias generadas de
// los tipos de la base. No se regenera el archivo completo porque el generador
// produce ~11 000 líneas de diferencia con lo versionado (funciones authz_*
// ausentes en la copia comprometida), y esa deriva no es de esta migración.
// Ver la nota de memoria «Catálogo Asignaturas».
//
// Script de un solo uso: se conserva en `local/` (ignorado por Git) sólo como
// registro de cómo se hizo la inserción.
import { readFileSync, writeFileSync } from 'node:fs'

/** Propiedades nuevas por tabla. El tipo es idéntico en Row, Insert y Update;
 *  sólo cambia si la propiedad es opcional. */
const CAMBIOS = {
  carreras: {
    ciclos_default: 'number | null',
    semanas_por_ciclo_default: 'number | null',
    tipo_ciclo_default: "Database['public']['Enums']['tipo_ciclo'] | null",
  },
  planes_estudio: {
    semanas_por_ciclo: 'number | null',
  },
}

const VARIANTES = ['Row', 'Insert', 'Update']
const nombreProp = (linea) => linea.trim().split(/[?:]/)[0]

function procesar(ruta) {
  let lineas = readFileSync(ruta, 'utf8').split('\n')

  for (const [tabla, props] of Object.entries(CAMBIOS)) {
    const iTabla = lineas.indexOf(`      ${tabla}: {`)
    if (iTabla === -1) throw new Error(`No se encontró la tabla ${tabla}`)

    for (const variante of VARIANTES) {
      const iVar = lineas.findIndex(
        (l, i) => i > iTabla && l === `        ${variante}: {`,
      )
      const iFin = lineas.findIndex((l, i) => i > iVar && l === '        }')
      if (iVar === -1 || iFin === -1) {
        throw new Error(`No se pudo delimitar ${tabla}.${variante}`)
      }

      const cuerpo = lineas.slice(iVar + 1, iFin)
      const presentes = new Set(cuerpo.map(nombreProp))
      const nuevas = Object.entries(props)
        .filter(([nombre]) => !presentes.has(nombre))
        .map(
          ([nombre, tipo]) =>
            `          ${nombre}${variante === 'Row' ? '' : '?'}: ${tipo}`,
        )
      if (nuevas.length === 0) continue

      const combinado = [...cuerpo, ...nuevas].sort((a, b) =>
        nombreProp(a).localeCompare(nombreProp(b), 'en'),
      )
      lineas = [
        ...lineas.slice(0, iVar + 1),
        ...combinado,
        ...lineas.slice(iFin),
      ]
    }
  }

  writeFileSync(ruta, lineas.join('\n'))
  console.log(`${ruta}: ok`)
}

procesar('src/types/supabase.ts')
procesar('supabase/functions/_shared/database.types.ts')

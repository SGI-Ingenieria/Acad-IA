/**
 * Cabeceras de auditoría del modo agente de IA.
 *
 * El backend agrupa el historial por sesión de agente leyendo las cabeceras
 * `x-agente-*` en `request.headers` (migración `20260724150000_auditoria_agente_ia`,
 * helpers `public.agente_ia_sesion_id()` / `agente_ia_contexto()` /
 * `agente_ia_interaccion_id()`, que rellenan por DEFAULT las columnas nuevas de
 * `cambios_plan` y `cambios_asignatura`). Sin ellas, un cambio hecho en modo
 * agente es indistinguible de uno hecho a mano.
 *
 * ¿Por qué un módulo con estado y no un parámetro de cada mutación?
 * Porque la capa de datos son funciones asíncronas planas: no pueden leer un
 * contexto de React. La alternativa —enhebrar `{ sesionId, contexto }` por las
 * ~30 firmas de mutación del proyecto y por cada uno de sus llamadores— duplica
 * la fontanería del modo agente en superficies que no tienen por qué conocerlo.
 * El modo agente es global y único (hay una sesión activa como mucho), así que
 * un valor ambiental modela exactamente eso, igual que `supabaseBrowser()` ya
 * es un singleton ambiental.
 *
 * El propietario del valor sigue siendo React: `AgenteProvider` lo sincroniza
 * desde su estado. Este módulo no decide nada, sólo lo hace legible desde
 * funciones no-React.
 */

export type SesionAgente = {
  sesionId: string
  /** Las 2-5 palabras que el usuario escribió en el dock. */
  contexto: string
}

let sesionActiva: SesionAgente | null = null
let interaccionActiva: string | null = null

/** La llama `AgenteProvider`; `null` al detener o cerrar el modo. */
export function setSesionAgente(sesion: SesionAgente | null): void {
  sesionActiva = sesion
  if (!sesion) interaccionActiva = null
}

/**
 * Interacción de IA que originó la escritura en curso. Es *best-effort*: si dos
 * acciones del agente se solapan, la traza puede quedar atribuida a la última.
 * No afecta al agrupado del historial, que usa `sesionId` y no puede solaparse.
 */
export function setInteraccionAgente(interaccionId: string | null): void {
  interaccionActiva = interaccionId
}

/**
 * Marca las escrituras de `fn` como originadas por `interaccionId`. Restaura el
 * valor anterior al terminar, así que anidar es seguro; lo que no se puede
 * garantizar es el solapamiento entre dos acciones distintas (ver arriba).
 */
export async function conInteraccionAgente<T>(
  interaccionId: string | null | undefined,
  fn: () => Promise<T> | T,
): Promise<T> {
  if (!interaccionId) return await fn()

  const previo = interaccionActiva
  interaccionActiva = interaccionId
  try {
    return await fn()
  } finally {
    interaccionActiva = previo
  }
}

/**
 * Codifica el contexto en base64 de sus bytes UTF-8.
 *
 * Es obligatorio, no una precaución: el contexto es español y casi siempre lleva
 * tildes. Un valor de cabecera no-ASCII viaja como bytes crudos Latin-1, y
 * PostgREST decodifica las cabeceras como UTF-8 para construir el GUC
 * `request.headers`; al toparse con `ó` (0xF3) aborta la petición entera con
 * «Cannot decode byte '\xf3': Data.Text.Encoding: Invalid UTF-8 stream». Es
 * decir: una tilde en el contexto hacía fallar *todas* las escrituras del modo
 * agente, no sólo la auditoría. `public.agente_ia_contexto()` deshace esto con
 * `convert_from(decode(v,'base64'),'utf8')`.
 */
function aBase64Utf8(valor: string): string {
  const bytes = new TextEncoder().encode(valor)
  let binario = ''
  for (const byte of bytes) binario += String.fromCharCode(byte)
  return btoa(binario)
}

/**
 * Cabeceras a adjuntar a una escritura. `undefined` fuera del modo agente, para
 * que el llamador pueda seguir usando el cliente singleton.
 */
export function encabezadosAgente(): Record<string, string> | undefined {
  if (!sesionActiva) return undefined

  // El contexto es opcional: el usuario puede trabajar en modo agente sin
  // escribir nada, y entonces la fila de auditoría queda agrupada por sesión
  // pero sin frase.
  const contexto = sesionActiva.contexto.trim()

  return {
    'x-agente-sesion-id': sesionActiva.sesionId,
    ...(contexto
      ? { 'x-agente-contexto-b64': aBase64Utf8(contexto.slice(0, 240)) }
      : {}),
    ...(interaccionActiva
      ? { 'x-agente-interaccion-id': interaccionActiva }
      : {}),
  }
}

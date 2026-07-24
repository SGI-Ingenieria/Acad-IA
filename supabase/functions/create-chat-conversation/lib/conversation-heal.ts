// @ts-ignore Deno soporta especificadores `npm:` en tiempo de ejecución
import type OpenAI from 'npm:openai@6.16.0'

/**
 * Elimina los `function_call` huérfanos (sin su `function_call_output`) de una
 * conversación persistida de OpenAI.
 *
 * Contexto: la detección de intención invocaba un tool de función adjuntado a
 * la conversación (`evaluar_intencion_usuario`) del que solo leíamos los
 * argumentos, sin devolver nunca su `function_call_output`. OpenAI persistía
 * ese `function_call` dentro de la conversación y cualquier turno posterior que
 * la cargara —p. ej. la propuesta estructurada en background— fallaba con
 * `400 No tool output found for function call call_…`.
 *
 * La causa raíz ya está corregida (la clasificación es sin estado), pero las
 * conversaciones creadas antes del arreglo pueden seguir contaminadas en el
 * servidor de OpenAI. Esta función las sana justo antes de volver a llamar a la
 * API.
 *
 * Es seguro borrar cualquier `function_call` presente: el único tool de función
 * de este flujo era el de intención (ya desacoplado de la conversación); los
 * tools alojados (`web_search`, `file_search`) aparecen como otros tipos de
 * ítem y son autocontenidos, así que nunca quedan huérfanos.
 *
 * Es defensiva: cualquier fallo se registra y se ignora para no bloquear la
 * generación. Devuelve cuántos ítems eliminó.
 */
export async function pruneOrphanFunctionCalls(
  openai: OpenAI,
  conversationId: string,
): Promise<number> {
  try {
    const functionCalls: Array<{ id: string; callId: string }> = []
    const satisfiedCallIds = new Set<string>()

    // La API pagina los ítems; el iterador async recorre todas las páginas.
    for await (const item of openai.conversations.items.list(conversationId)) {
      const it = item as { type?: string; id?: string; call_id?: string }
      if (it.type === 'function_call' && it.id && it.call_id) {
        functionCalls.push({ id: it.id, callId: it.call_id })
      } else if (it.type === 'function_call_output' && it.call_id) {
        satisfiedCallIds.add(it.call_id)
      }
    }

    const orphans = functionCalls.filter(
      (call) => !satisfiedCallIds.has(call.callId),
    )

    for (const orphan of orphans) {
      try {
        await openai.conversations.items.delete(orphan.id, {
          conversation_id: conversationId,
        })
      } catch (err) {
        console.error(
          `[heal] No se pudo eliminar el function_call huérfano ${orphan.id}:`,
          err,
        )
      }
    }

    if (orphans.length > 0) {
      console.log(
        `[heal] Conversación ${conversationId}: eliminados ${orphans.length} function_call huérfanos.`,
      )
    }

    return orphans.length
  } catch (err) {
    console.error(
      `[heal] No se pudo sanear la conversación ${conversationId}:`,
      err,
    )
    return 0
  }
}

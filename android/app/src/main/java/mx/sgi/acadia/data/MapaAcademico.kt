package mx.sgi.acadia.data

import kotlinx.serialization.json.*

data class CeldaMapa(val ciclo: Int?, val bloque: String?)

fun Registro.celdaMapa() =
    CeldaMapa(
        (get("numero_ciclo") as? JsonPrimitive)?.intOrNull,
        texto("linea_plan_id").ifBlank { null },
    )

/** Reject moves that would make the DB's cleanup trigger silently discard prerequisites. */
fun validarMovimientoMapa(
    asignatura: Registro,
    destino: CeldaMapa,
    todas: List<Registro>,
    ciclos: Int,
): String? {
    if (destino.ciclo != null && destino.ciclo !in 1..ciclos) return "Selecciona un ciclo válido."
    if (destino.ciclo == null && destino.bloque != null)
        return "Una asignatura sin ciclo no puede tener bloque."
    if (asignatura.texto("estado") == "archivada") return "Restaura la asignatura antes de moverla."
    if (asignatura.celdaMapa().ciclo == destino.ciclo) return null
    val anterior = todas.find { it.id == asignatura.texto("prerrequisito_asignatura_id") }
    val dependientes = todas.filter { it.texto("prerrequisito_asignatura_id") == asignatura.id }
    if (destino.ciclo == null && (anterior != null || dependientes.isNotEmpty()))
        return "Esta asignatura participa en una seriación. Ajusta sus prerrequisitos antes de dejarla sin ciclo."
    if (
        destino.ciclo != null &&
            anterior != null &&
            anterior.numero("numero_ciclo") >= destino.ciclo
    )
        return "Debe quedar después de ${anterior.nombre}. No se modificó la seriación."
    val conflicto = dependientes.firstOrNull {
        it.celdaMapa().ciclo?.let { ciclo -> ciclo <= (destino.ciclo ?: 0) } == true
    }
    if (conflicto != null)
        return "Debe quedar antes de ${conflicto.nombre}. No se modificó la seriación."
    return null
}

fun moverEnMapa(expediente: Expediente, id: String, destino: CeldaMapa): Expediente =
    expediente.copy(
        asignaturas =
            expediente.asignaturas.map {
                if (it.id != id) it
                else
                    JsonObject(
                        it +
                            objeto(
                                "numero_ciclo" to destino.ciclo,
                                "linea_plan_id" to destino.bloque,
                            )
                    )
            }
    )

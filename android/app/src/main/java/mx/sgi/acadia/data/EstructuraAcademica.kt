package mx.sgi.acadia.data

import kotlinx.serialization.json.*

data class CampoEstructura(
    val clave: String,
    val titulo: String,
    val tipo: String,
    val requerido: Boolean,
    val definicion: Registro,
)

/** El orden de properties es el mismo que publica el editor web de estructuras. */
fun camposEstructura(estructura: Registro): List<CampoEstructura> {
    val esquema = estructura.objeto("definicion")
    val requeridos =
        (esquema["required"] as? JsonArray)
            ?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }
            ?.toSet()
            .orEmpty()
    return esquema.objeto("properties").mapNotNull { (clave, valor) ->
        val campo = valor as? JsonObject ?: return@mapNotNull null
        val tipo =
            when {
                campo["enum"] is JsonArray -> "Opciones"
                campo.texto("type") in listOf("integer", "number") -> "Número"
                campo.texto("type") == "boolean" -> "Sí / No"
                campo.texto("type") == "array" -> "Lista"
                campo.texto("type") == "object" -> "Grupo"
                else -> "Texto enriquecido"
            }
        CampoEstructura(
            clave,
            campo.texto("title").ifBlank { clave.replace('_', ' ') },
            tipo,
            clave in requeridos,
            campo,
        )
    }
}

fun estructuraAsignaturaVinculada(estructura: Registro): Registro? =
    when (val vinculada = estructura["estructuras_asignatura"]) {
        is JsonObject -> vinculada
        is JsonArray -> vinculada.firstOrNull() as? JsonObject
        else -> null
    }

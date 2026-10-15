package mx.sgi.acadia.data

import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.util.UUID
import kotlinx.coroutines.sync.Mutex
import kotlinx.serialization.json.*

// Same durable deadline as src/lib/chat-generation-state.ts. This is presentation only;
// only the server may decide whether a published provider response succeeded or failed.
const val PLAZO_CHAT_SIN_PUBLICAR_MS = 60L * 60 * 1_000

fun vencimientoChatSinPublicar(mensaje: Registro): Long? {
    if (mensaje.texto("estado").uppercase() !in setOf("PROCESANDO", "PENDIENTE")) return null
    val respuestaId = mensaje["openai_response_id"]
    if (respuestaId is JsonPrimitive && respuestaId.isString) return null
    val fecha = mensaje.texto("fecha_actualizacion").ifBlank { mensaje.texto("fecha_creacion") }
    val instante =
        runCatching { Instant.parse(fecha) }
            .getOrElse {
                // PostgREST also returns timestamp-without-time-zone columns; these DB timestamps
                // use UTC.
                runCatching { LocalDateTime.parse(fecha).toInstant(ZoneOffset.UTC) }.getOrNull()
            } ?: return null
    return instante.toEpochMilli() + PLAZO_CHAT_SIN_PUBLICAR_MS
}

fun chatSinPublicarCaducado(mensaje: Registro, ahora: Long = System.currentTimeMillis()): Boolean =
    vencimientoChatSinPublicar(mensaje)?.let { ahora >= it } == true

fun chatEnProceso(mensaje: Registro, ahora: Long = System.currentTimeMillis()): Boolean =
    mensaje.texto("estado").uppercase() in setOf("PROCESANDO", "PENDIENTE") &&
        !chatSinPublicarCaducado(mensaje, ahora)

data class RecomendacionChat(val grupo: String, val indice: Int, val datos: Registro) {
    val clave
        get() = "$grupo:$indice"

    val aplicada
        get() = datos.booleano("aplicada")

    val tipo
        get() =
            when {
                grupo == "recommendations" -> "campo"
                // The current edge payload spreads the subject's academic `tipo` after the action
                // tag.
                datos.texto("tipo") in setOf("OBLIGATORIA", "OPTATIVA", "TRONCAL", "OTRA") &&
                    datos.nombre.isNotBlank() -> "asignatura"
                else -> datos.texto("tipo")
            }

    val titulo
        get() =
            when (tipo) {
                "campo" ->
                    datos.texto("campo_afectado").replace('_', ' ').replaceFirstChar {
                        it.uppercase()
                    }
                "bibliografia" -> datos.texto("titulo")
                "linea" -> datos.nombre
                "eliminar_linea" -> "Eliminar ${datos.texto("linea_nombre")}"
                "asignacion",
                "cambio_ciclo" -> datos.texto("asignatura_nombre")
                else -> datos.nombre.ifBlank { "Recomendación académica" }
            }
}

fun recomendacionesChat(mensaje: Registro): List<RecomendacionChat> =
    if (mensaje.texto("estado") != "COMPLETADO" || mensaje.booleano("is_refusal")) emptyList()
    else
        listOf("recommendations", "action_proposals").flatMap { grupo ->
            mensaje.objeto("propuesta").lista(grupo).mapIndexed { indice, datos ->
                RecomendacionChat(grupo, indice, datos)
            }
        }

fun valorPropuestoChat(valor: JsonElement?): JsonElement {
    if (valor == null || valor == JsonNull) return JsonNull
    if (valor !is JsonPrimitive || !valor.isString) return valor
    return runCatching { Json.parseToJsonElement(valor.content) }.getOrElse { valor }
}

/** Mirrors the web's canonical columns; arbitrary model keys can only enter `datos`. */
fun parcheRecomendacionChat(
    entidad: Registro,
    asignatura: Boolean,
    recomendacion: Registro,
): Registro {
    val clave = recomendacion.texto("campo_afectado")
    require(clave.isNotBlank()) { "La recomendación no identifica un campo." }
    val valor = valorPropuestoChat(recomendacion["texto_mejora"])
    require(valor != JsonNull) { "La recomendación no tiene contenido." }
    if (asignatura && clave in setOf("contenido_tematico", "criterios_de_evaluacion")) {
        require(valor is JsonArray) { "La recomendación no contiene una lista válida." }
        if (clave == "criterios_de_evaluacion") {
            val criterios = valor.mapNotNull { it as? JsonObject }
            require(criterios.size == valor.size) { "Revisa los criterios propuestos." }
            val error = Validacion.evaluacion(criterios)
            require(error == null) { error.orEmpty() }
        }
        return objeto(clave to valor)
    }
    val datos = entidad.objeto("datos")
    val anterior = datos[clave]
    val siguiente =
        if (!asignatura && anterior is JsonObject && "description" in anterior)
            JsonObject(anterior + objeto("description" to valor))
        else valor
    val cambio = objeto("datos" to JsonObject(datos + (clave to siguiente)))
    if (asignatura && clave == "ciclo") {
        val ciclo =
            (valor as? JsonPrimitive)?.content?.let { Regex("\\d+").find(it)?.value?.toIntOrNull() }
        require(ciclo != null && ciclo > 0) { "La recomendación no contiene un ciclo válido." }
        return JsonObject(cambio + objeto("numero_ciclo" to ciclo))
    }
    return cambio
}

fun idAplicacionChat(mensajeId: String, clave: String): String =
    UUID.nameUUIDFromBytes("acadia:chat:$mensajeId:$clave".toByteArray(Charsets.UTF_8)).toString()

fun parcheMovimientoChat(
    tipo: String,
    propuesta: Registro,
    numeroCiclos: Int,
    bloques: List<Registro>,
): Registro =
    when (tipo) {
        "asignacion" -> {
            val bloqueId = propuesta.texto("linea_plan_id")
            require(bloques.any { it.id == bloqueId }) {
                "El bloque propuesto ya no pertenece al plan."
            }
            // The proposal's cycle is historical context, not part of a block assignment.
            objeto("linea_plan_id" to bloqueId)
        }
        "cambio_ciclo" -> {
            val ciclo = propuesta.numero("numero_ciclo")
            require(ciclo in 1..numeroCiclos) { "El ciclo propuesto no pertenece al plan." }
            objeto("numero_ciclo" to ciclo)
        }
        else -> throw IllegalArgumentException("La recomendación no contiene un movimiento válido.")
    }

/** Draft slots use SavedStateHandle in the UI; no conversation is persisted on the server. */
class BorradoresConsultaChat(
    private val leer: (String) -> String?,
    private val guardar: (String, String) -> Unit,
) {
    private fun clave(id: String?) = "consulta_borrador:${id ?: "nuevo"}"

    fun restaurar(id: String?, legado: String = ""): String = leer(clave(id)) ?: legado

    fun escribir(id: String?, texto: String) = guardar(clave(id), texto)

    fun cambiar(actualId: String?, destinoId: String?, textoActual: String): String {
        escribir(actualId, textoActual)
        return restaurar(destinoId)
    }

    fun vincularConversacionCreada(id: String, texto: String) {
        escribir(id, texto)
        escribir(null, "")
    }
}

/** The conversation is a local draft until a real send. Failed sends retain its id for retry. */
class BorradorChat(
    var conversacionId: String? = null,
    private val guardarId: (String) -> Unit = {},
) {
    private val envio = Mutex()

    suspend fun enviar(
        texto: String,
        crear: suspend (String) -> String,
        enviar: suspend (String, String) -> Unit,
    ): Boolean {
        val consulta = texto.trim()
        if (consulta.isBlank() || !envio.tryLock()) return false
        try {
            val id =
                conversacionId
                    ?: crear(consulta).also {
                        require(it.isNotBlank()) { "No se pudo abrir la conversación." }
                        conversacionId = it
                        guardarId(it)
                    }
            enviar(id, consulta)
            return true
        } finally {
            envio.unlock()
        }
    }
}

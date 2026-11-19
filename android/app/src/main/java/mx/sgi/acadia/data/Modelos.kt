package mx.sgi.acadia.data

import java.text.Normalizer
import kotlinx.serialization.json.*

typealias Registro = JsonObject

fun Registro.texto(clave: String, defecto: String = ""): String =
    (get(clave) as? JsonPrimitive)?.contentOrNull ?: defecto

fun Registro.numero(clave: String, defecto: Int = 0): Int =
    (get(clave) as? JsonPrimitive)?.intOrNull ?: defecto

fun Registro.decimal(clave: String): Double = (get(clave) as? JsonPrimitive)?.doubleOrNull ?: 0.0

fun Registro.booleano(clave: String): Boolean =
    (get(clave) as? JsonPrimitive)?.booleanOrNull ?: false

fun Registro.objeto(clave: String): Registro = get(clave) as? JsonObject ?: JsonObject(emptyMap())

fun Registro.lista(clave: String): List<Registro> =
    (get(clave) as? JsonArray)?.mapNotNull { it as? JsonObject } ?: emptyList()

val Registro.id: String
    get() = texto("id")
val Registro.nombre: String
    get() =
        texto("nombre_display").ifBlank {
            texto("nombre").ifBlank { texto("titulo").ifBlank { texto("etiqueta") } }
        }

val Registro.nombreCriterio: String
    get() = texto("criterio").ifBlank { texto("nombre") }

fun objeto(vararg valores: Pair<String, Any?>): Registro = buildJsonObject {
    valores.forEach { (key, value) ->
        put(
            key,
            when (value) {
                null -> JsonNull
                is JsonElement -> value
                is Boolean -> JsonPrimitive(value)
                is Number -> JsonPrimitive(value)
                else -> JsonPrimitive(value.toString())
            },
        )
    }
}

fun normalizarBusqueda(texto: String): String =
    Normalizer.normalize(texto, Normalizer.Form.NFD)
        .replace("\\p{M}+".toRegex(), "")
        .lowercase()
        .trim()

enum class Permiso(val clave: String) {
    VerPlanes("planes.ver"),
    CrearPlanes("planes.crear"),
    EditarPlanes("planes.editar"),
    VerAsignaturas("asignaturas.ver"),
    EditarAsignaturas("asignaturas.editar"),
    GestionarResponsables("asignaturas.responsables.gestionar"),
    Comentar("comentarios.crear"),
    Catalogos("catalogos.gestionar"),
    Usuarios("usuarios.ver"),
    GestionarUsuarios("usuarios.gestionar"),
    IA("ia.usar"),
    Auditoria("auditoria.ver"),
    Archivos("archivos.ver"),
}

data class Sesion(
    val id: String,
    val nombre: String,
    val correo: String,
    val roles: Set<String>,
    val permisos: Set<String>,
) {
    fun permite(permiso: Permiso) = "ADMIN" in roles || permiso.clave in permisos
}

data class Expediente(
    val registro: Registro,
    val asignaturas: List<Registro> = emptyList(),
    val bloques: List<Registro> = emptyList(),
    val bibliografia: List<Registro> = emptyList(),
    val comentarios: List<Registro> = emptyList(),
    val historial: List<Registro> = emptyList(),
    val transiciones: List<Registro> = emptyList(),
    val editable: Boolean = false,
)

enum class CategoriaError {
    Red,
    Credenciales,
    Permiso,
    Validacion,
    Conflicto,
    Servidor,
}

class FalloAcad(
    val categoria: CategoriaError,
    override val message: String,
    causa: Throwable? = null,
) : Exception(message, causa)

/** Validation is shared by forms and tests; the database remains authoritative. */
object Validacion {
    fun fechaCurricular(
        valor: String,
        hoy: java.time.LocalDate = java.time.LocalDate.now(),
    ): String? =
        try {
            if (java.time.LocalDate.parse(valor).isBefore(hoy.withDayOfMonth(1)))
                "Las cargas históricas requieren confirmación en la versión web."
            else null
        } catch (_: java.time.format.DateTimeParseException) {
            "Usa una fecha válida con formato AAAA-MM-DD."
        }

    fun nombre(valor: String): String? = if (valor.isBlank()) "Escribe un nombre." else null

    fun horas(valor: String): String? =
        if (valor.toIntOrNull()?.let { it >= 0 } == true) null
        else "Usa un número entero mayor o igual a cero."

    fun evaluacion(criterios: List<Registro>): String? =
        when {
            criterios.isEmpty() -> "Añade al menos un criterio."
            criterios.any { it.nombreCriterio.isBlank() } ->
                "Todos los criterios necesitan un nombre."
            criterios.any {
                !it.decimal("porcentaje").isFinite() ||
                    it.decimal("porcentaje") !in 1.0..100.0 ||
                    it.decimal("porcentaje") % 1.0 != 0.0
            } -> "Usa porcentajes enteros entre 1 y 100."
            kotlin.math.abs(criterios.sumOf { it.decimal("porcentaje") } - 100) > 0.001 ->
                "Los porcentajes deben sumar 100 %."
            else -> null
        }

    fun localUrl(url: String): Boolean = runCatching {
        val parsed = java.net.URI(url)
        parsed.scheme == "http" && parsed.host in setOf("10.0.2.2", "127.0.0.1", "localhost")
    }
        .getOrDefault(false)
}

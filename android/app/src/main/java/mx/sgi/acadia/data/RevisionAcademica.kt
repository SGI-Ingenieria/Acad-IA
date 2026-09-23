package mx.sgi.acadia.data

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

enum class TipoAccionRevision {
    Enviar,
    Aprobar,
    Devolver,
    Reabrir,
    Rechazar,
}

data class AccionRevision(
    val destinoId: String,
    val etiqueta: String,
    val tipo: TipoAccionRevision,
    val requiereComentario: Boolean,
    val requiereRegistroOficial: Boolean = false,
)

fun revisionCerrada(expediente: Expediente, asignatura: Boolean): Boolean =
    asignatura && expediente.registro.texto("estado").equals("aprobada", ignoreCase = true)

/** Only describes destinations already authorized by the server; never invents permissions. */
fun accionesRevision(expediente: Expediente, asignatura: Boolean): List<AccionRevision> {
    val actual = expediente.registro.objeto("estados_plan")
    val estadoAsignatura = expediente.registro.texto("estado")
    return expediente.transiciones
        .sortedWith(
            compareBy<Registro> {
                    val clave = it.texto("clave").ifBlank { it.id }.uppercase()
                    when {
                        clave == "RECHAZADO" -> 3
                        clave == "BORRADOR" ||
                            (!asignatura && it.numero("orden") <= actual.numero("orden")) -> 2
                        else -> 0
                    }
                }
                .thenBy { it.numero("orden") }
        )
        .map { destino ->
            val clave = destino.texto("clave").ifBlank { destino.id }.uppercase()
            val devolver =
                clave == "BORRADOR" ||
                    (!asignatura &&
                        clave != "RECHAZADO" &&
                        destino.numero("orden") <= actual.numero("orden"))
            val tipo =
                when {
                    revisionCerrada(expediente, asignatura) && clave == "BORRADOR" ->
                        TipoAccionRevision.Reabrir
                    clave == "RECHAZADO" -> TipoAccionRevision.Rechazar
                    devolver -> TipoAccionRevision.Devolver
                    clave in setOf("APROBADO", "APROBADA") -> TipoAccionRevision.Aprobar
                    else -> TipoAccionRevision.Enviar
                }
            val destinoLegible =
                when (clave) {
                    "REVISION" -> "revisión con el secretario académico"
                    "REV_PLANEACION" -> "Planeación Curricular"
                    "REV_VICERRECTORIA" -> "Vicerrectoría Académica"
                    "CONSULTA_EXPERTOS" -> "consulta con expertos externos"
                    "REV_SEDES" -> "revisión de otras sedes"
                    "CONSEJO_FACULTAD" -> "Consejo Académico de Facultad"
                    "CONSEJO_UNIVERSITARIO" -> "Consejo Universitario"
                    "JUNTA_GOBIERNO" -> "Junta de Gobierno"
                    "ENVIADO_SEP" -> "diálogo por ACERT"
                    else -> destino.texto("etiqueta").ifBlank { etiquetaEstadoRevision(clave) }
                }
            val etiqueta =
                when {
                    asignatura && clave == "BORRADOR" ->
                        if (estadoAsignatura == "aprobada") "Reabrir asignatura"
                        else "Pedir cambios"
                    asignatura && clave == "REVISADA" -> "Enviar asignatura a revisión"
                    asignatura && clave == "APROBADA" -> "Aprobar asignatura"
                    clave == "BORRADOR" -> "Devolver al jefe de carrera para corrección"
                    tipo == TipoAccionRevision.Rechazar -> "Rechazar plan"
                    tipo == TipoAccionRevision.Aprobar -> "Registrar aprobación del plan"
                    devolver -> "Devolver a $destinoLegible"
                    else -> "Enviar a $destinoLegible"
                }
            AccionRevision(
                destino.id,
                etiqueta,
                tipo,
                requiereComentario = clave in setOf("BORRADOR", "RECHAZADO"),
                requiereRegistroOficial =
                    !asignatura &&
                        clave == "APROBADO" &&
                        expediente.registro.objeto("estructuras_plan").texto("tipo") ==
                            "CURRICULAR",
            )
        }
}

fun etiquetaEstadoRevision(clave: String): String =
    when (clave.lowercase()) {
        "borrador" -> "Borrador"
        "revisada" -> "En revisión"
        "aprobada",
        "aprobado" -> "Aprobada"
        "generando" -> "Generando con IA"
        "fallida" -> "Generación fallida"
        "archivada" -> "Archivada"
        else -> clave.replace('_', ' ').lowercase().replaceFirstChar { it.uppercase() }
    }

fun inicialesAutor(nombre: String): String =
    nombre
        .trim()
        .split(Regex("\\s+"))
        .filter { it.isNotBlank() }
        .take(2)
        .joinToString("") { it.take(1).uppercase() }
        .ifBlank { "AC" }

private val idiomaAcademico = Locale.forLanguageTag("es-MX")

fun fechaAcademica(valor: String, zona: ZoneId = ZoneId.systemDefault()): String = runCatching {
    DateTimeFormatter.ofPattern("d MMM yyyy · HH:mm", idiomaAcademico)
        .format(Instant.parse(valor).atZone(zona))
}
    .getOrElse { valor.take(16).replace('T', ' ').ifBlank { "Fecha no disponible" } }

fun diaHistorial(valor: String, zona: ZoneId = ZoneId.systemDefault()): String = runCatching {
    Instant.parse(valor).atZone(zona).toLocalDate().toString()
}
    .getOrElse { valor.take(10) }

fun etiquetaDiaHistorial(dia: String): String = runCatching {
    DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy", idiomaAcademico)
        .format(LocalDate.parse(dia))
}
    .getOrElse { "Fecha no disponible" }

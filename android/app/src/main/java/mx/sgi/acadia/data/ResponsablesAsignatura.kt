package mx.sgi.acadia.data

data class DatosResponsables(
    val responsables: List<Registro>,
    val usuarios: List<Registro>,
    val puedeGestionar: Boolean,
    val puedeInvitar: Boolean,
    val errorDirectorio: String? = null,
    val puedeConsultarDirectorio: Boolean = true,
)

/** An acknowledged email invitation must never be repeated when only assignment failed. */
suspend fun completarInvitacionProfesor(
    invitadoPendiente: Registro?,
    invitar: suspend () -> Registro,
    recordarInvitado: (Registro) -> Unit,
    asignar: suspend (String) -> Unit,
) {
    val invitado = invitadoPendiente ?: invitar().also(recordarInvitado)
    try {
        asignar(invitado.id)
    } catch (e: kotlinx.coroutines.CancellationException) {
        throw e
    } catch (e: Exception) {
        throw FalloAcad(
            CategoriaError.Conflicto,
            "La invitación ya fue enviada. Falta asignar al profesor a esta asignatura. Puedes reintentar sin enviar otro correo.",
            e,
        )
    }
}

fun candidatosResponsables(datos: DatosResponsables, busqueda: String): List<Registro> {
    val asignados =
        datos.responsables
            .filter { it.texto("rol") == "PROFESOR_RESPONSABLE" }
            .map { it.texto("usuario_id") }
            .toSet()
    val consulta = normalizarBusqueda(busqueda)
    return datos.usuarios
        .filter {
            !it.booleano("externo") &&
                it.texto("dado_de_baja_en").isBlank() &&
                it.id !in asignados &&
                normalizarBusqueda("${it.texto("nombre_completo")} ${it.texto("email")}")
                    .contains(consulta)
        }
        .sortedBy { normalizarBusqueda(it.texto("nombre_completo")) }
}

fun validarInvitacionProfesor(nombre: String, correo: String): String? =
    when {
        nombre.isBlank() -> "Escribe el nombre del profesor."
        !Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(correo.trim()) ->
            "Escribe un correo válido."
        else -> null
    }

fun etiquetaRolResponsable(rol: String): String =
    when (rol) {
        "PROFESOR_RESPONSABLE" -> "Profesor responsable"
        "COAUTOR" -> "Coautor"
        "REVISOR" -> "Revisor"
        else -> "Responsable"
    }

package mx.sgi.acadia.data

/**
 * Compact program identity from catalogo_asignaturas_buscar, without repeating faculty or cohort.
 */
fun nombrePlanAsignatura(asignatura: Registro): String {
    val nombrePlan = asignatura.texto("plan_nombre").trim()
    val carrera = asignatura.texto("carrera_nombre").trim()
    if (
        !asignatura.texto("plan_tipo_estructura").trim().equals("CURRICULAR", true) ||
            carrera.isBlank()
    )
        return nombrePlan
    return nombreCarrera(
        objeto("nombre" to carrera, "nivel" to asignatura.texto("carrera_nivel").trim())
    )
}

/** Mirrors ciclo-utils.ts: "Otro" is a generic cycle, not a duration or a count. */
fun etiquetaCicloAsignatura(asignatura: Registro): String {
    val tipo =
        asignatura.texto("plan_tipo_ciclo").trim().let {
            if (it.isBlank() || it.equals("Otro", true)) "Ciclo" else it
        }
    val numero = asignatura.numero("numero_ciclo").takeIf { it > 0 }
    return if (numero != null) "$tipo $numero" else "Sin ${tipo.lowercase()} asignado"
}

fun etiquetaCreditosAsignatura(asignatura: Registro): String {
    val creditos = asignatura.texto("creditos").trim().toBigDecimalOrNull() ?: return ""
    if (creditos.signum() < 0) return ""
    val numero = creditos.stripTrailingZeros().toPlainString()
    return "$numero ${if (numero == "1") "crédito" else "créditos"}"
}

package mx.sgi.acadia.data

/** Monotonic markers only: entity records remain owned by each screen's authoritative query. */
internal fun avanzarRevisiones(
    actuales: Map<String, Long>,
    tablas: Collection<String>,
): Map<String, Long> =
    actuales +
        tablas.filter(String::isNotBlank).distinct().associateWith { (actuales[it] ?: 0L) + 1L }

internal fun revisionesObservadas(
    actuales: Map<String, Long>,
    tablas: Collection<String>,
): List<Long> = tablas.distinct().sorted().map { actuales[it] ?: 0L }

internal fun puedeReintentarTiempoReal(error: Throwable, intento: Long): Boolean {
    if (intento >= 5) return false
    return generateSequence(error) { it.cause }
        .any {
            it is java.io.IOException ||
                it is io.ktor.client.plugins.HttpRequestTimeoutException ||
                (it is io.ktor.client.plugins.ResponseException &&
                    it.response.status.value in setOf(408, 429, 500, 502, 503, 504))
        }
}

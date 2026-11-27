package mx.sgi.acadia.data

import kotlinx.serialization.json.*

enum class FuenteBibliografia(val etiqueta: String) {
    Manual("Manual"),
    Biblioteca("Biblioteca"),
    EnLinea("En línea"),
}

fun Registro.textos(clave: String): List<String> =
    (get(clave) as? JsonArray)
        ?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }
        ?.filter { it.isNotBlank() }
        .orEmpty()

/** Same provider contracts as the web wizard. Missing source metadata stays missing. */
fun normalizarReferencia(fuente: FuenteBibliografia, resultado: Registro): Registro {
    val biblioteca = fuente == FuenteBibliografia.Biblioteca
    val google = resultado.texto("endpoint") == "google"
    val original = if (biblioteca) resultado else resultado.objeto("item")
    val info = if (google) original.objeto("volumeInfo") else original
    val autores =
        when {
            biblioteca -> listOf(info.texto("autor")).filter(String::isNotBlank)
            google -> info.textos("authors")
            else -> info.textos("author_name")
        }
    val anioTexto =
        when {
            biblioteca -> info.texto("anio")
            google -> info.texto("publishedDate")
            else ->
                info
                    .texto("first_publish_year")
                    .ifBlank {
                        (info["publish_year"] as? JsonArray)
                            ?.mapNotNull { (it as? JsonPrimitive)?.intOrNull }
                            ?.maxOrNull()
                            ?.toString()
                            .orEmpty()
                    }
                    .ifBlank { info.texto("publish_date") }
        }
    val isbn =
        when {
            biblioteca -> info.texto("isbn")
            google ->
                info.lista("industryIdentifiers").let { identificadores ->
                    (identificadores.find { it.texto("type") == "ISBN_13" }
                            ?: identificadores.find { it.texto("type") == "ISBN_10" })
                        ?.texto("identifier")
                        .orEmpty()
                }
            else -> info.textos("isbn").firstOrNull().orEmpty()
        }
    val titulo = if (biblioteca) info.texto("titulo") else info.texto("title")
    val subtitulo = if (biblioteca) "" else info.texto("subtitle")
    val referencia =
        when {
            biblioteca -> null
            google ->
                // Persist the provider identity, not a regional preview URL. The identity also
                // preserves read-only provenance when fuente_busqueda is no longer in memory.
                original.id.takeIf { it.matches(Regex("[A-Za-z0-9_-]+")) }?.let { "google:$it" }
                    ?: info
                        .texto("previewLink")
                        .ifBlank { info.texto("infoLink") }
                        .ifBlank { original.texto("selfLink") }
            else ->
                original
                    .texto("key")
                    .takeIf { it.startsWith("/works/") || it.startsWith("/books/") }
                    ?.let { "open_library:$it" }
        }
    val normalizada =
        objeto(
            "titulo" to
                listOf(titulo.trim(), subtitulo.trim())
                    .filter(String::isNotBlank)
                    .joinToString(": "),
            "autores" to JsonArray(autores.map(::JsonPrimitive)),
            "editorial" to
                when {
                    biblioteca -> info.texto("editorial")
                    google -> info.texto("publisher")
                    else ->
                        info.textos("publisher").firstOrNull().orEmpty().ifBlank {
                            info.texto("publisher")
                        }
                },
            "anio" to Regex("\\d{4}").find(anioTexto)?.value?.toIntOrNull(),
            "isbn" to isbn,
            "referencia_biblioteca" to if (biblioteca) original.id else null,
            "referencia_en_linea" to referencia?.takeIf { it.isNotBlank() },
            "fuente_busqueda" to
                when {
                    biblioteca -> "Biblioteca La Salle"
                    google -> "Google Books"
                    else -> "Open Library"
                },
            "tipo_obra" to
                if (google && info.texto("printType").let { it.isNotBlank() && it != "BOOK" })
                    "publicacion_periodica"
                else "libro",
        )
    val citaOriginal = info.texto("cita").ifBlank { original.texto("cita") }
    return if (citaOriginal.isBlank()) normalizada
    else
        JsonObject(
            normalizada +
                objeto(
                    "cita" to citaOriginal,
                    "formato" to
                        info
                            .texto("formato")
                            .ifBlank { original.texto("formato") }
                            .takeIf(String::isNotBlank),
                )
        )
}

fun resultadosReferencias(fuente: FuenteBibliografia, respuesta: JsonElement): List<Registro> {
    require(fuente != FuenteBibliografia.Manual) { "La captura manual no requiere una búsqueda." }
    val arreglo =
        if (fuente == FuenteBibliografia.Biblioteca)
            (respuesta as? JsonObject)?.get("results") as? JsonArray
        else respuesta as? JsonArray
    requireNotNull(arreglo) {
        "La búsqueda devolvió una respuesta incompleta. Inténtalo nuevamente."
    }
    return arreglo.map { elemento ->
        val registro =
            requireNotNull(elemento as? JsonObject) {
                "La búsqueda devolvió una referencia incompleta."
            }
        if (fuente == FuenteBibliografia.EnLinea)
            require(
                registro.texto("endpoint") in setOf("google", "open_library") &&
                    registro["item"] is JsonObject
            ) {
                "La búsqueda devolvió una fuente desconocida. Inténtalo nuevamente."
            }
        normalizarReferencia(fuente, registro)
    }
}

val formatosBibliograficos =
    listOf("apa" to "APA", "ieee" to "IEEE", "vancouver" to "Vancouver", "chicago" to "Chicago")

/** A manually entered URL alone does not turn a manual reference into an imported record. */
fun Registro.esReferenciaConsultada(): Boolean {
    if (texto("referencia_biblioteca").isNotBlank() || texto("fuente_busqueda").isNotBlank())
        return true
    val referencia = texto("referencia_en_linea")
    if (referencia.startsWith("google:") || referencia.startsWith("open_library:")) return true
    val host = runCatching { java.net.URI(referencia).host?.lowercase() }.getOrNull()
    return host in
        setOf("books.google.com", "books.google.com.mx", "www.googleapis.com", "openlibrary.org")
}

private data class AutorBibliografico(val apellido: String, val nombres: String) {
    fun iniciales(separador: String = ". ", guion: Boolean = true): String =
        nombres
            .trim()
            .split(Regex("\\s+"))
            .filter(String::isNotBlank)
            .joinToString(separador) {
                it.split('-').filter(String::isNotBlank).joinToString(
                    if (guion) "${separador.trimEnd()}-" else ""
                ) { parte ->
                    parte.first().uppercase()
                }
            }
            .let { if (it.isNotBlank() && separador.isNotBlank()) it + separador.trimEnd() else it }

    fun invertido(): String =
        listOf(apellido, nombres).filter(String::isNotBlank).joinToString(", ")

    fun natural(): String = listOf(nombres, apellido).filter(String::isNotBlank).joinToString(" ")
}

/** Same author contract as citas.ts: "family, given", otherwise the final word is family. */
private fun autorBibliografico(texto: String): AutorBibliografico {
    val limpio = texto.trim().replace(Regex("\\s+"), " ")
    if (',' in limpio)
        return AutorBibliografico(
            limpio.substringBefore(',').trim(),
            limpio.substringAfter(',').substringBefore(',').trim(),
        )
    val partes = limpio.split(' ')
    return AutorBibliografico(partes.last(), partes.dropLast(1).joinToString(" "))
}

private fun String.conPunto(): String =
    if (lastOrNull() in listOf('.', '?', '!')) this else "$this."

private fun unirAutores(
    autores: List<String>,
    conjuncion: String,
    comaConDos: Boolean = false,
): String =
    when (autores.size) {
        0 -> ""
        1 -> autores.first()
        2 -> autores.first() + (if (comaConDos) ", " else " ") + conjuncion + " " + autores.last()
        else -> autores.dropLast(1).joinToString(", ") + ", $conjuncion " + autores.last()
    }

/** Book-title capitalization for the project's Chicago style; source metadata is never changed. */
private fun tituloChicago(titulo: String): String {
    val menores =
        setOf(
            "a",
            "an",
            "the",
            "and",
            "but",
            "or",
            "nor",
            "for",
            "so",
            "yet",
            "at",
            "by",
            "in",
            "of",
            "on",
            "to",
            "up",
            "via",
            "with",
            "de",
            "van",
            "von",
        )
    val palabras = Regex("[\\p{L}][\\p{L}\\p{M}'’-]*").findAll(titulo).toList()
    return Regex("[\\p{L}][\\p{L}\\p{M}'’-]*").replace(titulo) { coincidencia ->
        val palabra = coincidencia.value
        val primera = coincidencia.range == palabras.firstOrNull()?.range
        val ultima = coincidencia.range == palabras.lastOrNull()?.range
        val trasDosPuntos = titulo.take(coincidencia.range.first).trimEnd().endsWith(':')
        if (
            palabra != palabra.lowercase() ||
                (!primera && !ultima && !trasDosPuntos && palabra in menores)
        )
            palabra
        else palabra.replaceFirstChar(Char::titlecase)
    }
}

/**
 * Native book formatter for the metadata supported by the web bibliography wizard (citas.ts). This
 * is not a general CSL engine: journal articles, edition/volume fields and in-text citations are
 * not modeled by that contract. Explicit non-book provider results require manual capture. Existing
 * source citations are preserved for their recorded format, including legacy null formats. Golden
 * tests are compared with the four repository CSL styles and the es-MX locale.
 */
fun citaBibliografica(datos: Registro, formato: String): String {
    require(
        !datos.esReferenciaConsultada() ||
            datos.texto("referencia_biblioteca").isNotBlank() ||
            (enlaceReferenciaEnLinea(datos.texto("referencia_en_linea")) != null &&
                objeto("referencia_en_linea" to datos.texto("referencia_en_linea"))
                    .esReferenciaConsultada())
    ) {
        "La fuente no incluye una referencia identificable. Elige otro resultado o usa captura manual."
    }
    val original = datos.texto("cita")
    if (original.isNotBlank() && datos.texto("formato") == formato) return original
    require(formato in formatosBibliograficos.map { it.first }) { "Selecciona un formato de cita." }
    require(datos.texto("tipo_obra", "libro") == "libro") {
        "Esta fuente es una publicación periódica. Añade su referencia con captura manual."
    }
    val titulo = datos.texto("titulo").trim()
    require(titulo.isNotBlank()) {
        "La fuente no incluye título. Elige otra referencia o usa captura manual."
    }
    val autores = datos.textos("autores").map(::autorBibliografico)
    val editorial = datos.texto("editorial").trim()
    val anio = datos.texto("anio").trim()
    require(
        anio.isBlank() ||
            anio.toIntOrNull()?.let { it in 1450..java.time.Year.now().value + 1 } == true
    ) {
        "La fuente no incluye un año válido. Elige otra referencia o usa captura manual."
    }
    val fecha = anio.ifBlank { "s/f" }
    return when (formato) {
        "apa" -> {
            val nombres = autores.map {
                listOf(it.apellido, it.iniciales()).filter(String::isNotBlank).joinToString(", ")
            }
            val autor =
                if (nombres.size >= 21)
                    nombres.take(19).joinToString(", ") + ", … " + nombres.last()
                else unirAutores(nombres, "&", true)
            listOf(
                    if (autor.isBlank()) titulo.conPunto() else autor,
                    "($fecha).",
                    if (autor.isNotBlank()) titulo.conPunto() else "",
                    editorial.takeIf(String::isNotBlank)?.conPunto().orEmpty(),
                )
                .filter(String::isNotBlank)
                .joinToString(" ")
        }
        "ieee" -> {
            val nombres = autores.map {
                listOf(it.iniciales(), it.apellido).filter(String::isNotBlank).joinToString(" ")
            }
            val autor =
                if (nombres.size >= 7) nombres.first() + " et al." else unirAutores(nombres, "y")
            val publicacion = listOf(editorial, anio).filter(String::isNotBlank).joinToString(", ")
            "[1] " +
                listOf(
                        (if (autor.isBlank()) titulo else "$autor, $titulo").conPunto(),
                        publicacion.takeIf(String::isNotBlank)?.conPunto().orEmpty(),
                    )
                    .filter(String::isNotBlank)
                    .joinToString(" ")
        }
        "vancouver" -> {
            val nombres = autores.map {
                listOf(it.apellido, it.iniciales("", false))
                    .filter(String::isNotBlank)
                    .joinToString(" ")
            }
            val autor =
                (if (nombres.size >= 7) nombres.take(6) + "et al." else nombres).joinToString(", ")
            val publicacion = listOf(editorial, anio).filter(String::isNotBlank).joinToString("; ")
            "1. " +
                listOf(
                        autor.takeIf(String::isNotBlank)?.conPunto().orEmpty(),
                        titulo.conPunto(),
                        publicacion.takeIf(String::isNotBlank)?.conPunto().orEmpty(),
                    )
                    .filter(String::isNotBlank)
                    .joinToString(" ")
        }
        else -> {
            val nombres = autores.mapIndexed { index, autor ->
                if (index == 0) autor.invertido() else autor.natural()
            }
            val autor =
                if (nombres.size >= 7) nombres.take(3).joinToString(", ") + ", et al."
                else unirAutores(nombres, "y", true)
            listOf(
                    if (autor.isBlank()) tituloChicago(titulo).conPunto() else autor.conPunto(),
                    fecha.conPunto(),
                    if (autor.isNotBlank()) tituloChicago(titulo).conPunto() else "",
                    editorial.takeIf(String::isNotBlank)?.conPunto().orEmpty(),
                )
                .filter(String::isNotBlank)
                .joinToString(" ")
        }
    }
}

fun enlaceBiblioteca(id: String): String? =
    id.trim()
        .takeIf { it.matches(Regex("\\d+")) }
        ?.let {
            "https://catalogo.biblioteca.lasalle.mx/cgi-bin/koha/opac-detail.pl?biblionumber=$it"
        }

/** Web records store provider identifiers as well as URLs. Resolve for opening, not saving. */
fun enlaceReferenciaEnLinea(valor: String): String? {
    val limpio = valor.trim()
    if (Regex("google:[A-Za-z0-9_-]+").matches(limpio))
        return "https://books.google.com/books?id=${limpio.removePrefix("google:")}"
    if (Regex("open_library:/(?:works/OL[0-9]+W|books/OL[0-9]+M)").matches(limpio))
        return "https://openlibrary.org${limpio.removePrefix("open_library:")}"
    return limpio.takeIf {
        runCatching {
                val uri = java.net.URI(it)
                uri.scheme?.lowercase() in listOf("https", "http") &&
                    !uri.host.isNullOrBlank() &&
                    uri.rawUserInfo == null
            }
            .getOrDefault(false)
    }
}

fun urlBibliograficaValida(url: String): Boolean =
    url.isBlank() || enlaceReferenciaEnLinea(url) != null

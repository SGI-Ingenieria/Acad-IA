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
                info
                    .texto("previewLink")
                    .ifBlank { info.texto("infoLink") }
                    .ifBlank { original.texto("selfLink") }
                    .ifBlank {
                        original.id.takeIf { it.isNotBlank() }?.let { "google:$it" }.orEmpty()
                    }
            else ->
                original
                    .texto("key")
                    .takeIf { it.startsWith("/works/") || it.startsWith("/books/") }
                    ?.let { "open_library:$it" }
        }
    return objeto(
        "titulo" to
            listOf(titulo.trim(), subtitulo.trim()).filter(String::isNotBlank).joinToString(": "),
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
    )
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

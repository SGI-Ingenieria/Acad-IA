package mx.sgi.acadia.data

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class BibliografiaAcademicaTest {
    private fun cadenas(vararg textos: String) = JsonArray(textos.map(::JsonPrimitive))

    @Test
    fun `Google conserva subtitulo autores y el ISBN13 preferente`() {
        val resultado =
            normalizarReferencia(
                FuenteBibliografia.EnLinea,
                objeto(
                    "endpoint" to "google",
                    "item" to
                        objeto(
                            "id" to "Tomo_1",
                            "volumeInfo" to
                                objeto(
                                    "title" to "Diseño curricular",
                                    "subtitle" to "Una investigación",
                                    "authors" to cadenas("María Silva", "Ana Pérez"),
                                    "publisher" to "Universidad",
                                    "publishedDate" to "2024-08-19",
                                    "industryIdentifiers" to
                                        JsonArray(
                                            listOf(
                                                objeto(
                                                    "type" to "ISBN_10",
                                                    "identifier" to "123456789X",
                                                ),
                                                objeto(
                                                    "type" to "ISBN_13",
                                                    "identifier" to "9781234567890",
                                                ),
                                            )
                                        ),
                                    "previewLink" to "https://books.google.com/books?id=Tomo_1",
                                ),
                        ),
                ),
            )
        assertEquals("Diseño curricular: Una investigación", resultado.texto("titulo"))
        assertEquals(listOf("María Silva", "Ana Pérez"), resultado.textos("autores"))
        assertEquals("9781234567890", resultado.texto("isbn"))
        assertEquals(2024, resultado.numero("anio"))
        assertEquals("Universidad", resultado.texto("editorial"))
        assertFalse(resultado.containsKey("cita"))
    }

    @Test
    fun `metadatos faltantes permanecen faltantes sin inventar citas`() {
        val resultado =
            normalizarReferencia(
                FuenteBibliografia.EnLinea,
                objeto("endpoint" to "google", "item" to objeto("id" to "Tomo_2")),
            )
        assertEquals("", resultado.texto("titulo"))
        assertTrue(resultado.textos("autores").isEmpty())
        assertEquals(JsonNull, resultado["anio"])
        assertEquals("google:Tomo_2", resultado.texto("referencia_en_linea"))
        assertFalse(resultado.containsKey("cita"))
    }

    @Test
    fun `Open Library conserva editorial escalar y ultimo anio disponible`() {
        val resultado =
            normalizarReferencia(
                FuenteBibliografia.EnLinea,
                objeto(
                    "endpoint" to "open_library",
                    "item" to
                        objeto(
                            "key" to "/works/OL123W",
                            "title" to "Investigación",
                            "subtitle" to "Métodos",
                            "publisher" to "Editorial Académica",
                            "author_name" to cadenas("Elena Ruiz"),
                            "publish_year" to
                                JsonArray(listOf(JsonPrimitive(2019), JsonPrimitive(2022))),
                            "isbn" to cadenas("9781234567890"),
                        ),
                ),
            )
        assertEquals("Investigación: Métodos", resultado.texto("titulo"))
        assertEquals("Editorial Académica", resultado.texto("editorial"))
        assertEquals(2022, resultado.numero("anio"))
        assertEquals("open_library:/works/OL123W", resultado.texto("referencia_en_linea"))
    }

    @Test
    fun `Open Library prefiere first publish year al arreglo de ediciones`() {
        val resultado =
            normalizarReferencia(
                FuenteBibliografia.EnLinea,
                objeto(
                    "endpoint" to "open_library",
                    "item" to
                        objeto(
                            "first_publish_year" to 1982,
                            "publish_year" to JsonArray(listOf(JsonPrimitive(2022))),
                            "publisher" to cadenas("Primera editorial", "Otra editorial"),
                        ),
                ),
            )
        assertEquals(1982, resultado.numero("anio"))
        assertEquals("Primera editorial", resultado.texto("editorial"))
    }

    @Test
    fun `la biblioteca conserva la referencia institucional original`() {
        val resultado =
            normalizarReferencia(
                FuenteBibliografia.Biblioteca,
                objeto(
                    "id" to "133034",
                    "titulo" to "Redes",
                    "autor" to "Silva, María",
                    "anio" to "c2020.",
                    "editorial" to "La Salle",
                    "isbn" to "9781234567890",
                ),
            )
        assertEquals("133034", resultado.texto("referencia_biblioteca"))
        assertEquals(JsonNull, resultado["referencia_en_linea"])
        assertEquals(listOf("Silva, María"), resultado.textos("autores"))
        assertEquals(2020, resultado.numero("anio"))
    }

    @Test
    fun `enlace institucional no acepta URLs ni parametros como biblionumber`() {
        assertEquals(
            "https://catalogo.biblioteca.lasalle.mx/cgi-bin/koha/opac-detail.pl?biblionumber=133034",
            enlaceBiblioteca(" 133034 "),
        )
        listOf(
                "",
                "https://example.com",
                "123&redirect=https://example.com",
                "../123",
                "not-a-koha-number",
            )
            .forEach {
                assertNull(enlaceBiblioteca(it))
            }
    }

    @Test
    fun `referencias heredadas de la web se abren sin reescribir el identificador`() {
        assertEquals(
            "https://openlibrary.org/works/OL123W",
            enlaceReferenciaEnLinea("open_library:/works/OL123W"),
        )
        assertEquals(
            "https://openlibrary.org/books/OL123M",
            enlaceReferenciaEnLinea("open_library:/books/OL123M"),
        )
        assertEquals(
            "https://books.google.com/books?id=Vol_1-A",
            enlaceReferenciaEnLinea("google:Vol_1-A"),
        )
        assertTrue(urlBibliograficaValida("open_library:/works/OL123W"))
        assertTrue(urlBibliograficaValida("google:Vol_1-A"))
    }

    @Test
    fun `solo se abren URLs http seguras o identificadores reconocidos`() {
        assertTrue(urlBibliograficaValida(""))
        assertTrue(urlBibliograficaValida("https://example.org/libro?q=ciencia"))
        assertTrue(urlBibliograficaValida("HTTP://example.org/libro"))
        listOf(
                "javascript:alert(1)",
                "file:///private/data",
                "content://book/1",
                "https://",
                "https://trusted.example@evil.example/",
                "open_library:/works/../../evil",
                "google:Vol1&redirect=evil",
                "open_library://evil.example/OL123W",
            )
            .forEach {
                assertFalse(it, urlBibliograficaValida(it))
                assertNull(enlaceReferenciaEnLinea(it))
            }
    }
}

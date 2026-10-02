package mx.sgi.acadia.data

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class BibliografiaAcademicaTest {
    private fun cadenas(vararg textos: String) = JsonArray(textos.map(::JsonPrimitive))

    // Golden values generated using the installed citeproc and the repository's four CSL files,
    // with public/csl/locales/locales-es-MX.xml and the same book input as citas.ts.
    @Test
    fun `citas de libros coinciden con CSL web en los cuatro formatos`() {
        val referencia =
            objeto(
                "titulo" to "Redes de comunicación",
                "autores" to cadenas("María Silva", "Pérez, Ana"),
                "editorial" to "Universidad",
                "anio" to 2020,
            )
        assertEquals(
            "Silva, M., & Pérez, A. (2020). Redes de comunicación. Universidad.",
            citaBibliografica(referencia, "apa"),
        )
        assertEquals(
            "[1] M. Silva y A. Pérez, Redes de comunicación. Universidad, 2020.",
            citaBibliografica(referencia, "ieee"),
        )
        assertEquals(
            "Silva, María, y Ana Pérez. 2020. Redes de Comunicación. Universidad.",
            citaBibliografica(referencia, "chicago"),
        )
        assertEquals(
            "1. Silva M, Pérez A. Redes de comunicación. Universidad; 2020.",
            citaBibliografica(referencia, "vancouver"),
        )
        assertEquals("Redes de comunicación", referencia.texto("titulo"))
    }

    @Test
    fun `las fechas ausentes y autores desconocidos no se inventan`() {
        val referencia = objeto("titulo" to "Investigación")
        assertEquals("Investigación. (s/f).", citaBibliografica(referencia, "apa"))
        assertEquals("[1] Investigación.", citaBibliografica(referencia, "ieee"))
        assertEquals("Investigación. s/f.", citaBibliografica(referencia, "chicago"))
        assertEquals("1. Investigación.", citaBibliografica(referencia, "vancouver"))
        val conAutor = JsonObject(referencia + objeto("autores" to cadenas("Silva, María")))
        assertEquals("Silva, M. (s/f). Investigación.", citaBibliografica(conAutor, "apa"))
    }

    @Test
    fun `sin autor la referencia comienza por el titulo antes de la fecha`() {
        val referencia = objeto("titulo" to "Redes", "editorial" to "Universidad", "anio" to 2020)
        assertEquals("Redes. (2020). Universidad.", citaBibliografica(referencia, "apa"))
        assertEquals("Redes. 2020. Universidad.", citaBibliografica(referencia, "chicago"))
    }

    @Test
    fun `nombres compuestos y edicion incluida en titulo mantienen contrato web`() {
        val referencia =
            objeto(
                "titulo" to "Redes: 2.ª edición",
                "autores" to cadenas("Apellido1, Ana María"),
                "editorial" to "Editorial",
                "anio" to 2024,
            )
        assertEquals(
            "Apellido1, A. M. (2024). Redes: 2.ª edición. Editorial.",
            citaBibliografica(referencia, "apa"),
        )
        assertEquals(
            "[1] A. M. Apellido1, Redes: 2.ª edición. Editorial, 2024.",
            citaBibliografica(referencia, "ieee"),
        )
        assertEquals(
            "Apellido1, Ana María. 2024. Redes: 2.ª Edición. Editorial.",
            citaBibliografica(referencia, "chicago"),
        )
        assertEquals(
            "1. Apellido1 AM. Redes: 2.ª edición. Editorial; 2024.",
            citaBibliografica(referencia, "vancouver"),
        )
    }

    @Test
    fun `listas extensas de autores respetan umbrales de los estilos`() {
        fun autores(cantidad: Int) =
            objeto(
                "titulo" to "Redes",
                "autores" to
                    cadenas(*(1..cantidad).map { "Apellido$it, Ana María" }.toTypedArray()),
            )
        assertEquals("[1] A. M. Apellido1 et al., Redes.", citaBibliografica(autores(7), "ieee"))
        assertEquals(
            "Apellido1, Ana María, Ana María Apellido2, Ana María Apellido3, et al. s/f. Redes.",
            citaBibliografica(autores(7), "chicago"),
        )
        assertEquals(
            "1. Apellido1 AM, Apellido2 AM, Apellido3 AM, Apellido4 AM, Apellido5 AM, Apellido6 AM, et al. Redes.",
            citaBibliografica(autores(7), "vancouver"),
        )
        val apa = citaBibliografica(autores(21), "apa")
        assertTrue(apa.startsWith("Apellido1, A. M., Apellido2, A. M.,"))
        assertTrue(apa.endsWith("Apellido19, A. M., … Apellido21, A. M. (s/f). Redes."))
        assertFalse(apa.contains("Apellido20"))
    }

    @Test
    fun `citas previas conservan texto y formato y solo se regeneran al elegir otro`() {
        val referencia =
            objeto("titulo" to "Redes", "cita" to "Cita original revisada.", "formato" to "apa")
        assertEquals("Cita original revisada.", citaBibliografica(referencia, "apa"))
        assertEquals("[1] Redes.", citaBibliografica(referencia, "ieee"))
        assertEquals(
            "Cita original revisada.",
            citaBibliografica(JsonObject(referencia + objeto("formato" to null)), ""),
        )
        val normalizada = normalizarReferencia(FuenteBibliografia.Biblioteca, referencia)
        assertEquals("Cita original revisada.", normalizada.texto("cita"))
    }

    @Test
    fun `revistas y registros sin titulo no se citan como libros`() {
        val revista =
            normalizarReferencia(
                FuenteBibliografia.EnLinea,
                objeto(
                    "endpoint" to "google",
                    "item" to
                        objeto(
                            "volumeInfo" to
                                objeto("title" to "Revista académica", "printType" to "MAGAZINE")
                        ),
                ),
            )
        assertEquals("publicacion_periodica", revista.texto("tipo_obra"))
        assertThrows(IllegalArgumentException::class.java) { citaBibliografica(revista, "apa") }
        assertThrows(IllegalArgumentException::class.java) { citaBibliografica(objeto(), "apa") }
        assertThrows(IllegalArgumentException::class.java) {
            citaBibliografica(objeto("titulo" to "Redes", "anio" to "ayer"), "apa")
        }
        assertThrows(IllegalArgumentException::class.java) {
            citaBibliografica(objeto("titulo" to "Redes"), "desconocido")
        }
    }

    @Test
    fun `procedencia distingue captura manual de fuentes consultadas`() {
        assertFalse(
            objeto("referencia_en_linea" to "https://example.org/libro").esReferenciaConsultada()
        )
        assertTrue(objeto("referencia_en_linea" to "google:Tomo_1").esReferenciaConsultada())
        assertTrue(
            objeto("referencia_en_linea" to "https://books.google.com/books?id=Tomo_1")
                .esReferenciaConsultada()
        )
        assertTrue(objeto("referencia_biblioteca" to "133034").esReferenciaConsultada())
        assertFalse(
            objeto("referencia_en_linea" to "https://books.google.com.evil.example/book")
                .esReferenciaConsultada()
        )
    }

    @Test
    fun `el identificador de Google mantiene procedencia al guardar una URL regional`() {
        val normalizada =
            normalizarReferencia(
                FuenteBibliografia.EnLinea,
                objeto(
                    "endpoint" to "google",
                    "item" to
                        objeto(
                            "id" to "Tomo_1",
                            "volumeInfo" to
                                objeto(
                                    "title" to "Redes",
                                    "previewLink" to "https://books.google.es/books?id=Tomo_1",
                                ),
                        ),
                ),
            )
        assertEquals("google:Tomo_1", normalizada.texto("referencia_en_linea"))
        val recargada = JsonObject(normalizada - "fuente_busqueda" - "tipo_obra")
        assertTrue(recargada.esReferenciaConsultada())
        assertEquals(citaBibliografica(normalizada, "apa"), citaBibliografica(recargada, "apa"))
    }

    @Test
    fun `un resultado sin identificador no puede guardarse perdiendo la fuente`() {
        val normalizada =
            normalizarReferencia(
                FuenteBibliografia.EnLinea,
                objeto(
                    "endpoint" to "google",
                    "item" to objeto("volumeInfo" to objeto("title" to "Redes")),
                ),
            )
        assertThrows(IllegalArgumentException::class.java) { citaBibliografica(normalizada, "apa") }
    }

    @Test
    fun `una respuesta mal formada no se disfraza de busqueda vacia`() {
        assertThrows(IllegalArgumentException::class.java) {
            resultadosReferencias(FuenteBibliografia.Biblioteca, objeto("error" to "fallo"))
        }
        assertThrows(IllegalArgumentException::class.java) {
            resultadosReferencias(
                FuenteBibliografia.EnLinea,
                JsonArray(listOf(JsonPrimitive("invalido"))),
            )
        }
        assertThrows(IllegalArgumentException::class.java) {
            resultadosReferencias(
                FuenteBibliografia.EnLinea,
                JsonArray(listOf(objeto("endpoint" to "desconocido", "item" to objeto()))),
            )
        }
        assertTrue(
            resultadosReferencias(
                    FuenteBibliografia.Biblioteca,
                    objeto("results" to JsonArray(emptyList())),
                )
                .isEmpty()
        )
    }

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

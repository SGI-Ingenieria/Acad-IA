package mx.sgi.acadia

import android.os.SystemClock
import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.serialization.json.*
import mx.sgi.acadia.data.*
import mx.sgi.acadia.ui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class BibliografiaAcademicaUiTest {
    @get:Rule val compose = createComposeRule()

    private fun captura(nombre: String) {
        compose.waitForIdle()
        SystemClock.sleep(250)
        val inst = InstrumentationRegistry.getInstrumentation()
        val directorio =
            java.io.File(inst.targetContext.getExternalFilesDir(null), "preview-captures").apply {
                mkdirs()
            }
        inst.uiAutomation.takeScreenshot()?.let { bitmap ->
            java.io.File(directorio, "$nombre.png").outputStream().use {
                bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
            }
            bitmap.recycle()
        }
    }

    @Test
    fun editarReferenciaManualConservaMetadatosYBloqueaCambiosDuranteElEnvio() {
        var guardado: Registro? = null
        val original =
            objeto(
                "id" to "referencia",
                "titulo" to "Redes",
                "cita" to "Silva, M. (2020). Redes.",
                "tipo" to "COMPLEMENTARIA",
                "autores" to JsonArray(listOf(JsonPrimitive("María Silva"))),
                "editorial" to "Universidad",
                "anio" to 2020,
                "isbn" to "9781234567890",
                "formato" to null,
                "referencia_biblioteca" to null,
                "referencia_en_linea" to "https://example.org/redes",
            )
        compose.setContent {
            var guardando by remember { mutableStateOf(false) }
            val repo = remember { RepositorioAcad() }
            TemaAcad("claro") {
                BibliografiaEditor(
                    repo,
                    original,
                    guardando,
                    null,
                    {},
                    {
                        guardado = it
                        guardando = true
                    },
                )
            }
        }
        compose.onNodeWithText("Título").performTextReplacement("Redes y comunicación")
        captura("bibliografia-editar-metadatos")
        compose.onNodeWithText("Guardar referencia").performClick()
        compose.onNodeWithText("Guardando…").assertExists()
        compose.onNodeWithText("Título").assertIsNotEnabled()
        compose.runOnIdle {
            val actual = requireNotNull(guardado)
            assertEquals("Redes y comunicación", actual.texto("titulo"))
            listOf(
                    "autores",
                    "editorial",
                    "anio",
                    "isbn",
                    "tipo",
                    "formato",
                    "cita",
                    "referencia_biblioteca",
                    "referencia_en_linea",
                )
                .forEach {
                    assertEquals(it, original[it], actual[it])
                }
        }
    }

    @Test
    fun referenciaConsultadaMuestraCitaAutomaticaYMetadatosSoloLectura() {
        var guardado: Registro? = null
        val referencia =
            normalizarReferencia(
                FuenteBibliografia.Biblioteca,
                objeto(
                    "id" to "133034",
                    "titulo" to "Redes de comunicación",
                    "autor" to "Silva, María",
                    "editorial" to "Universidad",
                    "anio" to "2020",
                    "isbn" to "9781234567890",
                ),
            )
        compose.setContent {
            val repo = remember { RepositorioAcad() }
            TemaAcad("claro") {
                BibliografiaEditor(repo, referencia, false, null, {}, { guardado = it })
            }
        }
        compose.onNodeWithText("Previsualizar referencia").assertExists()
        compose.onNodeWithText("Redes de comunicación").assertExists()
        compose.onNodeWithText("Título").assertDoesNotExist()
        compose.onNodeWithText("Autores · uno por línea").assertDoesNotExist()
        compose.onNodeWithText("Cita completa").assertDoesNotExist()
        compose
            .onNodeWithText("Silva, M. (2020). Redes de comunicación. Universidad.")
            .performScrollTo()
            .assertIsDisplayed()
        captura("bibliografia-previsualizacion-catalogo")
        compose.onNodeWithText("Aceptar referencia").performClick()
        compose.runOnIdle {
            val actual = requireNotNull(guardado)
            assertEquals(
                "Silva, M. (2020). Redes de comunicación. Universidad.",
                actual.texto("cita"),
            )
            assertEquals("apa", actual.texto("formato"))
            listOf(
                    "titulo",
                    "autores",
                    "editorial",
                    "anio",
                    "isbn",
                    "referencia_biblioteca",
                    "referencia_en_linea",
                )
                .forEach {
                    assertEquals(it, referencia[it], actual[it])
                }
        }
    }

    @Test
    fun referenciaEnLineaCambiaDeFormatoSinEditarNiGuardarMetadatos() {
        var guardado: Registro? = null
        val referencia =
            objeto(
                "titulo" to "Redes",
                "referencia_en_linea" to "google:Vol1",
                "autores" to JsonArray(listOf(JsonPrimitive("Silva, María"))),
                "anio" to 2020,
            )
        compose.setContent {
            val repo = remember { RepositorioAcad() }
            TemaAcad("claro") {
                BibliografiaEditor(repo, referencia, false, null, {}, { guardado = it })
            }
        }
        compose.onNodeWithText("Formato de cita").performScrollTo().performClick()
        compose.onNodeWithText("IEEE").performClick()
        compose.onNodeWithText("[1] M. Silva, Redes. 2020.").performScrollTo().assertIsDisplayed()
        compose.runOnIdle { assertNull(guardado) }
        compose.onNodeWithText("Aceptar referencia").performClick()
        compose.runOnIdle {
            assertEquals("ieee", guardado?.texto("formato"))
            assertEquals("google:Vol1", guardado?.texto("referencia_en_linea"))
        }
    }

    @Test
    fun referenciaConsultadaConservaCitaExistenteDeFormatoNoRegistrado() {
        var guardado: Registro? = null
        val referencia =
            objeto(
                "titulo" to "Redes",
                "referencia_biblioteca" to "133034",
                "cita" to "Cita revisada por el docente.",
                "formato" to null,
            )
        compose.setContent {
            val repo = remember { RepositorioAcad() }
            TemaAcad("claro") {
                BibliografiaEditor(repo, referencia, false, null, {}, { guardado = it })
            }
        }
        compose
            .onNodeWithText("Cita revisada por el docente.")
            .performScrollTo()
            .assertIsDisplayed()
        compose.onNodeWithText("Aceptar referencia").performClick()
        compose.runOnIdle {
            assertEquals("Cita revisada por el docente.", guardado?.texto("cita"))
            assertEquals(JsonNull, guardado?.get("formato"))
        }
    }

    @Test
    fun capturaManualGeneraCitaAlIntroducirDatosSinObligarAEscribirla() {
        var guardado: Registro? = null
        compose.setContent {
            val repo = remember { RepositorioAcad() }
            TemaAcad("claro") { BibliografiaEditor(repo, null, false, null, {}, { guardado = it }) }
        }
        compose.onNodeWithText("Capturar referencia").performClick()
        compose.onNodeWithText("Título").performTextInput("Investigación")
        compose.onNodeWithText("Guardar referencia").performClick()
        compose.runOnIdle { assertEquals("Investigación. (s/f).", guardado?.texto("cita")) }
    }

    @Test
    fun losTresMetodosSonAccesiblesSinIniciarConsultasVacias() {
        compose.setContent {
            val repo = remember { RepositorioAcad() }
            TemaAcad("claro") { BibliografiaEditor(repo, null, false, null, {}, {}) }
        }
        compose.onNodeWithText("Biblioteca").performClick()
        compose.onNodeWithText("Título, autor o ISBN").assertExists()
        compose.onNodeWithText("En línea").performClick()
        compose.onNodeWithText("Título, autor o ISBN").assertExists()
        captura("bibliografia-metodos")
        compose.onNodeWithText("Manual").performClick()
        compose.onNodeWithText("Capturar referencia").performClick()
        compose.onNodeWithText("Título").assertExists()
        compose.onNodeWithText("Guardar referencia").performClick()
        compose.onNodeWithText("Escribe el título.").assertExists()
        compose.onNodeWithText("Cambiar método").performClick()
        compose.onNodeWithText("Manual").assertExists()
    }
}

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
    fun editarReferenciaConservaMetadatosYBloqueaCambiosDuranteElEnvio() {
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
                "referencia_biblioteca" to "133034",
                "referencia_en_linea" to "open_library:/works/OL123W",
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

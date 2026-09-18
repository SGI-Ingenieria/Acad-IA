package mx.sgi.acadia

import android.os.SystemClock
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import mx.sgi.acadia.data.*
import mx.sgi.acadia.ui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class RevisionAcademicaUiTest {
    @get:Rule val compose = createComposeRule()
    private val sesion = Sesion("yo", "María Silva", "", emptySet(), setOf(Permiso.Comentar.clave))

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
    fun transicionEsContextualYEsperaLaConfirmacionDelServidor() {
        var enviado = ""
        var terminar: (() -> Unit)? = null
        val titulo = "Enviar a revisión con el secretario académico"
        compose.setContent {
            var guardando by remember { mutableStateOf(false) }
            TemaAcad("claro") {
                Surface(modifier = Modifier.safeDrawingPadding()) {
                    RevisionAcademica(
                        expediente =
                            Expediente(
                                objeto(
                                    "id" to "plan",
                                    "estados_plan" to
                                        objeto("orden" to 10, "etiqueta" to "Borrador"),
                                ),
                                transiciones =
                                    listOf(
                                        objeto(
                                            "id" to "revision",
                                            "clave" to "REVISION",
                                            "orden" to 20,
                                        )
                                    ),
                            ),
                        asignatura = false,
                        sesion = sesion,
                        guardando = guardando,
                        error = null,
                        comentar = {},
                        resolver = { _, _ -> },
                        transicionar = { destino, comentario, completar ->
                            enviado = "$destino|$comentario"
                            guardando = true
                            terminar = {
                                guardando = false
                                completar()
                            }
                        },
                    )
                }
            }
        }
        compose.onNodeWithText("Cambiar estado").assertDoesNotExist()
        compose.onNodeWithText(titulo).performClick()
        compose
            .onNodeWithText("¿Quieres agregar un comentario?")
            .performTextInput("Versión para revisión académica")
        captura("revision-comentario-contextual")
        compose.onNodeWithTag("confirmar-revision").performScrollTo().performClick()
        compose.onNodeWithText("Enviando…").assertExists()
        compose.runOnIdle {
            assertEquals("revision|Versión para revisión académica", enviado)
            terminar!!.invoke()
        }
        compose.onNodeWithText("¿Quieres agregar un comentario?").assertDoesNotExist()
    }

    @Test
    fun resolverConservaLaObservacionEnElFiltroResueltos() {
        compose.setContent {
            var expediente by remember {
                mutableStateOf(
                    Expediente(
                        objeto("id" to "plan"),
                        editable = true,
                        comentarios =
                            listOf(
                                objeto(
                                    "id" to "comentario",
                                    "autor_id" to "yo",
                                    "autor" to objeto("nombre_completo" to "María Silva"),
                                    "cuerpo" to "<p>Verificar la secuencia de aprendizaje.</p>",
                                    "creado_en" to "2026-09-18T10:00:00Z",
                                    "resuelto" to false,
                                )
                            ),
                    )
                )
            }
            TemaAcad("claro") {
                Surface(modifier = Modifier.safeDrawingPadding()) {
                    RevisionAcademica(
                        expediente,
                        false,
                        sesion,
                        false,
                        null,
                        {},
                        resolver = { comentario, resuelto ->
                            expediente =
                                expediente.copy(
                                    comentarios =
                                        expediente.comentarios.map {
                                            if (it.id == comentario.id)
                                                kotlinx.serialization.json.JsonObject(
                                                    it + objeto("resuelto" to resuelto)
                                                )
                                            else it
                                        }
                                )
                        },
                        transicionar = { _, _, _ -> },
                    )
                }
            }
        }
        compose.onNodeWithContentDescription("Escribir comentario").assertExists()
        captura("revision-observaciones")
        compose.onNodeWithText("Marcar como resuelta").performClick()
        compose.onNodeWithText("Todo revisado").assertExists()
        compose.onNodeWithText("Resueltos · 1").performClick()
        compose.onNodeWithText("Reabrir observación").assertExists()
        compose.onNodeWithText("Reabrir observación").performClick()
        compose.onNodeWithText("Pendientes · 1").performClick()
        compose.onNodeWithText("Marcar como resuelta").assertExists()
    }

    @Test
    fun noOfreceResolverComentariosAjenosAunqueElPlanSeaEditable() {
        compose.setContent {
            TemaAcad("claro") {
                Surface(modifier = Modifier.safeDrawingPadding()) {
                    RevisionAcademica(
                        Expediente(
                            objeto("id" to "plan"),
                            editable = true,
                            comentarios =
                                listOf(
                                    objeto(
                                        "id" to "ajeno",
                                        "autor_id" to "otra-persona",
                                        "cuerpo" to "Pendiente",
                                    )
                                ),
                        ),
                        false,
                        sesion,
                        false,
                        null,
                        {},
                        { _, _ -> },
                        { _, _, _ -> },
                    )
                }
            }
        }
        compose.onNodeWithText("Marcar como resuelta").assertDoesNotExist()
    }

    @Test
    fun elHistorialRevelaAntesYDespuesSinAccionesDestructivas() {
        compose.setContent {
            TemaAcad("claro") {
                HistorialAcademico(
                    Expediente(
                        objeto("id" to "plan"),
                        historial =
                            listOf(
                                objeto(
                                    "id" to "cambio",
                                    "campo" to "nombre",
                                    "tipo" to "ACTUALIZACION",
                                    "cambiado_en" to "2026-09-18T10:00:00Z",
                                    "usuarios_app" to objeto("nombre_completo" to "María Silva"),
                                    "valor_anterior" to "Plan inicial",
                                    "valor_nuevo" to "Plan revisado",
                                )
                            ),
                    ),
                    {},
                )
            }
        }
        compose.onNodeWithText("Actualizó nombre").performClick()
        compose.onNodeWithText("Antes").assertExists()
        compose.onNodeWithText("Después").assertExists()
        captura("historial-comparacion")
        compose.onNodeWithText("Descartar").assertDoesNotExist()
        compose.onNodeWithContentDescription("Cerrar historial").assertExists()
    }
}

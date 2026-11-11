package mx.sgi.acadia

import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createComposeRule
import kotlinx.serialization.json.*
import mx.sgi.acadia.data.*
import mx.sgi.acadia.ui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class EditorListaAcademicaTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun criteriosWebSeLeenYSeRenombranSinCambiarElContrato() {
        var resultado: Registro? = null
        compose.setContent {
            TemaAcad("claro") {
                EditorListaAcademica(
                    true,
                    objeto(),
                    objeto(
                        "criterios_de_evaluacion" to
                            JsonArray(listOf(objeto("criterio" to "Proyecto", "porcentaje" to 100)))
                    ),
                    false,
                    null,
                    {},
                    { resultado = it },
                )
            }
        }
        compose.onNodeWithText("Criterio 1").assertTextContains("Proyecto")
        compose.onNodeWithText("Criterio 1").performTextReplacement("Investigación")
        compose.onNodeWithText("Guardar").performClick()
        compose.runOnIdle {
            assertEquals(
                "Investigación",
                resultado!!.lista("criterios_de_evaluacion").single().texto("criterio"),
            )
        }
    }

    @Test
    fun avisoSePuedeCerrarSinEsperarYNoReaparece() {
        var mensaje by mutableStateOf<String?>("Cambios guardados")
        compose.setContent {
            TemaAcad("claro") {
                Pagina("Resumen", mensaje = mensaje, consumirMensaje = { mensaje = null }) {}
            }
        }
        compose.onNodeWithText("Cambios guardados").assertExists()
        compose.onNodeWithContentDescription("Cerrar aviso").performClick()
        compose.waitUntil(5000) { mensaje == null }
        compose.onNodeWithText("Cambios guardados").assertDoesNotExist()
    }

    @Test
    fun avisoDeGuardadoExpiraAutomaticamente() {
        var mensaje by mutableStateOf<String?>("Cambios guardados")
        compose.setContent {
            TemaAcad("claro") {
                Pagina("Resumen", mensaje = mensaje, consumirMensaje = { mensaje = null }) {}
            }
        }
        compose.onNodeWithText("Cambios guardados").assertExists()
        compose.waitUntil(7000) { mensaje == null }
        compose.onNodeWithText("Cambios guardados").assertDoesNotExist()
    }

    @Test
    fun porcentajeDecimalSeEditaSinPerderSeparadorYValidaTotal() {
        var resultado: Registro? = null
        compose.setContent {
            TemaAcad("claro") {
                EditorListaAcademica(true, objeto(), objeto(), false, null, {}, { resultado = it })
            }
        }
        compose.onNodeWithText("Nuevo criterio").performTextInput("Proyecto")
        compose.onNodeWithText("%").performTextInput("37,")
        compose.onNodeWithText("%").assertTextContains("37,")
        compose.onNodeWithText("%").performTextInput("5")
        compose.onNodeWithContentDescription("Añadir criterio").performClick()
        compose.onNodeWithText("Guardar").performClick()
        compose.onNodeWithText("Usa porcentajes enteros entre 1 y 100.").assertExists()
        assertNull(resultado)
        compose.onAllNodesWithText("%").onFirst().performTextReplacement("40")
        compose.onNodeWithText("Guardar").performClick()
        compose.onNodeWithText("Los porcentajes deben sumar 100 %.").assertExists()
        compose.onNodeWithText("Nuevo criterio").performTextInput("Portafolio")
        compose.onAllNodesWithText("%").onLast().performTextInput("60")
        // Saving also includes a non-empty pending entry, instead of silently losing it.
        compose.onNodeWithText("Guardar").performClick()
        compose.runOnIdle {
            val criterios = resultado!!.lista("criterios_de_evaluacion")
            assertEquals(100.0, criterios.sumOf { it.decimal("porcentaje") }, .001)
            assertFalse(criterios.any { it.containsKey("_clave_editor") })
            assertEquals(listOf("Proyecto", "Portafolio"), criterios.map { it.texto("criterio") })
            assertFalse(criterios.any { it.containsKey("nombre") })
        }
    }

    @Test
    fun temasConservanIdentidadAlReordenarYConfirmanSalida() {
        val unidad =
            objeto(
                "id" to "unidad",
                "titulo" to "Método",
                "unidad" to 1,
                "temas" to
                    JsonArray(
                        listOf(
                            objeto("id" to "uno", "nombre" to "Pregunta", "detalle" to "preservar"),
                            objeto("id" to "dos", "nombre" to "Evidencia"),
                        )
                    ),
            )
        var resultado: Registro? = null
        var cerrado = false
        compose.setContent {
            TemaAcad("oscuro") {
                EditorListaAcademica(
                    false,
                    unidad,
                    objeto("contenido_tematico" to JsonArray(listOf(unidad))),
                    false,
                    null,
                    { cerrado = true },
                    { resultado = it },
                )
            }
        }
        compose.onNodeWithContentDescription("Opciones del tema 2").performClick()
        compose.onNodeWithText("Subir").performClick()
        compose.onNodeWithText("Tema 1").assertTextContains("Evidencia")
        compose.onNodeWithContentDescription("Cerrar").performClick()
        compose.onNodeWithText("¿Descartar cambios?").assertExists()
        assertFalse(cerrado)
        compose.onNodeWithText("Seguir editando").performClick()
        compose.onNodeWithText("Guardar").performClick()
        compose.runOnIdle {
            val temas = resultado!!.lista("contenido_tematico").single().lista("temas")
            assertEquals(listOf("dos", "uno"), temas.map { it.id })
            assertEquals("preservar", temas.last().texto("detalle"))
        }
    }

    @Test
    fun errorDeServidorConservaBorradorYPermiteReintentar() {
        var error by mutableStateOf<String?>(null)
        var guardados = 0
        compose.setContent {
            TemaAcad("claro") {
                EditorListaAcademica(
                    false,
                    objeto(),
                    objeto(),
                    false,
                    error,
                    {},
                    {
                        guardados++
                        error = "No se pudo guardar. Intenta nuevamente."
                    },
                )
            }
        }
        compose.onNodeWithText("Título de la unidad").performTextInput("Unidad de investigación")
        compose.onNodeWithText("Nuevo tema").performTextInput("Protocolo")
        compose.onNodeWithText("Guardar").performClick()
        compose.onNodeWithText("No se pudo guardar. Intenta nuevamente.").assertExists()
        compose.onNodeWithText("Nuevo tema").assertTextContains("Protocolo")
        compose.onNodeWithText("Guardar").performClick()
        compose.runOnIdle { assertEquals(2, guardados) }
    }
}

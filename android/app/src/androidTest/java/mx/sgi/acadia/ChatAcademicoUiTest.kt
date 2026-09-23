package mx.sgi.acadia

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createComposeRule
import kotlinx.serialization.json.JsonArray
import mx.sgi.acadia.data.*
import mx.sgi.acadia.ui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class ChatAcademicoUiTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun restaurarChatEsperaEstadoAntesDePermitirEnvio() {
        val cargando = EstadoChat(conversacionId = "chat")
        assertTrue(cargando.comprobandoConversacion)
        assertFalse(
            cargando
                .copy(conversacion = objeto("id" to "chat", "estado" to "ACTIVA"))
                .comprobandoConversacion
        )
        assertTrue(
            cargando.copy(conversacion = objeto("id" to "chat", "estado" to "ARCHIVADA")).archivada
        )
    }

    @Test
    fun chatVacioMuestraCompositorSinCrearConversacion() {
        var enviados = 0
        compose.setContent {
            TemaAcad("claro") {
                Surface(Modifier.fillMaxSize().safeDrawingPadding()) {
                    Column {
                        ConversacionContenido(EstadoChat(), Modifier.weight(1f))
                        CompositorChat("", {}, false, { enviados++ }, {})
                    }
                }
            }
        }
        compose.onNodeWithText("¿Qué quieres trabajar?").assertIsDisplayed()
        compose.onNodeWithContentDescription("Enviar consulta").assertIsNotEnabled()
        compose.onNodeWithContentDescription("Dictar consulta").assertIsDisplayed()
        assertEquals(0, enviados)
    }

    @Test
    fun recomendacionSeResumeEnBloqueHastaAbrirla() {
        var abierto = ""
        val mensaje =
            objeto(
                "id" to "m1",
                "mensaje" to "Mejora el objetivo",
                "respuesta" to "Preparé una recomendación.",
                "estado" to "COMPLETADO",
                "propuesta" to
                    objeto(
                        "recommendations" to
                            JsonArray(
                                listOf(
                                    objeto(
                                        "campo_afectado" to "objetivo",
                                        "texto_mejora" to "Contenido exclusivo del detalle",
                                    )
                                )
                            )
                    ),
            )
        compose.setContent {
            TemaAcad("claro") {
                Surface(Modifier.fillMaxSize().safeDrawingPadding()) {
                    ConversacionContenido(
                        EstadoChat(mensajes = listOf(mensaje)),
                        abrirPropuesta = { abierto = it },
                    )
                }
            }
        }
        compose.onNodeWithText("Contenido exclusivo del detalle").assertDoesNotExist()
        compose.onNodeWithText("Ver recomendación de IA").performClick()
        assertEquals("m1", abierto)
    }

    @Test
    fun consultaEnCursoDeshabilitaDobleEnvioYPreservaTextoEditable() {
        compose.setContent {
            TemaAcad("claro") { Surface { CompositorChat("Consulta pendiente", {}, true, {}, {}) } }
        }
        compose.onNodeWithText("Consulta pendiente").assertIsDisplayed()
        compose.onNodeWithContentDescription("Consulta al asistente").assertIsEnabled()
        compose.onNodeWithContentDescription("Dictar consulta").assertIsNotEnabled()
    }
}

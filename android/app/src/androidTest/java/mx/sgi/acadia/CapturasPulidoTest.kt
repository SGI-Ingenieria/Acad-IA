package mx.sgi.acadia

import android.graphics.Bitmap
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.History
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import kotlinx.serialization.json.JsonArray
import mx.sgi.acadia.data.*
import mx.sgi.acadia.ui.*
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/** Opt in with the instrumentation argument capturasPulido=true. */
class CapturasPulidoTest {
    @get:Rule val compose = createComposeRule()

    @Before
    fun habilitarCapturas() {
        assumeTrue(InstrumentationRegistry.getArguments().getString("capturasPulido") == "true")
    }

    private fun capturar(nombre: String) {
        compose.waitForIdle()
        val instrumentacion = InstrumentationRegistry.getInstrumentation()
        instrumentacion.waitForIdleSync()
        val captura =
            requireNotNull(instrumentacion.uiAutomation.takeScreenshot()) {
                "No se pudo capturar la pantalla compuesta."
            }
        val imagen =
            if (captura.config == Bitmap.Config.HARDWARE)
                requireNotNull(captura.copy(Bitmap.Config.ARGB_8888, false)).also {
                    captura.recycle()
                }
            else captura
        val directorio =
            requireNotNull(instrumentacion.targetContext.getExternalFilesDir("capturas-pulido"))
        assertTrue(directorio.isDirectory || directorio.mkdirs())
        try {
            assertTrue(imagen.width > 0 && imagen.height > 0)
            val colorBase = imagen.getPixel(imagen.width / 2, imagen.height / 2)
            val contenidoVisible =
                (imagen.height / 10 until
                        imagen.height * 9 / 10 step
                        (imagen.height / 200).coerceAtLeast(1))
                    .any { y ->
                        (imagen.width / 10 until
                                imagen.width * 9 / 10 step
                                (imagen.width / 160).coerceAtLeast(1))
                            .any { x ->
                                imagen.getPixel(x, y) != colorBase
                            }
                    }
            assertTrue("La captura $nombre no puede ser una superficie uniforme.", contenidoVisible)
            File(directorio, "$nombre.png").outputStream().use {
                assertTrue(imagen.compress(Bitmap.CompressFormat.PNG, 100, it))
            }
        } finally {
            imagen.recycle()
        }
    }

    @Composable
    private fun ChatDeMuestra(estado: EstadoChat) {
        TemaAcad("claro") {
            Pagina(
                "Asistente IA",
                atras = {},
                acciones = {
                    AccionIcono("Chats recientes", Icons.Outlined.History, accion = {})
                },
            ) { padding ->
                Column(Modifier.fillMaxSize().padding(padding)) {
                    ConversacionContenido(estado, Modifier.weight(1f))
                    CompositorChat("", {}, false, {}, {})
                }
            }
        }
    }

    @Test
    fun chatVacio() {
        compose.setContent {
            ChatDeMuestra(
                EstadoChat(
                    expediente =
                        Expediente(
                            objeto(
                                "id" to "asignatura",
                                "nombre" to "Criptografía aplicada",
                            )
                        )
                )
            )
        }
        compose.onNodeWithText("¿Qué quieres trabajar?").assertIsDisplayed()
        compose.onNodeWithContentDescription("Chats recientes").assertIsDisplayed()
        compose.onNodeWithContentDescription("Dictar consulta").assertIsDisplayed()
        compose.onNodeWithContentDescription("Enviar consulta").assertIsNotEnabled()
        capturar("01-chat-vacio")
    }

    @Test
    fun chatConRecomendacion() {
        val mensaje =
            objeto(
                "id" to "recomendacion-1",
                "mensaje" to "Mejora el objetivo y los resultados de aprendizaje.",
                "respuesta" to
                    "Preparé una propuesta para vincular los resultados con prácticas de criptografía y evaluación de riesgos.",
                "estado" to "COMPLETADO",
                "propuesta" to
                    objeto(
                        "recommendations" to
                            JsonArray(
                                listOf(
                                    objeto(
                                        "campo_afectado" to "objetivo",
                                        "texto_mejora" to
                                            "Aplicar técnicas criptográficas a problemas reales.",
                                    ),
                                    objeto(
                                        "campo_afectado" to "resultados_aprendizaje",
                                        "texto_mejora" to "Evaluar la seguridad de protocolos.",
                                    ),
                                )
                            )
                    ),
            )
        compose.setContent { ChatDeMuestra(EstadoChat(mensajes = listOf(mensaje))) }
        compose.onNodeWithText("Ver recomendación de IA").assertIsDisplayed()
        compose
            .onNodeWithText("Aplicar técnicas criptográficas a problemas reales.")
            .assertDoesNotExist()
        capturar("02-chat-recomendacion")
    }

    @Test
    fun bibliografiaImportada() {
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
            TemaAcad("claro") { BibliografiaEditor(repo, referencia, false, null, {}, {}) }
        }
        compose.onNodeWithText("Previsualizar referencia").assertIsDisplayed()
        compose.onNodeWithText("Título").assertDoesNotExist()
        compose
            .onNodeWithText("Silva, M. (2020). Redes de comunicación. Universidad.")
            .performScrollTo()
            .assertIsDisplayed()
        compose.onNodeWithText("Aceptar referencia").assertIsDisplayed()
        capturar("03-bibliografia-previsualizada")
    }

    @Test
    fun revisionAprobada() {
        val expediente =
            Expediente(
                objeto("id" to "asignatura", "estado" to "aprobada"),
                comentarios =
                    listOf(
                        objeto(
                            "id" to "observacion",
                            "autor_id" to "secretaria",
                            "autor" to objeto("nombre_completo" to "María Silva"),
                            "cuerpo" to
                                "Los resultados de aprendizaje y la evaluación están alineados.",
                            "creado_en" to "2026-09-18T15:20:00Z",
                            "resuelto" to true,
                        )
                    ),
                transiciones = listOf(objeto("id" to "borrador")),
            )
        val sesion = Sesion("secretaria", "María Silva", "", setOf("ADMIN"), emptySet())
        compose.setContent {
            TemaAcad("claro") {
                Pagina(
                    "Asignatura",
                    atras = {},
                    acciones = {
                        AccionIcono("Historial de cambios", Icons.Outlined.History, accion = {})
                    },
                    accionFlotante = {
                        AccionFlotanteRevision(
                            expediente,
                            true,
                            sesion,
                            false,
                            null,
                            {},
                            { _, _, _ -> },
                        )
                    },
                ) { padding ->
                    Surface(Modifier.fillMaxSize().padding(padding)) {
                        RevisionAcademica(
                            expediente,
                            true,
                            sesion,
                            false,
                            null,
                            {},
                            { _, _ -> },
                            { _, _, _ -> },
                            mostrarAccionComentario = false,
                        )
                    }
                }
            }
        }
        compose.onNodeWithText("Resueltos · 1").performClick()
        compose.onNodeWithText("Aprobada").assertIsDisplayed()
        compose.onNodeWithContentDescription("Escribir comentario").assertDoesNotExist()
        compose.onNodeWithContentDescription("Reabrir observación").assertDoesNotExist()
        compose.onNodeWithContentDescription("Reabrir asignatura").assertIsDisplayed()
        capturar("04-revision-aprobada")
    }

    @Test
    fun selectorDeResponsables() {
        val usuarios =
            listOf(
                objeto(
                    "id" to "ana",
                    "nombre_completo" to "Ana López",
                    "email" to "ana.lopez@example.edu",
                ),
                objeto(
                    "id" to "maria",
                    "nombre_completo" to "María Silva",
                    "email" to "maria.silva@example.edu",
                ),
                objeto(
                    "id" to "rafael",
                    "nombre_completo" to "Rafael Torres",
                    "email" to "rafael.torres@example.edu",
                ),
            )
        compose.setContent {
            TemaAcad("claro") {
                SelectorProfesorResponsable(
                    DatosResponsables(emptyList(), usuarios, true, true),
                    false,
                    null,
                    null,
                    {},
                    {},
                    {},
                    { _, _ -> },
                )
            }
        }
        compose.onNodeWithTag("profesor-maria").performClick().assertIsSelected()
        compose.onNodeWithText("Asignar profesor").performScrollTo().assertIsEnabled()
        compose.onNodeWithText("Invitar por correo").assertIsDisplayed()
        capturar("05-selector-responsables")
    }
}

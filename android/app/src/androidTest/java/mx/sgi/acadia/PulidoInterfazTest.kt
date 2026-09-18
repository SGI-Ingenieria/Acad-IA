package mx.sgi.acadia

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createComposeRule
import kotlinx.serialization.json.Json
import mx.sgi.acadia.data.*
import mx.sgi.acadia.ui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class PulidoInterfazTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun inicioPermaneceVacioSinActividadNiPlanes() {
        compose.setContent { TemaAcad("claro") { InicioPantalla() } }
        compose.onNodeWithText("Planes recientes").assertDoesNotExist()
        compose.onNodeWithText("Actividad").assertDoesNotExist()
        compose.onAllNodes(hasClickAction()).assertCountEquals(0)
    }

    @Test
    fun unSoloMasCreaSegunVistaYConservaPermisos() {
        var asignaturas = 0
        var bloques = 0
        compose.setContent {
            var vista by remember { mutableStateOf("Mapa") }
            TemaAcad("claro") {
                Surface(Modifier.safeDrawingPadding()) {
                    Column {
                        AccionCrearEnMapa(vista, true, false, { asignaturas++ }, { bloques++ })
                        MapaCurricular(
                            Expediente(
                                objeto(
                                    "id" to "plan",
                                    "numero_ciclos" to 2,
                                    "tipo_ciclo" to "Semestre",
                                )
                            ),
                            true,
                            false,
                            null,
                            {},
                            { asignaturas++ },
                            { _, _ -> },
                            nuevoBloque = { bloques++ },
                            mostrarAltaAsignatura = false,
                            vistaSeleccionada = vista,
                            cambiarVista = { vista = it },
                        )
                    }
                }
            }
        }
        compose.onAllNodesWithContentDescription("Añadir asignatura").assertCountEquals(1)
        compose.onNodeWithContentDescription("Añadir asignatura").performClick()
        compose.onNodeWithContentDescription("Vista lista").performClick()
        compose.onNodeWithContentDescription("Añadir asignatura").performClick()
        compose.onNodeWithContentDescription("Vista bloques").performClick()
        compose.onNodeWithContentDescription("Añadir asignatura").assertDoesNotExist()
        compose.onAllNodesWithContentDescription("Añadir bloque").assertCountEquals(1)
        compose.onNodeWithText("Añadir bloque").assertDoesNotExist()
        compose.onNodeWithContentDescription("Añadir bloque").performClick()
        compose.runOnIdle {
            assertEquals(2, asignaturas)
            assertEquals(1, bloques)
        }
    }

    @Test
    fun detalleDeEstructuraExponeElementosYReglas() {
        val estructura =
            objeto(
                "id" to "estructura",
                "nombre" to "Plan curricular",
                "definicion" to
                    Json.parseToJsonElement(
                        """
            {"required":["perfil"],"properties":{"perfil":{"title":"Perfil de egreso","type":"string","description":"Resultados del programa"}}}
        """
                    ),
            )
        compose.setContent { TemaAcad("claro") { DetalleEstructura(estructura, false) {} } }
        compose.onNodeWithText("Perfil de egreso").assertExists().performClick()
        compose.onNodeWithText("Texto enriquecido · Requerido").assertExists()
        compose.onNodeWithText("Resultados del programa").assertExists()
        compose.onNodeWithContentDescription("Cerrar estructura").assertExists()
    }
}

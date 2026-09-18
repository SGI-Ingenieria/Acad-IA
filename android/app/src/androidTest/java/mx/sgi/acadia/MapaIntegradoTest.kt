package mx.sgi.acadia

import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createComposeRule
import mx.sgi.acadia.data.*
import mx.sgi.acadia.ui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class MapaIntegradoTest {
    @get:Rule val compose = createComposeRule()

    private val fundamentos =
        objeto(
            "id" to "fundamentos",
            "nombre" to "Fundamentos",
            "orden" to 1,
            "color" to "#4F46E5",
            "proposito" to "<p>Comprender los fundamentos científicos.</p>",
        )
    private val aplicacion =
        objeto(
            "id" to "aplicacion",
            "nombre" to "Aplicación",
            "orden" to 2,
            "color" to "#059669",
        )
    private val materia =
        objeto(
            "id" to "algebra",
            "nombre" to "Álgebra",
            "codigo" to "MAT-01",
            "numero_ciclo" to 1,
            "linea_plan_id" to "fundamentos",
            "creditos" to 6,
            "estado" to "borrador",
        )
    private val plan = objeto("id" to "plan", "numero_ciclos" to 3, "tipo_ciclo" to "Semestre")

    @Test
    fun pulsacionLargaOfreceMovimientoSinIconoPermanente() {
        var expediente by
            mutableStateOf(
                Expediente(
                    plan,
                    asignaturas = listOf(materia),
                    bloques = listOf(fundamentos, aplicacion),
                )
            )
        var abierta = ""
        compose.setContent {
            TemaAcad("claro") {
                Surface(Modifier.safeDrawingPadding()) {
                    MapaCurricular(
                        expediente,
                        true,
                        false,
                        null,
                        { abierta = it },
                        {},
                        { registro, destino ->
                            expediente = moverEnMapa(expediente, registro.id, destino)
                        },
                    )
                }
            }
        }
        compose.onNodeWithContentDescription("Vista lista").performClick()
        compose.onNodeWithContentDescription("Mover Álgebra").assertDoesNotExist()
        compose.onNodeWithTag("asignatura-lista-algebra").performClick()
        compose.runOnIdle { assertEquals("algebra", abierta) }
        compose.onNodeWithTag("asignatura-lista-algebra").performTouchInput { longClick() }
        compose.onNodeWithText("Mover asignatura").performClick()
        compose.onNodeWithText("Ciclo de destino").performClick()
        compose.onNodeWithText("Semestre 2").performClick()
        compose.onNodeWithText("Bloque formativo").performClick()
        compose.onNode(hasText("Aplicación") and hasAnyAncestor(isPopup())).performClick()
        compose.onNodeWithText("Guardar").performClick()
        compose.runOnIdle {
            assertEquals(CeldaMapa(2, "aplicacion"), expediente.asignaturas.single().celdaMapa())
        }
    }

    @Test
    fun bloquesSeEditanSinPermisoDeEditarAsignaturasNiTabDuplicada() {
        var creado = false
        var editado = ""
        compose.setContent {
            TemaAcad("oscuro") {
                Surface(Modifier.safeDrawingPadding()) {
                    MapaCurricular(
                        Expediente(
                            plan,
                            asignaturas = listOf(materia),
                            bloques = listOf(fundamentos),
                        ),
                        false,
                        false,
                        null,
                        {},
                        {},
                        { _, _ -> },
                        nuevoBloque = { creado = true },
                        editarBloque = { editado = it.id },
                        mostrarAltaAsignatura = false,
                    )
                }
            }
        }
        compose.onNodeWithText("Progresión académica").assertDoesNotExist()
        compose.onNodeWithContentDescription("Añadir asignatura").assertDoesNotExist()
        compose.onNodeWithText("Añadir bloque").performClick()
        compose.runOnIdle { assertTrue(creado) }
        compose.onNodeWithContentDescription("Vista lista").performClick()
        compose.onAllNodesWithText("Fundamentos").onFirst().performClick()
        compose.onNodeWithText("Comprender los fundamentos científicos.").assertExists()
        compose.onNodeWithText("Editar bloque").performClick()
        compose.runOnIdle { assertEquals("fundamentos", editado) }
    }
}

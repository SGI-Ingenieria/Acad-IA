package mx.sgi.acadia

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createComposeRule
import java.time.YearMonth
import mx.sgi.acadia.data.*
import mx.sgi.acadia.ui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class AltaAcademicaUiTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun carrerasSeAgrupanYBusquedaRespetaAcentos() {
        val facultad =
            objeto(
                "id" to "ing",
                "nombre" to "Ingeniería",
                "prefijo" to "Mexicana",
                "color" to "#EF4444",
                "icono" to "Hammer",
            )
        val carreras =
            listOf(
                objeto("id" to "l", "nombre" to "Sistemas", "nivel" to "Licenciatura"),
                objeto("id" to "m", "nombre" to "Ciberseguridad", "nivel" to "Maestría"),
            )
        var seleccionado = ""
        compose.setContent {
            TemaAcad("claro") {
                Surface {
                    Column {
                        SelectorFacultad(listOf(facultad), "ing") {}
                        SelectorCarrera(carreras, facultad, "") { seleccionado = it }
                    }
                }
            }
        }
        compose.onNodeWithText("Facultad Mexicana de Ingeniería").assertExists()
        compose.onNodeWithText("Selecciona la carrera").performClick()
        compose.onNodeWithText("Licenciatura").assertExists()
        compose.onNodeWithText("Maestría").assertExists()
        compose.onNodeWithText("Buscar carrera").performTextInput("maestria")
        compose.onNodeWithText("Sistemas").assertDoesNotExist()
        compose.onNodeWithText("Ciberseguridad").performClick()
        assertEquals("m", seleccionado)
    }

    @Test
    fun mesAnioEntregaPrimerDiaSinCampoDeFechaLibre() {
        val siguiente = YearMonth.now().plusMonths(1)
        var seleccionado = ""
        compose.setContent {
            TemaAcad("oscuro") {
                Surface { SelectorMesAnio(siguiente.atDay(1).toString()) { seleccionado = it } }
            }
        }
        compose.onNodeWithText("Inicio de impartición").performClick()
        compose.onNodeWithText("Año").assertExists()
        compose.onNodeWithText("Elegir mes").performClick()
        assertEquals(siguiente.atDay(1).toString(), seleccionado)
    }
}

package mx.sgi.acadia

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import mx.sgi.acadia.data.objeto
import mx.sgi.acadia.ui.FilaAsignatura
import mx.sgi.acadia.ui.TemaAcad
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class AsignaturasCatalogoUiTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun asignaturaPriorizaNombrePlanYCicloExplicito() {
        var abierta = false
        compose.setContent {
            TemaAcad("claro") {
                Surface {
                    Column(Modifier.safeDrawingPadding().padding(24.dp)) {
                        FilaAsignatura(
                            objeto(
                                "nombre" to "Criptografía aplicada",
                                "codigo" to "CIB402",
                                "creditos" to 6.0,
                                "numero_ciclo" to 4,
                                "plan_tipo_ciclo" to "Semestre",
                                "plan_tipo_estructura" to "CURRICULAR",
                                "carrera_nivel" to "Maestría",
                                "carrera_nombre" to "Ciberseguridad",
                                "plan_nombre" to "Nombre heredado",
                                "facultad_nombre" to "Ingeniería",
                                "facultad_icono" to "Hammer",
                                "facultad_color" to "#EF4444",
                                "estado" to "borrador",
                            )
                        ) {
                            abierta = true
                        }
                    }
                }
            }
        }
        compose.onNodeWithText("Criptografía aplicada").assertIsDisplayed().performClick()
        compose.runOnIdle { assertTrue(abierta) }
        compose.onNodeWithText("Maestría en Ciberseguridad").assertIsDisplayed()
        compose.onNodeWithText("CIB402 · 6 créditos · Semestre 4").assertIsDisplayed()
        compose.onNodeWithText("4").assertDoesNotExist()
        compose.onNodeWithText("borrador").assertDoesNotExist()
        compose.onNodeWithText("Nombre heredado").assertDoesNotExist()
        compose.onNodeWithText("Facultad de Ingeniería").assertDoesNotExist()
        compose
            .onNodeWithContentDescription("Facultad de Ingeniería", useUnmergedTree = true)
            .assertWidthIsEqualTo(18.dp)
        capturar("asignaturas-jerarquia")
    }

    @Test
    fun planNoCurricularConNombreLargoYTextoGrandeConservaDatos() {
        compose.setContent {
            CompositionLocalProvider(
                LocalDensity provides Density(LocalDensity.current.density, 1.6f)
            ) {
                TemaAcad("oscuro") {
                    Surface {
                        Column(Modifier.safeDrawingPadding().padding(24.dp)) {
                            FilaAsignatura(
                                objeto(
                                    "nombre" to
                                        "Fundamentos de investigación y desarrollo tecnológico",
                                    "codigo" to "INV01",
                                    "creditos" to 4.5,
                                    "numero_ciclo" to 2,
                                    "plan_tipo_ciclo" to "Cuatrimestre",
                                    "plan_tipo_estructura" to "NO_CURRICULAR",
                                    "plan_nombre" to
                                        "Actualización profesional en seguridad de sistemas de información",
                                    "carrera_nivel" to "Otro",
                                    "carrera_nombre" to "No sustituir el nombre del plan",
                                    "facultad_nombre" to "Ingeniería",
                                    "facultad_icono" to "Hammer",
                                    "facultad_color" to "#EF4444",
                                )
                            ) {}
                        }
                    }
                }
            }
        }
        compose
            .onNodeWithText("Actualización profesional en seguridad de sistemas de información")
            .assertIsDisplayed()
        compose.onNodeWithText("INV01 · 4.5 créditos · Cuatrimestre 2").assertIsDisplayed()
        compose.onNodeWithText("No sustituir el nombre del plan").assertDoesNotExist()
        capturar("asignaturas-texto-grande")
    }

    private fun capturar(nombre: String) {
        compose.waitForIdle()
        android.os.SystemClock.sleep(250)
        val instrumentacion = InstrumentationRegistry.getInstrumentation()
        val directorio =
            java.io
                .File(instrumentacion.targetContext.getExternalFilesDir(null), "preview-captures")
                .apply { mkdirs() }
        instrumentacion.uiAutomation.takeScreenshot()?.let { imagen ->
            java.io.File(directorio, "$nombre.png").outputStream().use {
                imagen.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
            }
            imagen.recycle()
        }
    }
}

package mx.sgi.acadia

import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.text.TextRange
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.CompletableDeferred
import mx.sgi.acadia.data.*
import mx.sgi.acadia.ui.*
import org.jsoup.Jsoup
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class ExperienciaNativaTest {
    @get:Rule val compose = createComposeRule()

    private fun captura(nombre: String) {
        compose.waitForIdle()
        // SurfaceFlinger may present the previous buffer for a frame after Compose becomes idle.
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
    fun formatoSemanticoSeConservaTrasRestaurarYGuardar() {
        var guardado = ""
        val restauracion = StateRestorationTester(compose)
        restauracion.setContent {
            TemaAcad("claro") {
                EditorTextoAcademico(
                    "Perfil de egreso",
                    "<p>Perfil</p><p>Aprendizaje académico</p>",
                    false,
                    null,
                    {},
                    { guardado = it },
                )
            }
        }
        val editor = compose.onNodeWithContentDescription("Contenido enriquecido")
        editor.performClick().performTextInputSelection(TextRange(7, 18))
        compose.onNodeWithContentDescription("Negrita").performClick()
        compose.onNodeWithContentDescription("Cursiva").performClick()
        editor.performTextInputSelection(TextRange(0, 6))
        compose.onNodeWithText("Párrafo").performClick()
        compose.onNodeWithText("Encabezado 2").performClick()
        restauracion.emulateSavedInstanceStateRestore()
        compose.onNodeWithText("Cambios sin guardar").assertExists()
        captura("editor-enriquecido-claro")
        compose.onNodeWithText("Guardar").performClick()
        val doc = Jsoup.parseBodyFragment(guardado)
        assertEquals("Perfil", doc.select("h2").text())
        assertEquals("Aprendizaje", doc.select("strong").text())
        assertEquals("Aprendizaje", doc.select("em").text())
        assertTrue(doc.select("span").isEmpty())
    }

    @Test
    fun listasYDescarteConservanElBorradorConTextoGrande() {
        var guardado = ""
        var cerrado = false
        compose.setContent {
            DeviceConfigurationOverride(DeviceConfigurationOverride.FontScale(1.3f)) {
                TemaAcad("oscuro") {
                    EditorTextoAcademico(
                        "Resultados de aprendizaje",
                        "<p>Investigar</p><p>Argumentar</p>",
                        false,
                        null,
                        { cerrado = true },
                        { guardado = it },
                    )
                }
            }
        }
        compose
            .onNodeWithContentDescription("Contenido enriquecido")
            .performClick()
            .performTextInputSelection(TextRange(0, 10))
        compose.onNodeWithContentDescription("Lista numerada").performClick()
        compose.onNodeWithContentDescription("Cerrar editor").performClick()
        compose.onNodeWithText("¿Descartar cambios?").assertExists()
        compose.onNodeWithText("Seguir editando").performClick()
        assertFalse(cerrado)
        captura("editor-enriquecido-oscuro-grande")
        compose.onNodeWithText("Guardar").performClick()
        assertEquals("Investigar", Jsoup.parseBodyFragment(guardado).select("ol li").text())
    }

    @Test
    fun arrastreNativoEntreCiclosYAlternativaAccesible() {
        val plan = objeto("id" to "plan", "numero_ciclos" to 3, "tipo_ciclo" to "Semestre")
        val materia =
            objeto(
                "id" to "materia",
                "nombre" to "Investigación curricular",
                "codigo" to "INV-01",
                "numero_ciclo" to 1,
                "creditos" to 6,
                "estado" to "borrador",
            )
        var expediente by mutableStateOf(Expediente(plan, asignaturas = listOf(materia)))
        compose.setContent {
            TemaAcad("claro") {
                Surface(Modifier.safeDrawingPadding()) {
                    MapaCurricular(
                        expediente,
                        true,
                        false,
                        null,
                        {},
                        {},
                        { registro, destino ->
                            expediente = moverEnMapa(expediente, registro.id, destino)
                        },
                    )
                }
            }
        }
        val inicio =
            compose
                .onNodeWithTag("asignatura-mapa-materia")
                .fetchSemanticsNode()
                .boundsInRoot
                .center
        val fin = compose.onNodeWithTag("celda-2-").fetchSemanticsNode().boundsInRoot.center
        SystemClock.sleep(500)
        captura("mapa-antes-arrastre")
        arrastrar(inicio, fin)
        captura("mapa-despues-arrastre")
        compose.waitUntil(5000) { expediente.asignaturas.single().celdaMapa().ciclo == 2 }
        compose.onNodeWithText("Abrir asignatura").assertDoesNotExist()
        compose.onNodeWithText("Mover asignatura").assertDoesNotExist()
        captura("mapa-arrastre")
        compose.onNodeWithContentDescription("Vista lista").performClick()
        compose.onNodeWithTag("asignatura-lista-materia").performClick()
        compose.onNodeWithText("Mover asignatura").performClick()
        compose.onNodeWithText("Ciclo de destino").performClick()
        compose.onNodeWithText("Semestre 3").performClick()
        compose.onNodeWithText("Guardar").performClick()
        compose.runOnIdle { assertEquals(3, expediente.asignaturas.single().celdaMapa().ciclo) }
    }

    private fun arrastrar(inicio: Offset, fin: Offset) {
        val ui = InstrumentationRegistry.getInstrumentation().uiAutomation
        val tiempo = SystemClock.uptimeMillis()
        fun enviar(accion: Int, punto: Offset) {
            val evento =
                MotionEvent.obtain(tiempo, SystemClock.uptimeMillis(), accion, punto.x, punto.y, 0)
            evento.source = InputDevice.SOURCE_TOUCHSCREEN
            try {
                assertTrue(ui.injectInputEvent(evento, true))
            } finally {
                evento.recycle()
            }
        }
        enviar(MotionEvent.ACTION_DOWN, inicio)
        compose.mainClock.advanceTimeBy(800)
        SystemClock.sleep(700)
        for (i in 1..20) {
            enviar(MotionEvent.ACTION_MOVE, inicio + (fin - inicio) * (i / 20f))
            SystemClock.sleep(20)
        }
        enviar(MotionEvent.ACTION_UP, fin)
    }

    @Test
    fun movimientoOptimistaRevierteYPermiteReintentar() {
        lateinit var vm: ContenidoViewModel<Int>
        val resultado = CompletableDeferred<Unit>()
        compose.runOnIdle { vm = ContenidoViewModel({ 1 }) }
        compose.waitUntil { vm.estado.value.datos == 1 }
        compose.runOnIdle {
            vm.guardarOptimista({ 2 }) {
                resultado.await()
                throw FalloAcad(CategoriaError.Red, "Sin conexión. Inténtalo de nuevo.")
            }
            assertEquals(2, vm.estado.value.datos)
            assertTrue(vm.guardando.value)
        }
        resultado.complete(Unit)
        compose.waitUntil { !vm.guardando.value }
        compose.runOnIdle {
            assertEquals(1, vm.estado.value.datos)
            assertEquals("Sin conexión. Inténtalo de nuevo.", vm.mensaje.value)
        }
    }
}

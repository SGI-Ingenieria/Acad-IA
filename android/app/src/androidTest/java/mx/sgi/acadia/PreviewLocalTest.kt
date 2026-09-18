package mx.sgi.acadia

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import mx.sgi.acadia.data.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Real emulator + local Supabase. Credentials are instrumentation arguments, not embedded in the
 * APK.
 */
@RunWith(AndroidJUnit4::class)
class PreviewLocalTest {
    private fun capturar(nombre: String) {
        compose.waitForIdle()
        android.os.SystemClock.sleep(250)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val directory =
            java.io
                .File(instrumentation.targetContext.getExternalFilesDir(null), "preview-captures")
                .apply { mkdirs() }
        instrumentation.uiAutomation.takeScreenshot()?.let { bitmap ->
            java.io.File(directory, "$nombre.png").outputStream().use {
                bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
            }
            bitmap.recycle()
        }
    }

    @get:Rule(order = 0)
    val permiso: org.junit.rules.TestRule =
        if (android.os.Build.VERSION.SDK_INT >= 37)
            androidx.test.rule.GrantPermissionRule.grant("android.permission.ACCESS_LOCAL_NETWORK")
        else org.junit.rules.TestRule { base, _ -> base }
    @get:Rule(order = 1) val compose = createAndroidComposeRule<MainActivity>()

    private fun esperar(texto: String) {
        compose.waitUntil(30000) {
            compose.onAllNodesWithText(texto).fetchSemanticsNodes().isNotEmpty()
        }
    }

    @Test
    fun accesoCatalogoExpedienteYTemas() {
        val args = InstrumentationRegistry.getArguments()
        val email = requireNotNull(args.getString("previewEmail")) { "Falta previewEmail" }
        val password = requireNotNull(args.getString("previewPassword")) { "Falta previewPassword" }
        compose.waitUntil(30000) {
            compose.onAllNodesWithText("Entrar a Acad-IA").fetchSemanticsNodes().isNotEmpty() ||
                compose
                    .onAllNodesWithText("Arquitectura del aprendizaje")
                    .fetchSemanticsNodes()
                    .isNotEmpty()
        }
        if (compose.onAllNodesWithText("Entrar a Acad-IA").fetchSemanticsNodes().isNotEmpty()) {
            compose.onNodeWithText("Correo electrónico").performTextInput(email)
            compose.onNodeWithText("Contraseña").performTextInput(password)
            androidx.test.espresso.Espresso.closeSoftKeyboard()
            compose
                .onNodeWithText("Entrar a Acad-IA")
                .performScrollTo()
                .assertIsEnabled()
                .performClick()
        }
        esperar("Arquitectura del aprendizaje")
        capturar("inicio")
        val repo = (compose.activity.application as AcadIAApplication).repositorio
        val plan = runBlocking {
            args
                .getString("previewSubjectId")
                ?.let { repo.asignatura(it).registro.texto("plan_estudio_id") }
                ?.let { repo.plan(it).registro } ?: repo.planes().first()
        }
        compose.onNodeWithContentDescription("Nuevo plan").performClick()
        esperar("Selecciona la facultad")
        compose.onNodeWithText("Selecciona la facultad").performClick()
        compose
            .onNodeWithText("Buscar facultad")
            .performTextInput(plan.objeto("carreras").objeto("facultades").nombre)
        compose
            .onNodeWithText(nombreFacultad(plan.objeto("carreras").objeto("facultades")))
            .performClick()
        compose.onNodeWithText("Selecciona la carrera").performClick()
        compose.onNodeWithText("Buscar carrera").performTextInput(plan.objeto("carreras").nombre)
        compose
            .onNode(hasText(plan.objeto("carreras").nombre) and !hasSetTextAction())
            .performClick()
        compose.onNodeWithText("Estructura académica").performClick()
        compose
            .onNode(hasText(plan.objeto("estructuras_plan").nombre) and hasAnyAncestor(isPopup()))
            .performClick()
        androidx.test.espresso.Espresso.closeSoftKeyboard()
        compose.onNodeWithText("Inicio de impartición").performScrollTo()
        capturar("alta-plan-facultad")
        compose.onNodeWithText("Inicio de impartición").performClick()
        esperar("Elegir mes")
        capturar("alta-mes-anio")
        compose.onNodeWithText("Elegir mes").performClick()
        compose.onNodeWithContentDescription("Volver").performClick()
        compose.onNodeWithText("Descartar").performClick()
        esperar("Explorar planes")
        compose.onNodeWithText("Explorar planes").performClick()
        esperar("Buscar planes")
        esperar(plan.nombre)
        compose.onNodeWithText(plan.nombre).performClick()
        esperar("Mapa curricular")
        compose.onNodeWithText("Mapa curricular").performClick()
        compose.waitUntil(30000) {
            compose
                .onAllNodesWithContentDescription("Vista lista")
                .fetchSemanticsNodes()
                .isNotEmpty()
        }
        capturar("mapa-curricular")
        compose.onNodeWithContentDescription("Vista lista").performClick()
        val materia = runBlocking { repo.plan(plan.id).asignaturas.first() }
        compose.onNode(hasScrollToNodeAction()).performScrollToNode(hasText(materia.nombre))
        compose.onNodeWithText(materia.nombre).performClick()
        esperar("Bibliografía")
        compose.onNodeWithText("Contenido", useUnmergedTree = true).performClick()
        compose.onNodeWithContentDescription("Añadir unidad").assertExists()
        compose.onNodeWithText("Evaluación", useUnmergedTree = true).performClick()
        compose.onNodeWithContentDescription("Editar evaluación").assertExists()
        compose.onNodeWithText("Bibliografía", useUnmergedTree = true).performClick()
        compose.onNodeWithContentDescription("Actualizar").assertDoesNotExist()
        compose.onNodeWithContentDescription("Añadir referencia").assertExists()
        compose.onNodeWithContentDescription("Historial de cambios").assertDoesNotExist()
        compose.onNodeWithText("Revisión", useUnmergedTree = true).performClick()
        compose.onNodeWithContentDescription("Historial de cambios").assertExists()
        compose.onNodeWithContentDescription("Historial de cambios").performClick()
        esperar("Historial")
        capturar("historial-local")
        compose.onNodeWithContentDescription("Cerrar historial").performClick()
        compose.onNodeWithContentDescription("Volver").performClick()
        compose.onNodeWithContentDescription("Volver").performClick()
        args.getString("previewSubjectId")?.let { id ->
            val fixture = runBlocking { repo.asignatura(id).registro }
            // Only the runner's temporary subject is moved or edited.
            runBlocking { repo.moverAsignaturaMapa(plan, fixture, CeldaMapa(2, null)) }
            assertEquals(2, runBlocking { repo.asignatura(id).registro.numero("numero_ciclo") })
            compose.onNodeWithText("Asignaturas").performClick()
            esperar("Buscar asignaturas")
            val primera = runBlocking { repo.asignaturas().first() }
            esperar(primera.nombre)
            compose.onAllNodesWithText(nombrePlanAsignatura(primera)).onFirst().assertIsDisplayed()
            capturar("catalogo-asignaturas")
            compose.onNodeWithText("Buscar asignaturas").performTextInput(fixture.nombre)
            androidx.test.espresso.Espresso.closeSoftKeyboard()
            val fila = hasText(fixture.nombre) and !hasSetTextAction()
            compose.waitUntil(30000) { compose.onAllNodes(fila).fetchSemanticsNodes().isNotEmpty() }
            compose.onNode(fila).performClick()
            esperar("Editar")
            compose.onNodeWithText("Resumen", useUnmergedTree = true).performClick()
            val etiqueta = "Fines de aprendizaje o formación"
            compose
                .onNodeWithContentDescription("Editar $etiqueta")
                .performScrollTo()
                .performClick()
            compose
                .onNodeWithContentDescription("Contenido enriquecido")
                .performTextInput("Investigar con evidencia")
            compose
                .onNodeWithContentDescription("Contenido enriquecido")
                .performTextInputSelection(androidx.compose.ui.text.TextRange(0, 10))
            compose.onNodeWithContentDescription("Negrita").performClick()
            compose.onNodeWithContentDescription("Cursiva").performClick()
            compose.onNodeWithText("Guardar").performClick()
            esperar("Cambios guardados")
            val enriquecido = runBlocking {
                repo
                    .asignatura(id)
                    .registro
                    .objeto("datos")
                    .texto("fines_de_aprendizaje_o_formacion")
            }
            assertEquals(
                "Investigar",
                org.jsoup.Jsoup.parseBodyFragment(enriquecido)
                    .select("strong em, em strong")
                    .text(),
            )
            compose
                .onNodeWithContentDescription("Editar $etiqueta")
                .performScrollTo()
                .performClick()
            compose
                .onNodeWithContentDescription("Contenido enriquecido")
                .assertTextContains("Investigar con evidencia")
            compose.onNodeWithContentDescription("Cerrar editor").performClick()
            compose.onNodeWithText("Editar").performClick()
            esperar("Datos generales")
            compose
                .onNode(hasText("Horas académicas") and hasSetTextAction())
                .performScrollTo()
                .performTextReplacement("16")
            compose
                .onNode(hasText("Horas independientes") and hasSetTextAction())
                .performScrollTo()
                .performTextReplacement("32")
            androidx.test.espresso.Espresso.closeSoftKeyboard()
            compose.onNodeWithText("Guardar").performClick()
            esperar("Cambios guardados")
            assertEquals(
                16,
                runBlocking { repo.asignatura(id).registro.numero("horas_academicas") },
            )
            compose.onNodeWithText("Evaluación", useUnmergedTree = true).performClick()
            compose.onNodeWithContentDescription("Editar evaluación").performClick()
            compose.onNodeWithText("Añadir criterio").performClick()
            compose.onNodeWithText("Criterio 1").performTextInput("Proyecto integrador")
            compose.onNodeWithText("Porcentaje").performTextReplacement("100")
            androidx.test.espresso.Espresso.closeSoftKeyboard()
            compose.onNodeWithText("Guardar").performClick()
            esperar("Cambios guardados")
            assertEquals(
                "Proyecto integrador",
                runBlocking {
                    repo
                        .asignatura(id)
                        .registro
                        .lista("criterios_de_evaluacion")
                        .single()
                        .texto("nombre")
                },
            )
            // A stale update must not silently overwrite the just-saved record.
            try {
                runBlocking {
                    repo.guardarAsignatura(
                        id,
                        objeto("nombre" to "No guardar"),
                        fixture.texto("actualizado_en"),
                    )
                }
                fail("La edición obsoleta debía producir un conflicto")
            } catch (e: FalloAcad) {
                assertEquals(CategoriaError.Conflicto, e.categoria)
            }
            compose.onNodeWithContentDescription("Volver").performClick()
        }
        args.getString("previewCreatedPlanId")?.let { id ->
            compose.onNodeWithText("Planes", useUnmergedTree = true).performClick()
            esperar("Buscar planes")
            // A create must appear in this already-mounted catalogue without a refresh.
            val nuevoPlan = runBlocking {
                val carrera = plan.objeto("carreras")
                val existentes =
                    repo
                        .filas("planes_estudio", "carrera_id", carrera.id)
                        .map { it.texto("fecha_inicio_imparticion") }
                        .toSet()
                val fecha =
                    (1L..360L)
                        .map {
                            java.time.LocalDate.now().plusMonths(it).withDayOfMonth(1).toString()
                        }
                        .first { it !in existentes }
                repo.crearPlan(
                    carrera,
                    plan.objeto("estructuras_plan"),
                    "",
                    fecha,
                    plan.numero("numero_ciclos"),
                    plan.numero("semanas_por_ciclo", 16),
                    plan.texto("tipo_ciclo"),
                    id,
                )
            }
            esperar(nuevoPlan.nombre)
            compose.onNodeWithContentDescription("Actualizar").assertDoesNotExist()
            compose.onNodeWithText(nuevoPlan.nombre).performClick()
            esperar("Mapa curricular")
            compose.onNodeWithContentDescription("Volver").performClick()
            esperar(nuevoPlan.nombre)
            compose.onNodeWithText("Inicio", useUnmergedTree = true).performClick()
            esperar("Arquitectura del aprendizaje")
            compose.onNode(hasScrollToNodeAction()).performScrollToNode(hasText(nuevoPlan.nombre))
            compose.onNodeWithText(nuevoPlan.nombre).assertExists()
            capturar("plan-nuevo-sin-refrescar")
        }
        compose.onNodeWithText("Cuenta").performClick()
        esperar("Apariencia")
        compose.onNodeWithText("Apariencia").performClick()
        compose.onNode(hasText("Oscuro") and hasAnyAncestor(isPopup())).performClick()
        compose.onNodeWithText("Oscuro").assertExists()
        capturar("cuenta-oscuro")
        compose.activityRule.scenario.recreate()
        esperar("Apariencia")
        compose.onNodeWithText("Oscuro").assertExists()
        compose.onNodeWithText("Apariencia").performClick()
        compose.onNode(hasText("Claro") and hasAnyAncestor(isPopup())).performClick()
        compose.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("Cerrar sesión"))
        compose.onNodeWithText("Cerrar sesión").performClick()
        compose.onNode(hasText("Cerrar sesión") and hasAnyAncestor(isDialog())).performClick()
        esperar("Entrar a Acad-IA")
        assertNull(repo.sesionActual())
        compose.onNodeWithText("Correo electrónico").performTextInput(email)
        compose.onNodeWithText("Contraseña").performTextInput(password)
        androidx.test.espresso.Espresso.closeSoftKeyboard()
        compose.onNodeWithText("Entrar a Acad-IA").performScrollTo().performClick()
        esperar("Arquitectura del aprendizaje")
        assertEquals(email, repo.sesionActual()?.correo)
    }
}

package mx.sgi.acadia

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.*
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
        capturarPantalla(nombre)
    }

    private fun capturarPantalla(nombre: String) {
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
    @get:Rule(order = 2)
    val capturaFallo =
        object : org.junit.rules.TestWatcher() {
            override fun failed(error: Throwable, descripcion: org.junit.runner.Description) {
                // This inner rule runs while Compose/Activity still exist. Do not wait for Compose
                // idleness here: a failed synchronization is itself worth capturing.
                runCatching { capturarPantalla("fallo-${descripcion.methodName}") }
                    .onFailure(error::addSuppressed)
            }
        }

    private fun esperar(texto: String) {
        compose.waitUntil(30000) {
            compose.onAllNodesWithText(texto).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun esperarCierreEditorGuardado() {
        // ContenidoViewModel closes a form only after the write succeeds; on failure it stays
        // open with the error. The short-lived success Snackbar is not a durable save signal.
        compose.waitUntil(30000) { compose.onAllNodes(isDialog()).fetchSemanticsNodes().isEmpty() }
    }

    private fun comprobarInicioVacio() {
        esperar("Inicio")
        listOf("Inicio", "Planes", "Asignaturas", "Cuenta").forEach {
            compose.onNodeWithText(it, useUnmergedTree = true).assertExists()
        }
        compose.onNodeWithText("Planes recientes").assertDoesNotExist()
        compose.onNodeWithText("Actividad").assertDoesNotExist()
        compose.onNodeWithContentDescription("Nuevo plan").assertDoesNotExist()
    }

    private fun comprobarChatBorrador(repo: RepositorioAcad, id: String, asignatura: Boolean) {
        fun conversacionesPersistidas() = runBlocking {
            // The recent-chat query uses !inner(messages), which would hide exactly the empty
            // conversations this regression needs to catch. Read the underlying table instead.
            repo
                .filas(
                    if (asignatura) "conversaciones_asignatura" else "conversaciones_plan",
                    if (asignatura) "asignatura_id" else "plan_estudio_id",
                    id,
                    asc = false,
                    columnas = "id",
                )
                .map { it.id }
                .toSet()
        }
        val antes = conversacionesPersistidas()
        compose.onNodeWithContentDescription("Asistente IA").performClick()
        esperar("¿Qué quieres trabajar?")
        compose.onNodeWithContentDescription("Chats recientes").assertExists()
        compose.onNodeWithContentDescription("Dictar consulta").assertExists()
        compose.onNodeWithContentDescription("Enviar consulta").assertIsNotEnabled()
        assertEquals("Abrir IA no debe crear una conversación", antes, conversacionesPersistidas())
        compose
            .onNodeWithContentDescription("Consulta al asistente")
            .performTextInput("Borrador local sin enviar")
        androidx.test.espresso.Espresso.closeSoftKeyboard()
        compose.onNodeWithContentDescription("Enviar consulta").assertIsEnabled()
        // Intentionally never invoke the AI endpoint: abandoning a draft is a read-only flow.
        compose.onNodeWithContentDescription("Volver").performClick()
        esperar(if (asignatura) "Bibliografía" else "Mapa curricular")
        assertEquals(
            "Abandonar el borrador no debe crear una conversación",
            antes,
            conversacionesPersistidas(),
        )
    }

    // Separate REST client: bypasses RepositorioAcad.invalidar, so the screen can only
    // discover this write through its real authenticated WebSocket subscription.
    private fun comentarioExterno(id: String, cuerpo: String, email: String, password: String) {
        fun post(ruta: String, body: Registro, token: String = BuildConfig.SUPABASE_KEY): String {
            val conexion =
                java.net.URI("${BuildConfig.SUPABASE_URL}/$ruta").toURL().openConnection()
                    as java.net.HttpURLConnection
            try {
                conexion.requestMethod = "POST"
                conexion.connectTimeout = 15000
                conexion.readTimeout = 15000
                conexion.setRequestProperty("apikey", BuildConfig.SUPABASE_KEY)
                conexion.setRequestProperty("Authorization", "Bearer $token")
                conexion.setRequestProperty("Content-Type", "application/json")
                conexion.doOutput = true
                conexion.outputStream.use { it.write(body.toString().toByteArray()) }
                check(conexion.responseCode in 200..299) {
                    "Cliente externo: HTTP ${conexion.responseCode}"
                }
                return conexion.inputStream.bufferedReader().use { it.readText() }
            } finally {
                conexion.disconnect()
            }
        }
        val sesion =
            Json.parseToJsonElement(
                    post(
                        "auth/v1/token?grant_type=password",
                        objeto("email" to email, "password" to password),
                    )
                )
                .jsonObject
        post(
            "rest/v1/comentarios_asignatura",
            objeto(
                "asignatura_id" to id,
                "autor_id" to sesion.objeto("user").id,
                "cuerpo" to cuerpo,
            ),
            sesion.texto("access_token"),
        )
    }

    @Test
    fun accesoCatalogoExpedienteYTemas() {
        val args = InstrumentationRegistry.getArguments()
        val email = requireNotNull(args.getString("previewEmail")) { "Falta previewEmail" }
        val password = requireNotNull(args.getString("previewPassword")) { "Falta previewPassword" }
        compose.waitUntil(30000) {
            compose.onAllNodesWithText("Entrar a Acad-IA").fetchSemanticsNodes().isNotEmpty() ||
                compose.onAllNodesWithText("Inicio").fetchSemanticsNodes().isNotEmpty()
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
        comprobarInicioVacio()
        capturar("inicio")
        val repo = (compose.activity.application as AcadIAApplication).repositorio
        val plan = runBlocking {
            args
                .getString("previewSubjectId")
                ?.let { repo.asignatura(it).registro.texto("plan_estudio_id") }
                ?.let { repo.plan(it).registro } ?: repo.planes().first()
        }
        compose.onNodeWithText("Planes", useUnmergedTree = true).performClick()
        esperar("Buscar planes")
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
        compose
            .onNodeWithText("Buscar carrera")
            .performTextInput(nombreCarrera(plan.objeto("carreras")))
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
        esperar("Buscar planes")
        esperar(plan.nombre)
        compose.onNodeWithText(plan.nombre).performClick()
        esperar("Mapa curricular")
        comprobarChatBorrador(repo, plan.id, false)
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
        compose.onNodeWithText("Revisión", useUnmergedTree = true).performScrollTo().performClick()
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
            comprobarChatBorrador(repo, id, true)
            compose
                .onNodeWithContentDescription("Asignar profesor responsable")
                .assertDoesNotExist()
            compose
                .onNodeWithText("Responsables", useUnmergedTree = true)
                .performScrollTo()
                .performClick()
            compose.waitUntil(30000) {
                compose
                    .onAllNodesWithContentDescription("Asignar profesor responsable")
                    .fetchSemanticsNodes()
                    .isNotEmpty()
            }
            compose.onNodeWithContentDescription("Asignar profesor responsable").assertIsDisplayed()
            capturar("responsables-pestana")
            compose
                .onNodeWithText("Resumen", useUnmergedTree = true)
                .performScrollTo()
                .performClick()
            compose
                .onNodeWithContentDescription("Asignar profesor responsable")
                .assertDoesNotExist()
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
            compose.onNodeWithText("Guardar").assertIsEnabled().performClick()
            esperarCierreEditorGuardado()
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
            esperarCierreEditorGuardado()
            assertEquals(
                16,
                runBlocking { repo.asignatura(id).registro.numero("horas_academicas") },
            )
            compose.onNodeWithText("Evaluación", useUnmergedTree = true).performClick()
            compose.onNodeWithContentDescription("Editar evaluación").performClick()
            compose.onNodeWithText("Nuevo criterio").performTextInput("Proyecto integrador")
            compose.onNodeWithText("%").performTextInput("100")
            compose.onNodeWithContentDescription("Añadir criterio").performClick()
            capturar("editor-evaluacion")
            androidx.test.espresso.Espresso.closeSoftKeyboard()
            compose.onNodeWithText("Guardar").performClick()
            esperarCierreEditorGuardado()
            assertEquals(
                "Proyecto integrador",
                runBlocking {
                    repo
                        .asignatura(id)
                        .registro
                        .lista("criterios_de_evaluacion")
                        .single()
                        .texto("criterio")
                },
            )
            compose.onNodeWithText("Contenido", useUnmergedTree = true).performClick()
            compose.onNodeWithContentDescription("Añadir unidad").performClick()
            compose.onNodeWithText("Título de la unidad").performTextInput("Investigación aplicada")
            compose.onNodeWithText("Nuevo tema").performTextInput("Evidencia y método")
            compose.onNodeWithContentDescription("Añadir tema").performClick()
            capturar("editor-temas")
            compose.onNodeWithText("Guardar").performClick()
            esperarCierreEditorGuardado()
            val unidadGuardada = runBlocking {
                repo.asignatura(id).registro.lista("contenido_tematico").single {
                    it.texto("titulo") == "Investigación aplicada"
                }
            }
            assertEquals("Evidencia y método", unidadGuardada.lista("temas").single().nombre)
            compose
                .onNodeWithText("Revisión", useUnmergedTree = true)
                .performScrollTo()
                .performClick()
            compose.onNodeWithContentDescription("Historial de cambios").assertExists()
            runBlocking { withTimeout(20000) { repo.conexionTiempoReal.first { it } } }
            // No navigation or local mutation occurs between the external write and this assertion.
            val comentario = "Revisión externa ${java.util.UUID.randomUUID()}"
            comentarioExterno(id, comentario, email, password)
            esperar(comentario)
            capturar("revision-sincronizada")
            compose.onNodeWithContentDescription("Marcar como resuelta").performClick()
            esperar("Resueltos · 1")
            compose.onNodeWithText("Resueltos · 1").performClick()
            esperar(comentario)
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
            compose
                .onNodeWithContentDescription("Editar Duración del ciclo")
                .performScrollTo()
                .performClick()
            esperar("Datos generales")
            compose.onNodeWithText("Semanas por ciclo").performTextReplacement("18")
            androidx.test.espresso.Espresso.closeSoftKeyboard()
            compose.onNodeWithText("Guardar").performClick()
            esperarCierreEditorGuardado()
            esperar("18 semanas")
            assertEquals(18, runBlocking { repo.plan(id).registro.numero("semanas_por_ciclo") })
            compose.onNodeWithContentDescription("Volver").performClick()
            esperar(nuevoPlan.nombre)
            compose.onNodeWithText("Inicio", useUnmergedTree = true).performClick()
            comprobarInicioVacio()
            compose.onNodeWithText(nuevoPlan.nombre).assertDoesNotExist()
            // The catalogue still reconciles the new plan after leaving and returning, while
            // Inicio deliberately remains empty rather than duplicating catalogue content.
            compose.onNodeWithText("Planes", useUnmergedTree = true).performClick()
            esperar("Buscar planes")
            esperar(nuevoPlan.nombre)
            compose.onNodeWithText(nuevoPlan.nombre).assertExists()
            capturar("plan-nuevo-sin-refrescar")
        }
        compose.onNodeWithText("Cuenta").performClick()
        esperar("Apariencia")
        compose.onNodeWithText("Facultades y carreras").performScrollTo().performClick()
        esperar("Buscar en el catálogo")
        compose
            .onNodeWithText("Buscar en el catálogo")
            .performTextInput(plan.objeto("carreras").nombre)
        esperar(plan.objeto("carreras").nombre)
        capturar("facultad-carreras")
        compose.onNodeWithContentDescription("Volver").performClick()
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
        comprobarInicioVacio()
        assertEquals(email, repo.sesionActual()?.correo)
    }
}

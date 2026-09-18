package mx.sgi.acadia

import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import mx.sgi.acadia.data.*
import org.junit.Assert.*
import org.junit.Test

class ChatAcademicoTest {
    @Test
    fun soloCaducanSolicitudesSinPublicarTrasUnaHora() {
        val inicio = java.time.Instant.parse("2026-09-18T12:00:00Z").toEpochMilli()
        val pendiente =
            objeto("estado" to "PROCESANDO", "fecha_actualizacion" to "2026-09-18T12:00:00Z")
        assertTrue(chatEnProceso(pendiente, inicio + PLAZO_CHAT_SIN_PUBLICAR_MS - 1))
        assertFalse(chatSinPublicarCaducado(pendiente, inicio + PLAZO_CHAT_SIN_PUBLICAR_MS - 1))
        assertTrue(chatSinPublicarCaducado(pendiente, inicio + PLAZO_CHAT_SIN_PUBLICAR_MS))
        assertFalse(chatEnProceso(pendiente, inicio + PLAZO_CHAT_SIN_PUBLICAR_MS))
        val publicado = JsonObject(pendiente + objeto("openai_response_id" to "response_id"))
        assertFalse(chatSinPublicarCaducado(publicado, inicio + 2 * PLAZO_CHAT_SIN_PUBLICAR_MS))
        assertTrue(chatEnProceso(publicado, inicio + 2 * PLAZO_CHAT_SIN_PUBLICAR_MS))
    }

    @Test
    fun vencimientoRespetaEstadoFinalYTimestampUtcSinZona() {
        val sinZona = objeto("estado" to "PENDIENTE", "fecha_creacion" to "2026-09-18T12:00:00")
        val esperado = java.time.Instant.parse("2026-09-18T13:00:00Z").toEpochMilli()
        assertEquals(esperado, vencimientoChatSinPublicar(sinZona))
        assertNull(
            vencimientoChatSinPublicar(JsonObject(sinZona + objeto("estado" to "COMPLETADO")))
        )
        assertNull(
            vencimientoChatSinPublicar(
                objeto("estado" to "PROCESANDO", "fecha_creacion" to "fecha inválida")
            )
        )
    }

    @Test
    fun abrirYCerrarSinEnviarNoCreaConversacion() = runBlocking {
        var creaciones = 0
        val borrador = BorradorChat()
        assertNull(borrador.conversacionId)
        assertFalse(
            borrador.enviar(
                " \n ",
                {
                    creaciones++
                    "id"
                },
                { _, _ -> error("No debe enviar") },
            )
        )
        assertEquals(0, creaciones)
        assertNull(borrador.conversacionId)
    }

    @Test
    fun primerEnvioCreaUnaVezYConservaIdAlFallar() = runBlocking {
        var creaciones = 0
        var guardado = ""
        val borrador = BorradorChat(guardarId = { guardado = it })
        val fallo = runCatching {
            borrador.enviar(
                " Consulta ",
                {
                    creaciones++
                    "chat"
                },
                { _, _ -> error("Sin red") },
            )
        }
        assertTrue(fallo.isFailure)
        assertEquals("chat", guardado)
        assertEquals("chat", borrador.conversacionId)
        assertTrue(
            borrador.enviar(
                " Consulta ",
                {
                    creaciones++
                    "otro"
                },
                { id, texto ->
                    assertEquals("chat", id)
                    assertEquals("Consulta", texto)
                },
            )
        )
        assertEquals(1, creaciones)
    }

    @Test
    fun dobleToqueNoDuplicaEnvio() = runBlocking {
        var enviados = 0
        val barrera = CompletableDeferred<Unit>()
        val iniciado = CompletableDeferred<Unit>()
        val borrador = BorradorChat("chat")
        val primero = async {
            borrador.enviar(
                "consulta",
                { error("Ya existe") },
                { _, _ ->
                    enviados++
                    iniciado.complete(Unit)
                    barrera.await()
                },
            )
        }
        iniciado.await()
        assertFalse(borrador.enviar("consulta", { error("Ya existe") }, { _, _ -> enviados++ }))
        barrera.complete(Unit)
        assertTrue(primero.await())
        assertEquals(1, enviados)
    }

    @Test
    fun cancelacionLiberaBloqueoSinPerderConversacion() = runBlocking {
        val borrador = BorradorChat("chat")
        val esperando = CompletableDeferred<Unit>()
        val envio = launch {
            borrador.enviar(
                "consulta",
                { error("Ya existe") },
                { _, _ ->
                    esperando.complete(Unit)
                    awaitCancellation()
                },
            )
        }
        esperando.await()
        envio.cancelAndJoin()
        assertEquals("chat", borrador.conversacionId)
        assertTrue(borrador.enviar("nueva", { error("Ya existe") }, { _, _ -> }))
    }

    @Test
    fun recomendacionesIncompletasORechazadasNoSonAplicables() {
        val propuesta =
            objeto(
                "recommendations" to
                    JsonArray(
                        listOf(objeto("campo_afectado" to "objetivo", "texto_mejora" to "Texto"))
                    )
            )
        assertTrue(
            recomendacionesChat(objeto("estado" to "PROCESANDO", "propuesta" to propuesta))
                .isEmpty()
        )
        assertTrue(
            recomendacionesChat(
                    objeto("estado" to "COMPLETADO", "is_refusal" to true, "propuesta" to propuesta)
                )
                .isEmpty()
        )
        assertEquals(
            "campo",
            recomendacionesChat(objeto("estado" to "COMPLETADO", "propuesta" to propuesta))
                .single()
                .tipo,
        )
    }

    @Test
    fun camposDePlanConservanMetadatosDeDescripcion() {
        val plan =
            objeto(
                "datos" to
                    objeto(
                        "objetivo" to objeto("description" to "Antes", "evidencia" to "Acta"),
                        "otro" to "Conservar",
                    )
            )
        val parche =
            parcheRecomendacionChat(
                plan,
                false,
                objeto("campo_afectado" to "objetivo", "texto_mejora" to "Después"),
            )
        assertEquals("Después", parche.objeto("datos").objeto("objetivo").texto("description"))
        assertEquals("Acta", parche.objeto("datos").objeto("objetivo").texto("evidencia"))
        assertEquals("Conservar", parche.objeto("datos").texto("otro"))
    }

    @Test
    fun contenidoYEvaluacionVanEnColumnasCanonicas() {
        val contenido = "[{\"unidad\":1,\"titulo\":\"Introducción\",\"temas\":[\"Conceptos\"]}]"
        val parche =
            parcheRecomendacionChat(
                objeto(),
                true,
                objeto("campo_afectado" to "contenido_tematico", "texto_mejora" to contenido),
            )
        assertEquals("Introducción", parche.lista("contenido_tematico").single().texto("titulo"))
        assertFalse(parche.containsKey("datos"))
        assertTrue(
            runCatching {
                parcheRecomendacionChat(
                    objeto(),
                    true,
                    objeto(
                        "campo_afectado" to "criterios_de_evaluacion",
                        "texto_mejora" to "[{\"criterio\":\"Examen\",\"porcentaje\":20}]",
                    ),
                )
            }
                .isFailure
        )
    }

    @Test
    fun cicloActualizaMapaYDatoAcademico() {
        val parche =
            parcheRecomendacionChat(
                objeto("datos" to objeto("objetivo" to "Conservar")),
                true,
                objeto("campo_afectado" to "ciclo", "texto_mejora" to "Ciclo 4"),
            )
        assertEquals(4, parche.numero("numero_ciclo"))
        assertEquals("Ciclo 4", parche.objeto("datos").texto("ciclo"))
        assertEquals("Conservar", parche.objeto("datos").texto("objetivo"))
    }

    @Test
    fun idsDeterministasEvitanDuplicarBibliografiaYBloquesAlReintentar() {
        assertEquals(
            idAplicacionChat("mensaje", "action_proposals:0"),
            idAplicacionChat("mensaje", "action_proposals:0"),
        )
        assertNotEquals(
            idAplicacionChat("mensaje", "action_proposals:0"),
            idAplicacionChat("mensaje", "action_proposals:1"),
        )
    }

    @Test
    fun asignarBloqueNoReescribeUnCicloAnteriorNiExigeTenerCiclo() {
        val bloques = listOf(objeto("id" to "bloque"))
        listOf(JsonNull, JsonPrimitive(0), JsonPrimitive(2), JsonPrimitive(99)).forEach { ciclo ->
            val cambio =
                parcheMovimientoChat(
                    "asignacion",
                    objeto("linea_plan_id" to "bloque", "numero_ciclo" to ciclo),
                    8,
                    bloques,
                )
            assertEquals(objeto("linea_plan_id" to "bloque"), cambio)
            assertFalse(cambio.containsKey("numero_ciclo"))
        }
    }

    @Test
    fun cambioDeCicloSoloModificaCicloYValidaRango() {
        assertEquals(
            objeto("numero_ciclo" to 3),
            parcheMovimientoChat(
                "cambio_ciclo",
                objeto("numero_ciclo" to 3, "linea_plan_id" to "no-cambiar"),
                8,
                emptyList(),
            ),
        )
        listOf(JsonNull, JsonPrimitive(0), JsonPrimitive(9)).forEach { ciclo ->
            assertTrue(
                runCatching {
                    parcheMovimientoChat(
                        "cambio_ciclo",
                        objeto("numero_ciclo" to ciclo),
                        8,
                        emptyList(),
                    )
                }
                    .isFailure
            )
        }
    }

    @Test
    fun asignarBloqueSigueRechazandoDestinosAjenosAlPlan() {
        assertTrue(
            runCatching {
                parcheMovimientoChat(
                    "asignacion",
                    objeto("linea_plan_id" to "ajeno"),
                    8,
                    listOf(objeto("id" to "propio")),
                )
            }
                .isFailure
        )
    }

    @Test
    fun navegarEntreChatsConservaCadaConsultaIncluidaLaNueva() {
        val memoria = mutableMapOf<String, String>()
        val borradores =
            BorradoresConsultaChat(memoria::get) { clave, valor -> memoria[clave] = valor }
        assertEquals("", borradores.cambiar(null, "chat-a", "Consulta nueva sin enviar"))
        assertEquals("", borradores.cambiar("chat-a", "chat-b", "Borrador A"))
        assertEquals("Borrador A", borradores.cambiar("chat-b", "chat-a", "Borrador B"))
        assertEquals(
            "Consulta nueva sin enviar",
            borradores.cambiar("chat-a", null, "Borrador A editado"),
        )
        assertEquals("Borrador B", borradores.cambiar(null, "chat-b", "Consulta nueva corregida"))
        assertEquals("Borrador A editado", borradores.restaurar("chat-a"))
        assertEquals("Consulta nueva corregida", borradores.restaurar(null))
    }

    @Test
    fun primerEnvioTrasladaBorradorAlChatCreadoSinDuplicarloEnNuevoChat() {
        val memoria = mutableMapOf<String, String>()
        val borradores =
            BorradoresConsultaChat(memoria::get) { clave, valor -> memoria[clave] = valor }
        borradores.escribir(null, "Consulta pendiente")
        borradores.escribir("otro", "Consulta de otro chat")
        borradores.vincularConversacionCreada("creado", "Consulta pendiente editada durante envío")
        assertEquals("", borradores.restaurar(null))
        assertEquals("Consulta pendiente editada durante envío", borradores.restaurar("creado"))
        assertEquals("Consulta de otro chat", borradores.restaurar("otro"))
        borradores.escribir("creado", "")
        assertEquals("", borradores.restaurar("creado"))
        assertEquals("Consulta de otro chat", borradores.restaurar("otro"))
    }

    @Test
    fun restaurarBorradoresUsaEstadoGuardadoYAdmiteConsultaLegada() {
        val memoria = mutableMapOf<String, String>()
        val inicial =
            BorradoresConsultaChat(memoria::get) { clave, valor -> memoria[clave] = valor }
        assertEquals(
            "Texto anterior a la actualización",
            inicial.restaurar("chat", "Texto anterior a la actualización"),
        )
        inicial.escribir("chat", "Borrador guardado")
        val restaurado =
            BorradoresConsultaChat(memoria::get) { clave, valor -> memoria[clave] = valor }
        assertEquals("Borrador guardado", restaurado.restaurar("chat", "No sobrescribir"))
        restaurado.escribir("chat", "")
        assertEquals("", restaurado.restaurar("chat", "No resucitar borrador enviado"))
    }

    @Test
    fun tipoAcademicoNoOcultaPropuestaDeAsignatura() {
        val propuesta =
            RecomendacionChat(
                "action_proposals",
                0,
                objeto("tipo" to "OBLIGATORIA", "nombre" to "Criptografía"),
            )
        assertEquals("asignatura", propuesta.tipo)
    }
}

package mx.sgi.acadia.data

import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class ResponsablesAsignaturaTest {
    @Test
    fun `asignacion fallida conserva invitacion y reintento no envia otro correo`() = runBlocking {
        var correos = 0
        var invitado: Registro? = null
        val enviar: suspend () -> Registro = {
            correos++
            objeto("id" to "profesor")
        }
        try {
            completarInvitacionProfesor(null, enviar, { invitado = it }) {
                throw IllegalStateException("Sin conexión")
            }
            fail("Debe indicar el resultado parcial")
        } catch (e: FalloAcad) {
            assertTrue(e.message.contains("ya fue enviada"))
        }
        assertEquals("profesor", invitado?.id)
        var asignado = ""
        completarInvitacionProfesor(invitado, enviar, { invitado = it }) { asignado = it }
        assertEquals(1, correos)
        assertEquals("profesor", asignado)
    }

    @Test
    fun `invitacion rechazada no intenta asignar ni registra un usuario`() = runBlocking {
        var recordado = false
        var asignado = false
        try {
            completarInvitacionProfesor(
                null,
                { throw IllegalArgumentException("Correo duplicado") },
                { recordado = true },
                { asignado = true },
            )
            fail("Debe propagar rechazo de invitación")
        } catch (_: IllegalArgumentException) {}
        assertFalse(recordado)
        assertFalse(asignado)
    }

    @Test
    fun `selector excluye bajas expertos externos y profesores ya asignados`() {
        val datos =
            DatosResponsables(
                listOf(objeto("usuario_id" to "asignado", "rol" to "PROFESOR_RESPONSABLE")),
                listOf(
                    objeto("id" to "asignado", "nombre_completo" to "Ana"),
                    objeto("id" to "externo", "externo" to true),
                    objeto("id" to "baja", "dado_de_baja_en" to "2026-09-18"),
                    objeto(
                        "id" to "candidato",
                        "nombre_completo" to "María Gómez",
                        "email" to "maria@example.edu",
                    ),
                ),
                true,
                true,
            )
        assertEquals(listOf("candidato"), candidatosResponsables(datos, "maria").map { it.id })
        assertEquals(
            listOf("candidato"),
            candidatosResponsables(datos, "example.edu").map { it.id },
        )
        assertTrue(candidatosResponsables(datos, "otra persona").isEmpty())
    }

    @Test
    fun `invitacion requiere nombre y correo valido`() {
        assertNotNull(validarInvitacionProfesor("", "profesor@example.edu"))
        assertNotNull(validarInvitacionProfesor("María", "sin-correo"))
        assertNotNull(validarInvitacionProfesor("María", "a b@example.edu"))
        assertNull(validarInvitacionProfesor(" María ", " maria@example.edu "))
    }
}

package mx.sgi.acadia.data

import java.time.ZoneId
import org.junit.Assert.*
import org.junit.Test

class RevisionAcademicaTest {
    @Test
    fun `el envio nombra al secretario sin inventar destinos autorizados`() {
        val expediente =
            Expediente(
                objeto("estados_plan" to objeto("orden" to 10)),
                transiciones =
                    listOf(objeto("id" to "revision", "clave" to "REVISION", "orden" to 20)),
            )
        val acciones = accionesRevision(expediente, false)
        assertEquals(1, acciones.size)
        assertEquals("Enviar a revisión con el secretario académico", acciones.single().etiqueta)
        assertFalse(acciones.single().requiereComentario)
    }

    @Test
    fun `la devolucion exige motivo y queda despues del siguiente paso`() {
        val expediente =
            Expediente(
                objeto("estados_plan" to objeto("orden" to 20)),
                transiciones =
                    listOf(
                        objeto("id" to "borrador", "clave" to "BORRADOR", "orden" to 10),
                        objeto("id" to "planeacion", "clave" to "REV_PLANEACION", "orden" to 30),
                    ),
            )
        val acciones = accionesRevision(expediente, false)
        assertEquals("planeacion", acciones.first().destinoId)
        assertTrue(acciones.last().requiereComentario)
        assertEquals(TipoAccionRevision.Devolver, acciones.last().tipo)
    }

    @Test
    fun `la aprobacion curricular no omite el registro oficial`() {
        val expediente =
            Expediente(
                objeto("estructuras_plan" to objeto("tipo" to "CURRICULAR")),
                transiciones =
                    listOf(objeto("id" to "aprobado", "clave" to "APROBADO", "orden" to 100)),
            )
        assertTrue(accionesRevision(expediente, false).single().requiereRegistroOficial)
    }

    @Test
    fun `reabrir asignatura conserva comentario obligatorio`() {
        val expediente =
            Expediente(
                objeto("estado" to "aprobada"),
                transiciones = listOf(objeto("id" to "borrador")),
            )
        val accion = accionesRevision(expediente, true).single()
        assertEquals("Reabrir asignatura", accion.etiqueta)
        assertTrue(accion.requiereComentario)
        assertEquals(TipoAccionRevision.Reabrir, accion.tipo)
        assertTrue(revisionCerrada(expediente, true))
        assertFalse(revisionCerrada(expediente, false))
    }

    @Test
    fun `aprobacion no inventa permiso para reabrir`() {
        val expediente = Expediente(objeto("estado" to "aprobada"))
        assertTrue(revisionCerrada(expediente, true))
        assertTrue(accionesRevision(expediente, true).isEmpty())
    }

    @Test
    fun `las fechas del historial se agrupan en la zona local no en UTC`() {
        val zona = ZoneId.of("America/Mexico_City")
        assertEquals("2026-09-17", diaHistorial("2026-09-18T02:30:00Z", zona))
        assertTrue(fechaAcademica("2026-09-18T02:30:00Z", zona).contains("20:30"))
        assertEquals("AC", inicialesAutor(""))
        assertEquals("MS", inicialesAutor("  María   Silva Pérez"))
    }
}

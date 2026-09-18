package mx.sgi.acadia

import mx.sgi.acadia.data.*
import org.junit.Assert.*
import org.junit.Test

class MapaAcademicoTest {
    private fun materia(
        id: String,
        ciclo: Int?,
        previo: String? = null,
        estado: String = "borrador",
    ) =
        objeto(
            "id" to id,
            "nombre" to id,
            "numero_ciclo" to ciclo,
            "prerrequisito_asignatura_id" to previo,
            "estado" to estado,
        )

    private val a = materia("A", 1)
    private val b = materia("B", 3, "A")
    private val c = materia("C", 5, "B")
    private val todas = listOf(a, b, c)

    @Test
    fun aceptaCambiosDeCicloYBloqueSinRomperSeriacion() {
        assertNull(validarMovimientoMapa(b, CeldaMapa(2, "bloque"), todas, 8))
        assertNull(validarMovimientoMapa(b, CeldaMapa(3, "otro"), todas, 8))
    }

    @Test
    fun protegeTantoPrerrequisitoComoAsignaturasDependientes() {
        assertNotNull(validarMovimientoMapa(b, CeldaMapa(1, null), todas, 8))
        assertNotNull(validarMovimientoMapa(b, CeldaMapa(5, null), todas, 8))
        assertNotNull(validarMovimientoMapa(b, CeldaMapa(null, null), todas, 8))
    }

    @Test
    fun validaCicloArchivosYSinCiclo() {
        assertNotNull(validarMovimientoMapa(a, CeldaMapa(9, null), todas, 8))
        assertNotNull(validarMovimientoMapa(a, CeldaMapa(null, "bloque"), todas, 8))
        assertNotNull(
            validarMovimientoMapa(
                materia("D", 1, estado = "archivada"),
                CeldaMapa(2, null),
                todas,
                8,
            )
        )
        assertNull(validarMovimientoMapa(materia("D", null), CeldaMapa(2, null), todas, 8))
    }

    @Test
    fun optimismoNoModificaSnapshotNiOtrasMaterias() {
        val original = Expediente(objeto("id" to "plan"), asignaturas = todas)
        val actualizado = moverEnMapa(original, "B", CeldaMapa(2, "bloque"))
        assertEquals(CeldaMapa(2, "bloque"), actualizado.asignaturas[1].celdaMapa())
        assertEquals(CeldaMapa(3, null), original.asignaturas[1].celdaMapa())
        assertSame(a, actualizado.asignaturas.first())
        assertEquals("A", actualizado.asignaturas[1].texto("prerrequisito_asignatura_id"))
    }
}

package mx.sgi.acadia

import java.io.IOException
import mx.sgi.acadia.data.*
import org.junit.Assert.*
import org.junit.Test

class InvalidacionLocalTest {
    @Test
    fun unaReferenciaNoInvalidaElCatalogoDePlanes() {
        val inicial = emptyMap<String, Long>()
        val actualizado = avanzarRevisiones(inicial, listOf("bibliografia_asignatura"))
        assertEquals(
            revisionesObservadas(inicial, listOf("planes_estudio", "carreras", "facultades")),
            revisionesObservadas(actualizado, listOf("planes_estudio", "carreras", "facultades")),
        )
        assertNotEquals(
            revisionesObservadas(inicial, listOf("asignaturas", "bibliografia_asignatura")),
            revisionesObservadas(actualizado, listOf("asignaturas", "bibliografia_asignatura")),
        )
    }

    @Test
    fun revisionMonotonaConservaCambiosDeTablasDistintas() {
        val primera = avanzarRevisiones(emptyMap(), listOf("planes_estudio", "planes_estudio"))
        val segunda = avanzarRevisiones(primera, listOf("asignaturas"))
        val tercera = avanzarRevisiones(segunda, listOf("planes_estudio"))
        assertEquals(1L, primera["planes_estudio"])
        assertEquals(2L, tercera["planes_estudio"])
        assertEquals(1L, tercera["asignaturas"])
        assertEquals(primera, avanzarRevisiones(primera, emptyList()))
    }

    @Test
    fun reintentosSonSelectivosYSeAgotanTrasCinco() {
        assertTrue(puedeReintentarTiempoReal(IOException("Conexión interrumpida"), 0))
        assertTrue(puedeReintentarTiempoReal(IOException("Conexión interrumpida"), 4))
        assertFalse(puedeReintentarTiempoReal(IOException("Conexión interrumpida"), 5))
        assertFalse(puedeReintentarTiempoReal(IllegalArgumentException("Tabla no válida"), 0))
        assertFalse(puedeReintentarTiempoReal(SecurityException("Sin autorización"), 0))
    }
}

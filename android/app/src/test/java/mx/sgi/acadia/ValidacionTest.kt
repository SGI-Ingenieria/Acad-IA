package mx.sgi.acadia

import mx.sgi.acadia.data.*
import org.junit.Assert.*
import org.junit.Test

class ValidacionTest {
    @Test
    fun fechasInvalidasEHistoricasNoSeGuardanSinConfirmacion() {
        val hoy = java.time.LocalDate.of(2026, 9, 17)
        assertNull(Validacion.fechaCurricular("2026-09-01", hoy))
        assertNotNull(Validacion.fechaCurricular("2026-08-01", hoy))
        assertNotNull(Validacion.fechaCurricular("2026-02-30", hoy))
    }

    @Test
    fun previewRechazaHostsRemotos() {
        assertTrue(Validacion.localUrl("http://10.0.2.2:54321"))
        assertTrue(Validacion.localUrl("http://localhost:54321"))
        assertFalse(Validacion.localUrl("https://example.supabase.co"))
        assertFalse(Validacion.localUrl("http://10.0.2.2.example.com"))
        assertFalse(Validacion.localUrl("http://10.0.2.2@example.com"))
    }

    @Test
    fun evaluacionExigeTotalCienYTitulos() {
        assertNull(
            Validacion.evaluacion(listOf(objeto("criterio" to "Proyecto", "porcentaje" to 100)))
        )
        assertNotNull(
            Validacion.evaluacion(
                listOf(
                    objeto("criterio" to "Proyecto", "porcentaje" to 99.5),
                    objeto("criterio" to "Proceso", "porcentaje" to .5),
                )
            )
        )
        assertNull(
            Validacion.evaluacion(
                listOf(
                    objeto("nombre" to "Proyecto", "porcentaje" to 70),
                    objeto("nombre" to "Examen", "porcentaje" to 30),
                )
            )
        )
        assertNotNull(
            Validacion.evaluacion(listOf(objeto("nombre" to "Proyecto", "porcentaje" to 99)))
        )
        assertNotNull(Validacion.evaluacion(listOf(objeto("nombre" to "", "porcentaje" to 100))))
        assertNotNull(Validacion.evaluacion(emptyList()))
    }

    @Test
    fun permisosNoSeInventanYAdminImplicaTodos() {
        assertFalse(Sesion("", "", "", emptySet(), emptySet()).permite(Permiso.EditarPlanes))
        assertTrue(Sesion("", "", "", setOf("ADMIN"), emptySet()).permite(Permiso.EditarPlanes))
        assertTrue(
            Sesion("", "", "", emptySet(), setOf("planes.editar")).permite(Permiso.EditarPlanes)
        )
    }

    @Test
    fun horasNoAceptanNegativosNiTexto() {
        assertNull(Validacion.horas("0"))
        assertNull(Validacion.horas("16"))
        assertNotNull(Validacion.horas("-1"))
        assertNotNull(Validacion.horas("x"))
    }

    @Test
    fun busquedaIgnoraAcentos() {
        assertEquals("diseno curricular", normalizarBusqueda("  Diseño Curricular "))
    }
}

package mx.sgi.acadia

import mx.sgi.acadia.data.*
import org.junit.Assert.*
import org.junit.Test

class AltaAcademicaTest {
    private val ingenieria =
        objeto("id" to "ing", "nombre" to "Ingeniería", "prefijo" to "Mexicana")
    private val medicina = objeto("id" to "med", "nombre" to "Medicina")
    private val licenciatura =
        objeto(
            "id" to "l",
            "nombre" to "Sistemas",
            "nivel" to "Licenciatura",
            "facultad_id" to "ing",
        )
    private val maestria =
        objeto(
            "id" to "m",
            "nombre" to "Ciberseguridad",
            "nivel" to "Maestría",
            "facultad_id" to "ing",
        )
    private val salud =
        objeto(
            "id" to "s",
            "nombre" to "Cirugía",
            "nivel" to "Especialidad",
            "facultad_id" to "med",
        )
    private val carreras = listOf(salud, maestria, licenciatura)

    @Test
    fun nombreInstitucionalConservaPrefijoYNivel() {
        assertEquals("Facultad Mexicana de Ingeniería", nombreFacultad(ingenieria))
        assertEquals("Facultad de Medicina", nombreFacultad(medicina))
        assertEquals("Maestría en Ciberseguridad", nombreCarrera(maestria))
    }

    @Test
    fun nivelesSiguenElCatalogoNoElOrdenAlfabetico() {
        assertEquals(
            listOf("Licenciatura", "Maestría", "Especialidad"),
            carrerasPorNivel(carreras).keys.toList(),
        )
    }

    @Test
    fun administradorVeFacultadesAunqueNoTengaAdscripcion() {
        val ambito =
            resolverAmbitoAltaPlan(listOf(ingenieria, medicina), carreras, emptyList(), true)
        assertEquals(2, ambito.facultades.size)
        assertEquals(3, ambito.carreras.size)
    }

    @Test
    fun jefaturaDePosgradoNoHeredaLicenciaturasNiOtraFacultad() {
        val roles =
            listOf(objeto("roles" to objeto("clave" to "JEFE_POSGRADO"), "facultad_id" to "ing"))
        val ambito = resolverAmbitoAltaPlan(listOf(ingenieria, medicina), carreras, roles, false)
        assertEquals(listOf("m"), ambito.carreras.map { it.id })
        assertEquals(listOf("ing"), ambito.facultades.map { it.id })
    }

    @Test
    fun jefaturaDeCarreraSoloVeSuCarreraAunqueCatalogoSeaGlobal() {
        val roles = listOf(objeto("clave" to "JEFE_CARRERA", "carrera_id" to "l"))
        val ambito = resolverAmbitoAltaPlan(listOf(ingenieria, medicina), carreras, roles, false)
        assertEquals(listOf("l"), ambito.carreras.map { it.id })
        assertTrue(
            resolverAmbitoAltaPlan(listOf(ingenieria), carreras, emptyList(), false)
                .carreras
                .isEmpty()
        )
    }

    @Test
    fun calendarioDeCarreraTienePrioridadSinInventarSemanas() {
        val declarada =
            objeto(
                "nivel" to "Maestría",
                "tipo_ciclo_default" to "Trimestre",
                "ciclos_default" to 7,
                "semanas_por_ciclo_default" to 12,
            )
        assertEquals(CiclosPropuestos("Trimestre", 7, 12), ciclosPropuestos(declarada))
        assertEquals(CiclosPropuestos("Cuatrimestre", 6, null), ciclosPropuestos(maestria))
    }
}

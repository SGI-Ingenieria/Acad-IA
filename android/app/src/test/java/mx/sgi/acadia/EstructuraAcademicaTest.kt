package mx.sgi.acadia

import kotlinx.serialization.json.*
import mx.sgi.acadia.data.*
import org.junit.Assert.*
import org.junit.Test

class EstructuraAcademicaTest {
    @Test
    fun conservaOrdenRequeridosYTiposDelEsquemaWeb() {
        val estructura =
            objeto(
                "definicion" to
                    Json.parseToJsonElement(
                        """
            {"required":["perfil"],"properties":{
                "perfil":{"title":"Perfil de egreso","type":"string"},
                "duracion":{"type":"integer","minimum":1},
                "modalidad":{"enum":["Escolarizada","Mixta"]},
                "ignorar":null
            }}
        """
                    )
            )
        val campos = camposEstructura(estructura)
        assertEquals(listOf("perfil", "duracion", "modalidad"), campos.map { it.clave })
        assertEquals("Perfil de egreso", campos.first().titulo)
        assertTrue(campos.first().requerido)
        assertFalse(campos.last().requerido)
        assertEquals(listOf("Texto enriquecido", "Número", "Opciones"), campos.map { it.tipo })
        assertEquals(1, campos[1].definicion.numero("minimum"))
    }

    @Test
    fun toleraEstructuraSinDefinicion() {
        assertTrue(camposEstructura(objeto()).isEmpty())
        assertNull(estructuraAsignaturaVinculada(objeto()))
    }

    @Test
    fun relacionUnicaPostgrestUsaObjetoYAdmiteListaAnterior() {
        val asignatura = objeto("id" to "asignatura", "nombre" to "Programa")
        assertEquals(
            asignatura,
            estructuraAsignaturaVinculada(objeto("estructuras_asignatura" to asignatura)),
        )
        assertEquals(
            asignatura,
            estructuraAsignaturaVinculada(
                objeto("estructuras_asignatura" to JsonArray(listOf(asignatura)))
            ),
        )
    }
}

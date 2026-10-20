package mx.sgi.acadia

import mx.sgi.acadia.data.*
import org.junit.Assert.*
import org.junit.Test

class AsignaturasCatalogoTest {
    @Test
    fun curricularUsaNivelYCarreraSinRepetirCohorteNiFacultad() {
        val asignatura =
            objeto(
                "nombre" to "Criptografía aplicada",
                "plan_tipo_estructura" to "CURRICULAR",
                "plan_nombre" to "Maestría en Ciberseguridad - Plan Septiembre 2026",
                "carrera_nombre" to " Ciberseguridad ",
                "carrera_nivel" to " Maestría ",
                "facultad_nombre" to "Ingeniería",
            )
        assertEquals("Maestría en Ciberseguridad", nombrePlanAsignatura(asignatura))
    }

    @Test
    fun nivelOtroOVacioNoAgregaPrefijo() {
        listOf("Otro", " otro ", "", null).forEach { nivel ->
            assertEquals(
                "Ciberseguridad",
                nombrePlanAsignatura(
                    objeto(
                        "plan_tipo_estructura" to "CURRICULAR",
                        "carrera_nombre" to "Ciberseguridad",
                        "carrera_nivel" to nivel,
                    )
                ),
            )
        }
    }

    @Test
    fun noCurricularConservaNombrePropioAunqueTengaCarrera() {
        assertEquals(
            "Taller de evidencia digital",
            nombrePlanAsignatura(
                objeto(
                    "plan_tipo_estructura" to "NO_CURRICULAR",
                    "plan_nombre" to " Taller de evidencia digital ",
                    "carrera_nombre" to "Ciberseguridad",
                    "carrera_nivel" to "Maestría",
                )
            ),
        )
    }

    @Test
    fun contextoParcialConservaNombreRealSinInventarElPlan() {
        assertEquals(
            "Plan vigente",
            nombrePlanAsignatura(
                objeto(
                    "plan_tipo_estructura" to "CURRICULAR",
                    "plan_nombre" to "Plan vigente",
                )
            ),
        )
        assertEquals(
            "Plan legado",
            nombrePlanAsignatura(objeto("plan_nombre" to "Plan legado")),
        )
        assertEquals("", nombrePlanAsignatura(objeto("nombre" to "Asignatura archivada")))
    }

    @Test
    fun cicloExplicitaLaPeriodicidadDelPlan() {
        listOf("Semestre", "Cuatrimestre", "Trimestre").forEach { tipo ->
            assertEquals(
                "$tipo 4",
                etiquetaCicloAsignatura(objeto("numero_ciclo" to 4, "plan_tipo_ciclo" to tipo)),
            )
        }
    }

    @Test
    fun otroOCicloDesconocidoUsaEtiquetaGenerica() {
        listOf("Otro", " otro ", "", null).forEach { tipo ->
            assertEquals(
                "Ciclo 2",
                etiquetaCicloAsignatura(objeto("numero_ciclo" to 2, "plan_tipo_ciclo" to tipo)),
            )
        }
    }

    @Test
    fun cicloAusenteOInvalidoNuncaSeConvierteEnCero() {
        listOf(null, 0, -1, "desconocido").forEach { numero ->
            assertEquals(
                "Sin semestre asignado",
                etiquetaCicloAsignatura(
                    objeto("numero_ciclo" to numero, "plan_tipo_ciclo" to "Semestre")
                ),
            )
        }
        assertEquals("Sin ciclo asignado", etiquetaCicloAsignatura(objeto()))
    }

    @Test
    fun creditosEliminanCerosDecimalesSinRedondear() {
        assertEquals("6 créditos", etiquetaCreditosAsignatura(objeto("creditos" to "6.00")))
        assertEquals("6.25 créditos", etiquetaCreditosAsignatura(objeto("creditos" to "6.250")))
        assertEquals("1 crédito", etiquetaCreditosAsignatura(objeto("creditos" to 1.0)))
        assertEquals("0 créditos", etiquetaCreditosAsignatura(objeto("creditos" to 0)))
    }

    @Test
    fun creditosAusentesOInvalidosNoSePresentanComoCero() {
        listOf(null, "", "NaN", "infinito", -1).forEach { creditos ->
            assertEquals("", etiquetaCreditosAsignatura(objeto("creditos" to creditos)))
        }
        assertEquals("", etiquetaCreditosAsignatura(objeto()))
    }
}

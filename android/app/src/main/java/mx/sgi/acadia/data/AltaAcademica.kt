package mx.sgi.acadia.data

/** Same label and level order as facultad-utils.ts and the database's nivel_plan_estudio enum. */
fun nombreFacultad(facultad: Registro): String =
    facultad.texto("prefijo").trim().let { prefijo ->
        if (prefijo.isBlank()) "Facultad de ${facultad.nombre}"
        else "Facultad $prefijo de ${facultad.nombre}"
    }

fun nombreCarrera(carrera: Registro): String =
    carrera.texto("nivel").trim().let { nivel ->
        if (nivel.isBlank() || nivel.equals("Otro", true)) carrera.nombre
        else "$nivel en ${carrera.nombre}"
    }

fun carrerasPorNivel(carreras: List<Registro>): Map<String, List<Registro>> {
    val orden = listOf("Licenciatura", "Maestría", "Doctorado", "Especialidad", "Diplomado", "Otro")
    return carreras
        .groupBy { it.texto("nivel").trim().ifBlank { "Otro" } }
        .toList()
        .sortedWith(
            compareBy(
                { orden.indexOf(it.first).takeIf { n -> n >= 0 } ?: Int.MAX_VALUE },
                { it.first },
            )
        )
        .associate { (nivel, valores) ->
            nivel to valores.sortedBy { normalizarBusqueda(it.nombre) }
        }
}

data class AmbitoAltaPlan(val facultades: List<Registro>, val carreras: List<Registro>)

/** Catalog visibility is global; creation must additionally respect the same role scope as web. */
fun resolverAmbitoAltaPlan(
    facultades: List<Registro>,
    carreras: List<Registro>,
    roles: List<Registro>,
    administrador: Boolean,
): AmbitoAltaPlan {
    val permitidas = carreras.filter { carrera ->
        administrador ||
            roles.any { rol ->
                when (rol.objeto("roles").texto("clave").ifBlank { rol.texto("clave") }) {
                    "ADMIN",
                    "VICERRECTOR_ACADEMICO" -> true
                    "DIRECTOR_FACULTAD",
                    "SECRETARIO_ACADEMICO" ->
                        rol.texto("facultad_id").isNotBlank() &&
                            rol.texto("facultad_id") == carrera.texto("facultad_id")
                    "JEFE_CARRERA" -> rol.texto("carrera_id") == carrera.id
                    "JEFE_POSGRADO" ->
                        rol.texto("facultad_id").isNotBlank() &&
                            rol.texto("facultad_id") == carrera.texto("facultad_id") &&
                            normalizarBusqueda(carrera.texto("nivel")) in
                                setOf("maestria", "doctorado", "especialidad")
                    else -> false
                }
            }
    }
    val ids = permitidas.map { it.texto("facultad_id") }.toSet()
    return AmbitoAltaPlan(facultades.filter { it.id in ids }, permitidas)
}

suspend fun RepositorioAcad.ambitoAltaPlan(): AmbitoAltaPlan {
    val sesion =
        sesionActual()
            ?: throw FalloAcad(CategoriaError.Credenciales, "Inicia sesión para continuar.")
    val roles =
        filas(
            "usuarios_roles",
            "usuario_id",
            sesion.id,
            "id",
            columnas = "id,facultad_id,carrera_id,roles(clave)",
        )
    return resolverAmbitoAltaPlan(
        catalogos("facultades"),
        catalogos("carreras"),
        roles,
        "ADMIN" in sesion.roles,
    )
}

data class CiclosPropuestos(val tipo: String, val ciclos: Int, val semanas: Int?)

fun ciclosPropuestos(carrera: Registro): CiclosPropuestos {
    val convencion =
        when (carrera.texto("nivel")) {
            "Licenciatura" -> "Semestre" to 9
            "Maestría",
            "Especialidad" -> "Cuatrimestre" to 6
            "Doctorado" -> "Semestre" to 8
            else -> "Otro" to 1
        }
    return CiclosPropuestos(
        carrera.texto("tipo_ciclo_default").ifBlank { convencion.first },
        carrera.numero("ciclos_default").takeIf { it > 0 } ?: convencion.second,
        carrera.numero("semanas_por_ciclo_default").takeIf { it > 0 },
    )
}

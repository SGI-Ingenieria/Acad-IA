package mx.sgi.acadia.data

import android.util.Base64
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.SignOutScope
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.user.UserSession
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.functions.Functions
import io.github.jan.supabase.functions.functions
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.storage.Storage
import io.ktor.client.call.body
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.contentType
import java.time.Instant
import java.util.UUID
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import mx.sgi.acadia.BuildConfig

/** One authenticated client. Compose never reads Supabase directly. */
class RepositorioAcad {
    private val json = Json { ignoreUnknownKeys = true }
    // Local writes need reconciliation even when a table is not published to Realtime.
    private val revisionesLocales = MutableStateFlow<Map<String, Long>>(emptyMap())

    private fun invalidar(vararg tablas: String) {
        revisionesLocales.update { avanzarRevisiones(it, tablas.toList()) }
    }

    val configurado =
        BuildConfig.SUPABASE_KEY.isNotBlank() &&
            if (BuildConfig.LOCAL_PREVIEW) Validacion.localUrl(BuildConfig.SUPABASE_URL)
            else BuildConfig.SUPABASE_URL.startsWith("https://")
    private val cliente by lazy {
        createSupabaseClient(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_KEY) {
            httpEngine = OkHttp.create()
            install(Auth)
            install(Postgrest)
            install(Functions)
            install(Realtime)
            install(Storage)
        }
    }
    val cambiosSesion
        get() = cliente.auth.sessionStatus

    fun sesionActual(): Sesion? {
        val session = cliente.auth.currentSessionOrNull() ?: return null
        val claims = runCatching {
            json
                .parseToJsonElement(
                    Base64.decode(session.accessToken.split('.')[1], Base64.URL_SAFE)
                        .decodeToString()
                )
                .jsonObject
        }
            .getOrElse { JsonObject(emptyMap()) }
        val metadata = claims.objeto("app_metadata")
        fun conjunto(clave: String) =
            (metadata[clave] as? JsonArray)
                ?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }
                ?.toSet() ?: emptySet()
        return Sesion(
            session.user?.id.orEmpty(),
            session.user?.userMetadata?.texto("nombre_completo").orEmpty(),
            session.user?.email.orEmpty(),
            conjunto("roles_claves"),
            conjunto("permisos"),
        )
    }

    suspend fun entrar(identificador: String, password: String, institucional: Boolean) = ejecutar {
        require(configurado) { "Ejecuta bun run android:configurar antes de compilar el preview." }
        if (BuildConfig.LOCAL_PREVIEW && !institucional) {
            // Local-only preview supports the seeded GoTrue account; release preserves the
            // institutional gateway.
            cliente.auth.signInWith(Email) {
                email = identificador.trim()
                this.password = password
            }
        } else {
            val result =
                funcion(
                    if (institucional) "internal-auth-login" else "external-auth/login",
                    if (institucional)
                        objeto("clave" to identificador.trim(), "password" to password)
                    else objeto("email" to identificador.trim(), "password" to password),
                )
            val sesion = json.decodeFromJsonElement<UserSession>(result.objeto("session"))
            val gate =
                cliente.functions
                    .invoke("observability-health/session-gate") {
                        headers[HttpHeaders.Authorization] = "Bearer ${sesion.accessToken}"
                        contentType(ContentType.Application.Json)
                        setBody(objeto())
                    }
                    .body<Registro>()
            require(gate.booleano("allowed")) {
                "La verificación institucional no permite iniciar esta sesión."
            }
            cliente.auth.importSession(sesion)
        }
        Unit
    }

    suspend fun salir() = ejecutar { cliente.auth.signOut(SignOutScope.LOCAL) }

    suspend fun recuperar(correo: String) = ejecutar {
        if (BuildConfig.LOCAL_PREVIEW) cliente.auth.resetPasswordForEmail(correo.trim())
        else funcion("external-auth/reset-password", objeto("email" to correo.trim()))
        Unit
    }

    private fun usuario() =
        cliente.auth.currentUserOrNull()?.id
            ?: throw FalloAcad(CategoriaError.Credenciales, "Inicia sesión para continuar.")

    private fun auditoria(nuevo: Boolean) =
        objeto(
            (if (nuevo) "creado_por" else "actualizado_por") to usuario(),
            "actualizado_en" to Instant.now().toString(),
        )

    private val columnasPlan =
        "*,carreras(*,facultades(*)),estructuras_plan!planes_estudio_estructura_id_fkey(*),estados_plan(*)"
    private val columnasAsignatura =
        "*,planes_estudio(id,nombre_display,tipo_ciclo,numero_ciclos,estructura_id),estructuras_asignatura(id,nombre,definicion)"

    suspend fun planes(busqueda: String = "", offset: Long = 0): List<Registro> = ejecutar {
        // Catalog RPC preserves metadata visibility versus permission to open the full plan.
        val rows =
            cliente.postgrest
                .rpc(
                    "planes_catalogo_buscar_versiones",
                    objeto(
                        "p_search" to busqueda.ifBlank { null },
                        "p_modo_version" to "actuales",
                        "p_sort" to "actualizado_desc",
                        "p_limit" to 30,
                        "p_offset" to offset,
                    ),
                )
                .decodeList<Registro>()
        rows
            .map {
                it.objeto("plan") +
                    objeto(
                        "carreras" to
                            JsonObject(
                                it.objeto("carrera") + objeto("facultades" to it["facultad"])
                            ),
                        "estados_plan" to it["estado_plan"],
                        "estructuras_plan" to it["estructura_plan"],
                        "puede_abrir_detalle" to it["puede_abrir_detalle"],
                    )
            }
            .map(::JsonObject)
    }

    suspend fun asignaturas(busqueda: String = "", offset: Long = 0): List<Registro> = ejecutar {
        cliente.postgrest
            .rpc(
                "catalogo_asignaturas_buscar",
                objeto(
                    "p_q" to busqueda.ifBlank { null },
                    "p_sort" to "nombre_asc",
                    "p_limit" to 30,
                    "p_offset" to offset,
                ),
            )
            .decodeList<Registro>()
    }

    suspend fun plan(id: String): Expediente = ejecutar {
        coroutineScope {
            val registro = async { uno("planes_estudio", id, columnasPlan) }
            val materias = async { asignaturasDelMapa(id) }
            val bloques = async { filas("lineas_plan", "plan_estudio_id", id, "orden") }
            val comentarios = async { comentarios(id, false) }
            val historial = async {
                filas(
                    "cambios_plan",
                    "plan_estudio_id",
                    id,
                    "cambiado_en",
                    false,
                    "*,usuarios_app:cambiado_por(nombre_completo)",
                )
            }
            val editable = async {
                rpcBooleano("authz_plan_write_allowed", objeto("p_plan_id" to id))
            }
            val transiciones = async {
                cliente.postgrest
                    .rpc("transiciones_permitidas_plan", objeto("p_plan_id" to id))
                    .decodeList<Registro>()
            }
            Expediente(
                registro.await(),
                materias.await(),
                bloques.await(),
                comentarios = comentarios.await(),
                historial = historial.await(),
                editable = editable.await(),
                transiciones = transiciones.await(),
            )
        }
    }

    suspend fun asignatura(id: String): Expediente = ejecutar {
        coroutineScope {
            val registro = async { uno("asignaturas", id, columnasAsignatura) }
            val bibliografia = async { filas("bibliografia_asignatura", "asignatura_id", id) }
            val comentarios = async { comentarios(id, true) }
            val historial = async {
                filas(
                    "cambios_asignatura",
                    "asignatura_id",
                    id,
                    "cambiado_en",
                    false,
                    "*,usuarios_app:cambiado_por(nombre_completo)",
                )
            }
            val editable = async {
                rpcBooleano("authz_asignatura_write_allowed", objeto("p_asignatura_id" to id))
            }
            val transiciones = async {
                listOf(
                        "borrador" to "Pedir cambios",
                        "revisada" to "Enviar a revisión",
                        "aprobada" to "Aprobar",
                    )
                    .map { (estado, etiqueta) ->
                        async {
                            if (
                                rpcBooleano(
                                    "usuario_puede_transicionar_asignatura",
                                    objeto(
                                        "p_usuario_id" to usuario(),
                                        "p_asignatura_id" to id,
                                        "p_nuevo_estado" to estado,
                                    ),
                                )
                            )
                                objeto("id" to estado, "etiqueta" to etiqueta)
                            else null
                        }
                    }
                    .awaitAll()
                    .filterNotNull()
            }
            val actual = registro.await()
            Expediente(
                actual,
                bibliografia = bibliografia.await(),
                comentarios = comentarios.await(),
                historial = historial.await(),
                editable = editable.await(),
                transiciones = transiciones.await().filter { it.id != actual.texto("estado") },
            )
        }
    }

    suspend fun asignaturasDelMapa(planId: String): List<Registro> = ejecutar {
        val resultado = mutableListOf<Registro>()
        do {
            val pagina =
                cliente
                    .from("asignaturas")
                    .select {
                        filter { eq("plan_estudio_id", planId) }
                        order("id", Order.ASCENDING)
                        range(resultado.size.toLong(), resultado.size.toLong() + 299)
                    }
                    .decodeList<Registro>()
            resultado.addAll(pagina)
        } while (pagina.size == 300)
        resultado
    }

    suspend fun moverAsignaturaMapa(
        plan: Registro,
        asignatura: Registro,
        destino: CeldaMapa,
    ): Registro = ejecutar {
        val actuales = asignaturasDelMapa(plan.id)
        val actual =
            actuales.find { it.id == asignatura.id }
                ?: throw FalloAcad(
                    CategoriaError.Conflicto,
                    "La asignatura ya no está en este plan. Actualiza el mapa.",
                )
        if (actual.texto("actualizado_en") != asignatura.texto("actualizado_en"))
            throw FalloAcad(
                CategoriaError.Conflicto,
                "La asignatura cambió. Actualiza el mapa antes de moverla.",
            )
        validarMovimientoMapa(actual, destino, actuales, plan.numero("numero_ciclos"))?.let {
            throw FalloAcad(CategoriaError.Validacion, it)
        }
        if (
            destino.bloque != null &&
                uno("lineas_plan", destino.bloque).texto("plan_estudio_id") != plan.id
        )
            throw FalloAcad(CategoriaError.Validacion, "El bloque no pertenece a este plan.")
        val orden =
            actuales
                .filter { it.id != actual.id && it.celdaMapa() == destino }
                .maxOfOrNull { it.numero("orden_celda") }
                ?.plus(1) ?: 0
        guardarAsignatura(
            actual.id,
            objeto(
                "numero_ciclo" to destino.ciclo,
                "linea_plan_id" to destino.bloque,
                "orden_celda" to orden,
            ),
            actual.texto("actualizado_en"),
        )
    }

    private suspend fun rpcBooleano(nombre: String, params: Registro): Boolean =
        cliente.postgrest.rpc(nombre, params).decodeAs<Boolean>()

    suspend fun uno(tabla: String, id: String, columnas: String = "*"): Registro = ejecutar {
        cliente
            .from(tabla)
            .select(Columns.raw(columnas)) { filter { eq("id", id) } }
            .decodeSingle<Registro>()
    }

    suspend fun filas(
        tabla: String,
        campo: String? = null,
        valor: String? = null,
        orden: String = "creado_en",
        asc: Boolean = true,
        columnas: String = "*",
    ): List<Registro> = ejecutar {
        cliente
            .from(tabla)
            .select(Columns.raw(columnas)) {
                if (campo != null && valor != null) filter { eq(campo, valor) }
                order(orden, if (asc) Order.ASCENDING else Order.DESCENDING)
                limit(300)
            }
            .decodeList<Registro>()
    }

    suspend fun catalogos(tabla: String): List<Registro> = filas(tabla, orden = "nombre")

    suspend fun guardarPlan(id: String, cambios: Registro, revision: String? = null): Registro =
        guardar("planes_estudio", id, cambios, revision = revision)

    suspend fun guardarAsignatura(
        id: String,
        cambios: Registro,
        revision: String? = null,
    ): Registro = guardar("asignaturas", id, cambios, revision = revision)

    private suspend fun guardar(
        tabla: String,
        id: String,
        cambios: Registro,
        auditar: Boolean = true,
        revision: String? = null,
    ): Registro = ejecutar {
        // Compare-and-set prevents a stale form from overwriting another researcher's edit.
        val rows =
            cliente
                .from(tabla)
                .update(JsonObject(cambios + if (auditar) auditoria(false) else emptyMap())) {
                    filter {
                        eq("id", id)
                        if (!revision.isNullOrBlank()) eq("actualizado_en", revision)
                    }
                    select()
                }
                .decodeList<Registro>()
        val guardado =
            rows.singleOrNull()
                ?: throw FalloAcad(
                    CategoriaError.Conflicto,
                    "El registro cambió o ya no tienes permiso para editarlo. Conserva tu texto, cierra el formulario y actualiza antes de reintentar.",
                )
        invalidar(tabla)
        guardado
    }

    suspend fun crearPlan(
        carrera: Registro,
        estructura: Registro,
        nombre: String,
        fecha: String,
        ciclos: Int,
        semanas: Int,
        tipo: String,
        solicitudId: String = UUID.randomUUID().toString(),
    ): Registro = ejecutar {
        require(ciclos in 1..30 && semanas in 1..52) { "Revisa el número de ciclos y semanas." }
        val curricular = estructura.texto("tipo") == "CURRICULAR"
        if (curricular)
            require(Validacion.fechaCurricular(fecha) == null) {
                Validacion.fechaCurricular(fecha).orEmpty()
            }
        else require(nombre.isNotBlank()) { "Escribe el nombre del plan." }
        val estado =
            cliente
                .from("estados_plan")
                .select { filter { eq("clave", "BORRADOR") } }
                .decodeSingle<Registro>()
        cliente
            .from("planes_estudio")
            .insert(
                JsonObject(
                    objeto(
                        "id" to solicitudId,
                        "carrera_id" to carrera.id,
                        "estructura_id" to estructura.id,
                        "nombre" to if (curricular) null else nombre.trim(),
                        "nombre_propuesto" to if (curricular) null else nombre.trim(),
                        "nombre_display" to nombre.ifBlank { carrera.nombre },
                        "fecha_inicio_imparticion" to if (curricular) fecha else null,
                        "numero_ciclos" to ciclos,
                        "tipo_ciclo" to tipo,
                        "semanas_por_ciclo" to semanas,
                        "estado_actual_id" to estado.id,
                        "tipo_origen" to "MANUAL",
                        "fase_diseno" to "FUNDAMENTOS",
                        "datos" to objeto(),
                    ) + auditoria(true)
                )
            ) {
                select()
            }
            .decodeSingle<Registro>()
            .also { invalidar("planes_estudio") }
    }

    suspend fun crearAsignatura(
        plan: Registro,
        estructuraId: String,
        nombre: String,
        codigo: String,
        ciclo: Int,
        solicitudId: String = UUID.randomUUID().toString(),
    ): Registro = ejecutar {
        require(nombre.isNotBlank() && ciclo in 1..plan.numero("numero_ciclos")) {
            "Revisa el nombre y el ciclo de la asignatura."
        }
        cliente
            .from("asignaturas")
            .insert(
                JsonObject(
                    objeto(
                        "id" to solicitudId,
                        "plan_estudio_id" to plan.id,
                        "estructura_id" to estructuraId,
                        "nombre" to nombre.trim(),
                        "codigo" to codigo.trim(),
                        "numero_ciclo" to ciclo,
                        "tipo" to "OBLIGATORIA",
                        "tipo_origen" to "MANUAL",
                        "estado" to "borrador",
                    ) + auditoria(true)
                )
            ) {
                select()
            }
            .decodeSingle<Registro>()
            .also { invalidar("asignaturas") }
    }

    suspend fun archivarAsignatura(id: String, archivar: Boolean) =
        guardarAsignatura(id, objeto("estado" to if (archivar) "archivada" else "borrador"))

    suspend fun guardarBloque(id: String?, planId: String, datos: Registro): Registro = ejecutar {
        if (id != null) guardar("lineas_plan", id, datos)
        else
            cliente
                .from("lineas_plan")
                .insert(JsonObject(datos + objeto("plan_estudio_id" to planId) + auditoria(true))) {
                    select()
                }
                .decodeSingle<Registro>()
                .also { invalidar("lineas_plan") }
    }

    suspend fun bibliografia(id: String?, asignaturaId: String, datos: Registro): Registro =
        ejecutar {
            if (id != null) guardar("bibliografia_asignatura", id, datos, false)
            else
                cliente
                    .from("bibliografia_asignatura")
                    .insert(
                        JsonObject(
                            datos +
                                objeto("asignatura_id" to asignaturaId, "creado_por" to usuario())
                        )
                    ) {
                        select()
                    }
                    .decodeSingle<Registro>()
                    .also { invalidar("bibliografia_asignatura") }
        }

    suspend fun eliminarBibliografia(id: String) = ejecutar {
        val eliminado =
            cliente
                .from("bibliografia_asignatura")
                .delete {
                    filter { eq("id", id) }
                    select()
                }
                .decodeList<Registro>()
        check(eliminado.isNotEmpty()) { "No tienes permiso para eliminar esta referencia." }
        invalidar("bibliografia_asignatura")
    }

    suspend fun buscarReferencias(fuente: FuenteBibliografia, consulta: String): List<Registro> =
        ejecutar {
            require(fuente != FuenteBibliografia.Manual && consulta.trim().length >= 3) {
                "Escribe al menos tres caracteres."
            }
            val biblioteca = fuente == FuenteBibliografia.Biblioteca
            val isbn =
                consulta.replace(Regex("[\\s-]"), "").takeIf {
                    it.matches(Regex("(?:\\d{9}[\\dxX]|\\d{13})"))
                }
            val body =
                if (biblioteca) objeto("titulo" to consulta.trim(), "isbn" to isbn)
                else
                    objeto(
                        "searchTerms" to objeto("q" to consulta.trim()),
                        "google" to objeto("orderBy" to "newest", "startIndex" to 0),
                        "openLibrary" to objeto("sort" to "new", "page" to 1),
                    )
            val respuesta =
                cliente.functions
                    .invoke(if (biblioteca) "biblioteca" else "buscar-bibliografia") {
                        contentType(ContentType.Application.Json)
                        setBody(body)
                    }
                    .body<JsonElement>()
            resultadosReferencias(fuente, respuesta).distinctBy {
                listOf(
                    it.texto("titulo"),
                    it.texto("isbn"),
                    it.texto("referencia_biblioteca"),
                    it.texto("referencia_en_linea"),
                    it.textos("autores").joinToString("\u0000"),
                    it.texto("editorial"),
                    it.texto("anio"),
                )
            }
        }

    suspend fun comentarios(id: String, asignatura: Boolean): List<Registro> = coroutineScope {
        val directos = async {
            filas(
                    if (asignatura) "comentarios_asignatura" else "comentarios_plan",
                    if (asignatura) "asignatura_id" else "plan_estudio_id",
                    id,
                    columnas = "*,autor:autor_id(nombre_completo)",
                )
                .map { JsonObject(it + objeto("_origen_plan" to !asignatura)) }
        }
        val transiciones =
            if (asignatura)
                async {
                    filas(
                            "comentarios_plan",
                            "asignatura_id",
                            id,
                            columnas = "*,autor:autor_id(nombre_completo)",
                        )
                        .map { JsonObject(it + objeto("_origen_plan" to true)) }
                }
            else null
        (directos.await() + transiciones?.await().orEmpty()).sortedByDescending {
            it.texto("creado_en")
        }
    }

    suspend fun comentar(id: String, asignatura: Boolean, texto: String): Registro = ejecutar {
        require(texto.isNotBlank()) { "Escribe un comentario." }
        if (asignatura) verificarRevisionAbierta(id)
        cliente
            .from(if (asignatura) "comentarios_asignatura" else "comentarios_plan")
            .insert(
                objeto(
                    (if (asignatura) "asignatura_id" else "plan_estudio_id") to id,
                    "autor_id" to usuario(),
                    "cuerpo" to texto.trim(),
                    "categoria" to "INTERNO",
                )
            ) {
                select()
            }
            .decodeSingle<Registro>()
            .also { invalidar(if (asignatura) "comentarios_asignatura" else "comentarios_plan") }
    }

    private suspend fun verificarRevisionAbierta(asignaturaId: String) {
        if (uno("asignaturas", asignaturaId, "id,estado").texto("estado") == "aprobada")
            throw FalloAcad(
                CategoriaError.Conflicto,
                "La asignatura está aprobada. Reábrela antes de modificar observaciones.",
            )
    }

    suspend fun resolverComentario(id: String, asignatura: Boolean, resuelto: Boolean): Registro =
        ejecutar {
            val tabla = if (asignatura) "comentarios_asignatura" else "comentarios_plan"
            val comentario = uno(tabla, id, "id,asignatura_id")
            comentario
                .texto("asignatura_id")
                .takeIf { it.isNotBlank() }
                ?.let { verificarRevisionAbierta(it) }
            guardar(
                if (asignatura) "comentarios_asignatura" else "comentarios_plan",
                id,
                objeto("resuelto" to resuelto),
                false,
            )
        }

    suspend fun responsablesAsignatura(asignaturaId: String): DatosResponsables = ejecutar {
        coroutineScope {
            val responsables = async {
                filas(
                    "responsables_asignatura",
                    "asignatura_id",
                    asignaturaId,
                    columnas = "*,usuario:usuario_id(nombre_completo)",
                )
            }
            val puedeGestionar =
                sesionActual()?.permite(Permiso.GestionarResponsables) == true &&
                    rpcBooleano(
                        "authz_asignatura_write_allowed",
                        objeto("p_asignatura_id" to asignaturaId),
                    )
            val puedeVerUsuarios = sesionActual()?.permite(Permiso.Usuarios) == true
            var errorUsuarios: String? = null
            val usuarios =
                if (puedeVerUsuarios) {
                    try {
                        cliente.functions
                            .invoke("usuarios") { method = HttpMethod.Get }
                            .body<List<Registro>>()
                    } catch (e: CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        errorUsuarios =
                            "No se pudo cargar el directorio de profesores. Intenta nuevamente."
                        emptyList()
                    }
                } else emptyList()
            DatosResponsables(
                responsables.await(),
                usuarios,
                puedeGestionar,
                puedeGestionar && sesionActual()?.permite(Permiso.GestionarUsuarios) == true,
                errorUsuarios,
                puedeVerUsuarios,
            )
        }
    }

    suspend fun asignarProfesorResponsable(asignaturaId: String, usuarioId: String): Registro =
        ejecutar {
            require(sesionActual()?.permite(Permiso.GestionarResponsables) == true) {
                "Tu cuenta no puede asignar responsables."
            }
            require(
                rpcBooleano(
                    "authz_asignatura_write_allowed",
                    objeto("p_asignatura_id" to asignaturaId),
                )
            ) {
                "No puedes modificar los responsables en el estado actual de la asignatura."
            }
            val existente =
                filas("responsables_asignatura", "asignatura_id", asignaturaId).firstOrNull {
                    it.texto("usuario_id") == usuarioId && it.texto("rol") == "PROFESOR_RESPONSABLE"
                }
            existente
                ?: cliente
                    .from("responsables_asignatura")
                    .insert(
                        objeto(
                            "asignatura_id" to asignaturaId,
                            "usuario_id" to usuarioId,
                            "rol" to "PROFESOR_RESPONSABLE",
                            "asignado_por" to usuario(),
                        )
                    ) {
                        select()
                    }
                    .decodeSingle<Registro>()
                    .also { invalidar("responsables_asignatura", "asignaturas", "notificaciones") }
        }

    suspend fun invitarProfesor(asignaturaId: String, nombre: String, correo: String): Registro =
        ejecutar {
            validarInvitacionProfesor(nombre, correo)?.let {
                throw FalloAcad(CategoriaError.Validacion, it)
            }
            require(sesionActual()?.permite(Permiso.GestionarUsuarios) == true) {
                "Tu cuenta no puede invitar profesores."
            }
            require(
                sesionActual()?.permite(Permiso.GestionarResponsables) == true &&
                    rpcBooleano(
                        "authz_asignatura_write_allowed",
                        objeto("p_asignatura_id" to asignaturaId),
                    )
            ) {
                "No puedes modificar los responsables en el estado actual de la asignatura."
            }
            funcion(
                "usuarios",
                objeto("nombre_completo" to nombre.trim(), "email" to correo.trim()),
                tablasAfectadas = listOf("usuarios_app"),
            )
        }

    suspend fun notificaciones(): List<Registro> =
        filas("notificaciones", "usuario_id", usuario(), "creado_en", false)

    suspend fun leerNotificacion(id: String) =
        guardar(
            "notificaciones",
            id,
            objeto("leida" to true, "leida_en" to Instant.now().toString()),
            false,
        )

    suspend fun registros(): List<Registro> =
        filas("registros_oficiales_plan_detalle", orden = "actualizado_en", asc = false)

    suspend fun tareas(): List<Registro> =
        filas("tareas_revision", orden = "creado_en", asc = false)

    suspend fun cambiarEstado(id: String, asignatura: Boolean, estado: String, comentario: String) =
        funcion(
            if (asignatura) "subjects_transition_state" else "plans_transition_state",
            if (asignatura)
                objeto("asignaturaId" to id, "nuevoEstado" to estado, "comentario" to comentario)
            else objeto("planId" to id, "haciaEstadoId" to estado, "comentario" to comentario),
            tablasAfectadas =
                if (asignatura)
                    listOf(
                        "asignaturas",
                        "cambios_asignatura",
                        "comentarios_plan",
                        "notificaciones",
                    )
                else
                    listOf(
                        "planes_estudio",
                        "cambios_plan",
                        "comentarios_plan",
                        "tareas_revision",
                        "notificaciones",
                    ),
        )

    suspend fun funcion(
        nombre: String,
        body: Registro = objeto(),
        method: HttpMethod = HttpMethod.Post,
        tablasAfectadas: List<String> = emptyList(),
    ): Registro = ejecutar {
        val response =
            cliente.functions.invoke(nombre) {
                this.method = method
                contentType(ContentType.Application.Json)
                if (method != HttpMethod.Get) setBody(body)
            }
        response.body<Registro>().also {
            if (method != HttpMethod.Get) invalidar(*tablasAfectadas.toTypedArray())
        }
    }

    suspend fun conversaciones(id: String, asignatura: Boolean) =
        filas(
            if (asignatura) "conversaciones_asignatura" else "conversaciones_plan",
            if (asignatura) "asignatura_id" else "plan_estudio_id",
            id,
            "creado_en",
            false,
            "*,mensajes:${if (asignatura) "asignatura_mensajes_ia" else "plan_mensajes_ia"}!inner(id)",
        )

    suspend fun mensajes(id: String, asignatura: Boolean) =
        filas(
                if (asignatura) "asignatura_mensajes_ia" else "plan_mensajes_ia",
                if (asignatura) "conversacion_asignatura_id" else "conversacion_plan_id",
                id,
                "fecha_creacion",
                false,
            )
            .asReversed()

    suspend fun crearConversacion(id: String, asignatura: Boolean, consulta: String) =
        funcion(
            "create-chat-conversation/${if(asignatura) "asignatura" else "plan"}/conversations",
            objeto(
                (if (asignatura) "asignatura_id" else "plan_estudio_id") to id,
                "title_prompt" to
                    consulta.trim().also {
                        require(it.isNotBlank()) {
                            "Escribe una consulta antes de iniciar el chat."
                        }
                    },
            ),
            tablasAfectadas =
                listOf(if (asignatura) "conversaciones_asignatura" else "conversaciones_plan"),
        )

    suspend fun enviarMensaje(
        id: String,
        asignatura: Boolean,
        texto: String,
        reintentoDe: String? = null,
    ) =
        funcion(
            "create-chat-conversation/conversations/${if(asignatura) "asignatura" else "plan"}/$id/messages",
            if (reintentoDe != null) objeto("retryOfMessageId" to reintentoDe)
            else
                objeto(
                    "content" to texto,
                    "campos" to JsonArray(emptyList()),
                    "references" to
                        objeto(
                            "fileIds" to JsonArray(emptyList()),
                            "collectionIds" to JsonArray(emptyList()),
                        ),
                    "webSearchEnabled" to false,
                    "reasoningEffort" to "auto",
                ),
            tablasAfectadas =
                if (asignatura) listOf("asignatura_mensajes_ia", "conversaciones_asignatura")
                else listOf("plan_mensajes_ia", "conversaciones_plan"),
        )

    suspend fun archivarConversacion(id: String, asignatura: Boolean, archivar: Boolean) =
        guardar(
            if (asignatura) "conversaciones_asignatura" else "conversaciones_plan",
            id,
            objeto("estado" to if (archivar) "ARCHIVADA" else "ACTIVA"),
            auditar = false,
        )

    /** Re-read the message and entity under RLS before applying explicitly reviewed output. */
    suspend fun aplicarRecomendacionChat(
        entidadId: String,
        asignatura: Boolean,
        mensajeId: String,
        seleccion: RecomendacionChat,
        revisionVista: String,
    ) = ejecutar {
        val tablaMensajes = if (asignatura) "asignatura_mensajes_ia" else "plan_mensajes_ia"
        val mensaje = uno(tablaMensajes, mensajeId)
        val conversacion =
            uno(
                if (asignatura) "conversaciones_asignatura" else "conversaciones_plan",
                mensaje.texto(
                    if (asignatura) "conversacion_asignatura_id" else "conversacion_plan_id"
                ),
            )
        require(
            conversacion.texto(if (asignatura) "asignatura_id" else "plan_estudio_id") == entidadId
        ) {
            "La recomendación pertenece a otro expediente."
        }
        require(conversacion.texto("estado") != "ARCHIVADA") {
            "Restaura el chat antes de aplicar recomendaciones."
        }
        val actual =
            recomendacionesChat(mensaje).firstOrNull { it.clave == seleccion.clave }
                ?: error("La recomendación ya no está disponible.")
        if (actual.aplicada) return@ejecutar
        require(actual.datos == seleccion.datos) { "La recomendación cambió. Vuelve a revisarla." }
        val expediente = if (asignatura) asignatura(entidadId) else plan(entidadId)
        if (!expediente.editable)
            throw FalloAcad(
                CategoriaError.Permiso,
                "No tienes permiso para modificar este expediente en su estado actual.",
            )
        val entidad = expediente.registro
        if (revisionVista.isBlank() || entidad.texto("actualizado_en") != revisionVista)
            throw FalloAcad(
                CategoriaError.Conflicto,
                "El expediente cambió mientras revisabas. Cierra la recomendación y vuelve a abrirla.",
            )
        val propuesta = actual.datos
        val idResultado = idAplicacionChat(mensajeId, actual.clave)
        when (actual.tipo) {
            "campo" -> {
                val cambios = parcheRecomendacionChat(entidad, asignatura, propuesta)
                if (asignatura) guardarAsignatura(entidadId, cambios, revisionVista)
                else guardarPlan(entidadId, cambios, revisionVista)
            }
            "bibliografia" -> {
                require(asignatura) { "La referencia requiere una asignatura." }
                require(propuesta.texto("cita").isNotBlank()) {
                    "La referencia no incluye una cita válida."
                }
                val existente = filas("bibliografia_asignatura", "id", idResultado)
                if (existente.isEmpty())
                    bibliografia(
                        null,
                        entidadId,
                        objeto(
                            "id" to idResultado,
                            "titulo" to propuesta.texto("titulo"),
                            "cita" to propuesta.texto("cita"),
                            "tipo" to propuesta.texto("clasificacion", "BASICA"),
                            "formato" to propuesta.texto("formato", "apa"),
                            "autores" to propuesta["autores"],
                            "editorial" to propuesta["editorial"],
                            "anio" to propuesta.texto("anio").toIntOrNull(),
                            "isbn" to propuesta["isbn"],
                            "referencia_biblioteca" to propuesta["referencia_biblioteca"],
                            "referencia_en_linea" to propuesta["referencia_en_linea"],
                        ),
                    )
            }
            "linea" -> {
                require(!asignatura) { "El bloque requiere un plan." }
                require(propuesta.nombre.isNotBlank()) { "El bloque necesita un nombre." }
                if (filas("lineas_plan", "id", idResultado).isEmpty())
                    guardarBloque(
                        null,
                        entidadId,
                        objeto(
                            "id" to idResultado,
                            "nombre" to propuesta.nombre,
                            "color" to propuesta["color"],
                            "orden" to
                                ((expediente.bloques.maxOfOrNull { it.numero("orden") } ?: -1) + 1),
                        ),
                    )
            }
            "asignacion",
            "cambio_ciclo" -> {
                require(!asignatura) { "El movimiento requiere un plan." }
                val materia =
                    expediente.asignaturas.firstOrNull { it.id == propuesta.texto("asignatura_id") }
                        ?: error("La asignatura ya no pertenece al plan.")
                val cambios =
                    parcheMovimientoChat(
                        actual.tipo,
                        propuesta,
                        entidad.numero("numero_ciclos"),
                        expediente.bloques,
                    )
                guardarAsignatura(materia.id, cambios, materia.texto("actualizado_en"))
            }
            "eliminar_linea" -> {
                require(!asignatura) { "El bloque requiere un plan." }
                val bloque =
                    expediente.bloques.firstOrNull { it.id == propuesta.texto("linea_plan_id") }
                if (bloque != null) {
                    val borrados =
                        cliente
                            .from("lineas_plan")
                            .delete {
                                filter {
                                    eq("id", bloque.id)
                                    eq("plan_estudio_id", entidadId)
                                }
                                select()
                            }
                            .decodeList<Registro>()
                    require(borrados.isNotEmpty()) { "No se pudo eliminar el bloque." }
                    invalidar("lineas_plan", "asignaturas")
                }
            }
            "asignatura" -> {
                require(!asignatura) { "La propuesta requiere un plan." }
                val existentes = filas("asignaturas", "id", idResultado)
                if (existentes.firstOrNull()?.texto("estado") in setOf("generando", "fallida"))
                    throw FalloAcad(
                        CategoriaError.Conflicto,
                        "La asignatura ya existe, pero su generación no está confirmada. Revísala en el mapa; no se creará ni se generará otra vez automáticamente.",
                    )
                if (existentes.isEmpty()) {
                    val estructura =
                        filas(
                                "estructuras_asignatura",
                                "estructura_plan_id",
                                entidad.texto("estructura_id"),
                                "nombre",
                            )
                            .firstOrNull()
                            ?: error("El plan no tiene una estructura de asignaturas.")
                    val ciclo = propuesta.numero("numeroCiclo")
                    require(ciclo == 0 || ciclo in 1..entidad.numero("numero_ciclos")) {
                        "El ciclo propuesto no pertenece al plan."
                    }
                    val nombreLinea = propuesta.texto("lineaCurricular").trim()
                    var lineaId =
                        expediente.bloques
                            .firstOrNull {
                                normalizarBusqueda(it.nombre) == normalizarBusqueda(nombreLinea)
                            }
                            ?.id
                    if (nombreLinea.isNotEmpty() && lineaId == null) {
                        val idLinea = idAplicacionChat(mensajeId, "linea:$nombreLinea")
                        lineaId =
                            filas("lineas_plan", "id", idLinea).firstOrNull()?.id
                                ?: guardarBloque(
                                        null,
                                        entidadId,
                                        objeto(
                                            "id" to idLinea,
                                            "nombre" to nombreLinea,
                                            "orden" to
                                                ((expediente.bloques.maxOfOrNull {
                                                    it.numero("orden")
                                                } ?: -1) + 1),
                                        ),
                                    )
                                    .id
                    }
                    val datosAsignatura =
                        objeto(
                            "id" to idResultado,
                            "plan_estudio_id" to entidadId,
                            "estructura_id" to estructura.id,
                            "nombre" to propuesta.nombre,
                            "codigo" to propuesta["codigo"],
                            "linea_plan_id" to lineaId,
                            "tipo" to
                                propuesta
                                    .texto("tipo")
                                    .takeIf {
                                        it in setOf("OBLIGATORIA", "OPTATIVA", "TRONCAL", "OTRA")
                                    }
                                    .orEmpty()
                                    .ifBlank { "OTRA" },
                            "numero_ciclo" to ciclo.takeIf { it > 0 },
                            "horas_academicas" to propuesta["horasAcademicas"],
                            "horas_independientes" to propuesta["horasIndependientes"],
                        )
                    cliente
                        .from("asignaturas")
                        .insert(
                            JsonObject(
                                datosAsignatura +
                                    objeto("estado" to "generando", "tipo_origen" to "IA") +
                                    auditoria(true)
                            )
                        )
                    invalidar("asignaturas")
                    // Same durable generation contract as useLanzarGeneracionAsignatura on the web.
                    // No automatic retry: the server may already have queued a paid generation.
                    try {
                        funcion(
                            "ai-generate-subject",
                            objeto(
                                "datosUpdate" to datosAsignatura,
                                "iaConfig" to
                                    objeto(
                                        "descripcionEnfoqueAcademico" to
                                            propuesta.texto("descripcion"),
                                        "webSearchEnabled" to false,
                                        "reasoningEffort" to "auto",
                                    ),
                            ),
                            tablasAfectadas = listOf("asignaturas"),
                        )
                    } catch (e: CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        throw FalloAcad(
                            CategoriaError.Red,
                            "La asignatura ya se creó. Verifica su generación en el mapa antes de reintentar; no se volverá a crear.",
                            e,
                        )
                    }
                }
            }
            else ->
                throw FalloAcad(
                    CategoriaError.Validacion,
                    "Esta recomendación todavía no puede aplicarse desde Android.",
                )
        }
        // Preserve the complete backend payload, including references and other recommendations.
        val vigente = uno(tablaMensajes, mensajeId)
        val propuestaVigente = vigente.objeto("propuesta")
        val lista = propuestaVigente.lista(actual.grupo)
        require(lista.getOrNull(actual.indice) == actual.datos) {
            "El contenido se guardó, pero la recomendación cambió. Revisa el expediente antes de continuar."
        }
        val marcada =
            JsonArray(
                lista.mapIndexed { i, rec ->
                    if (i == actual.indice) JsonObject(rec + objeto("aplicada" to true)) else rec
                }
            )
        guardar(
            tablaMensajes,
            mensajeId,
            objeto("propuesta" to JsonObject(propuestaVigente + (actual.grupo to marcada))),
            auditar = false,
        )
    }

    private val estadoCanalesTiempoReal = MutableStateFlow<Map<String, Boolean>>(emptyMap())

    val conexionTiempoReal: Flow<Boolean>
        get() =
            combine(cliente.realtime.status, estadoCanalesTiempoReal) { estado, canales ->
                    estado == Realtime.Status.CONNECTED && canales.values.all { it }
                }
                .distinctUntilChanged()

    /** Local commits are observed independently of the WebSocket, including unpublished tables. */
    fun cambios(tablas: List<String>): Flow<Unit> =
        merge(
            revisionesLocales
                .map { revisionesObservadas(it, tablas) }
                .distinctUntilChanged()
                .map { Unit },
            cambiosRemotos(tablas.distinct()),
        )

    private fun cambiosRemotos(tablas: List<String>): Flow<Unit> = flow {
        val clave = "android-${UUID.randomUUID()}"
        fun conectado(valor: Boolean) {
            estadoCanalesTiempoReal.update { it + (clave to valor) }
        }
        val remoto = channelFlow {
            val canal = cliente.channel(clave)
            val flujos = tablas.map { tabla ->
                canal.postgresChangeFlow<PostgresAction>(schema = "public") { table = tabla }
            }
            try {
                // Register collectors before joining, as required by supabase-kt's callback flows.
                flujos.forEach { flujo ->
                    launch(start = CoroutineStart.UNDISPATCHED) {
                        flujo.collect {
                            send(Unit)
                        }
                    }
                }
                launch(start = CoroutineStart.UNDISPATCHED) {
                    canal.systemFlow().collect { evento ->
                        if (evento.status == "error") {
                            if (BuildConfig.DEBUG)
                                android.util.Log.w("AcadRealtime", "Suscripción Postgres rechazada")
                            conectado(false)
                        } else if (evento.status == "ok") conectado(true)
                    }
                }
                launch(start = CoroutineStart.UNDISPATCHED) {
                    canal.status.collect { estado ->
                        val listo =
                            estado ==
                                io.github.jan.supabase.realtime.RealtimeChannel.Status.SUBSCRIBED
                        conectado(listo)
                        // The SDK reconnects internally without throwing from postgresChangeFlow.
                        // Every successful rejoin must reconcile changes missed while disconnected.
                        if (listo) send(Unit)
                    }
                }
                canal.subscribe()
                awaitCancellation()
            } finally {
                coroutineContext.cancelChildren()
                conectado(false)
                withContext(NonCancellable) { cliente.realtime.removeChannel(canal) }
            }
        }
            .retryWhen { error, intento ->
                if (error is CancellationException) throw error
                conectado(false)
                if (!puedeReintentarTiempoReal(error, intento)) return@retryWhen false
                delay((1_000L shl intento.toInt()) + kotlin.random.Random.nextLong(250))
                true
            }
            .catch { error ->
                if (error is CancellationException) throw error
                if (BuildConfig.DEBUG)
                    android.util.Log.w(
                        "AcadRealtime",
                        "Suscripción interrumpida: ${error::class.simpleName}",
                    )
                conectado(false)
                // Exhausted/permanent remote failures must not stop local mutation invalidations.
                // HTTP is reconciled on lifecycle resume; no infinite custom retry or polling.
                awaitCancellation()
            }
        try {
            emitAll(remoto)
        } finally {
            estadoCanalesTiempoReal.update { it - clave }
        }
    }

    private suspend fun <T> ejecutar(block: suspend () -> T): T =
        try {
            block()
        } catch (e: CancellationException) {
            throw e
        } catch (e: FalloAcad) {
            throw e
        } catch (e: Exception) {
            val mensaje = e.message.orEmpty()
            throw when {
                e is java.io.IOException ->
                    FalloAcad(
                        CategoriaError.Red,
                        "No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.",
                        e,
                    )
                mensaje.contains("Invalid login", true) ||
                    mensaje.contains("invalid_credentials", true) ->
                    FalloAcad(CategoriaError.Credenciales, "Correo o contraseña incorrectos.", e)
                mensaje.contains("row-level", true) ||
                    mensaje.contains("permission", true) ||
                    mensaje.contains("42501") ->
                    FalloAcad(
                        CategoriaError.Permiso,
                        "Tu cuenta no puede realizar esta operación en el estado actual.",
                        e,
                    )
                mensaje.contains("duplicate", true) || mensaje.contains("23505") ->
                    FalloAcad(
                        CategoriaError.Conflicto,
                        "Ya existe un registro con estos datos. Actualiza e inténtalo de nuevo.",
                        e,
                    )
                e is IllegalArgumentException -> FalloAcad(CategoriaError.Validacion, mensaje, e)
                else ->
                    FalloAcad(
                        CategoriaError.Servidor,
                        "El servidor no pudo completar la operación. Tus cambios siguen en el formulario. Intenta nuevamente.",
                        e,
                    )
            }
        }
}

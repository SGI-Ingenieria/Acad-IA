package mx.sgi.acadia.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import java.time.LocalDate
import java.util.UUID
import kotlinx.serialization.json.*
import mx.sgi.acadia.data.*

@Composable
fun EditarExpediente(
    tipo: String,
    original: Registro?,
    expediente: Expediente,
    materia: Boolean,
    ocupado: Boolean,
    error: String?,
    cerrar: () -> Unit,
    guardar: (Registro) -> Unit,
) {
    val r = expediente.registro
    val inicial = original ?: objeto()
    var nombre by rememberSaveable { mutableStateOf(inicial.nombre) }
    var codigo by rememberSaveable { mutableStateOf(inicial.texto("codigo")) }
    var horas by rememberSaveable {
        mutableStateOf(
            inicial
                .numero(
                    if (materia) "horas_academicas" else "semanas_por_ciclo",
                    if (materia) 0 else 16,
                )
                .toString()
        )
    }
    var independientes by rememberSaveable {
        mutableStateOf(inicial.numero("horas_independientes").toString())
    }
    var ciclo by rememberSaveable { mutableStateOf(inicial.numero("numero_ciclo", 1).toString()) }
    var tipoAsignatura by rememberSaveable { mutableStateOf(inicial.texto("tipo", "OBLIGATORIA")) }
    var texto by rememberSaveable {
        mutableStateOf(
            if (tipo == "campo") textoPlano(inicial.texto("valor")) else inicial.texto("cuerpo")
        )
    }
    var proposito by rememberSaveable { mutableStateOf(inicial.texto("proposito")) }
    var aporte by rememberSaveable { mutableStateOf(inicial.texto("aporte_perfil_egreso")) }
    var alcance by rememberSaveable { mutableStateOf(inicial.texto("alcance_formativo")) }
    var cita by rememberSaveable { mutableStateOf(inicial.texto("cita")) }
    var referencia by rememberSaveable { mutableStateOf(inicial.texto("referencia_en_linea")) }
    var tipoBiblio by rememberSaveable { mutableStateOf(inicial.texto("tipo", "BASICA")) }
    var titulo by rememberSaveable { mutableStateOf(inicial.texto("titulo")) }
    var seleccion by rememberSaveable {
        mutableStateOf(
            expediente.transiciones.firstOrNull { it.texto("clave") != "APROBADO" }?.id.orEmpty()
        )
    }
    var unidadesTexto by rememberSaveable {
        mutableStateOf(JsonArray(inicial.lista("temas")).toString())
    }
    var evaluacionTexto by rememberSaveable {
        mutableStateOf(JsonArray(r.lista("criterios_de_evaluacion")).toString())
    }
    val temas = Json.parseToJsonElement(unidadesTexto).jsonArray.map { it.jsonObject }
    val criterios = Json.parseToJsonElement(evaluacionTexto).jsonArray.map { it.jsonObject }
    var validacion by remember { mutableStateOf<String?>(null) }
    val tituloDialogo =
        when (tipo) {
            "generales" -> "Datos generales"
            "campo" -> inicial.texto("titulo")
            "bloque" -> "Bloque formativo"
            "bibliografia" -> "Referencia bibliográfica"
            "unidad" -> "Unidad temática"
            "evaluacion" -> "Criterios de evaluación"
            "comentario" -> "Nueva observación"
            else -> "Cambiar estado"
        }
    DialogoFormulario(
        tituloDialogo,
        ocupado,
        validacion ?: error,
        cerrar,
        guardar = {
            validacion = null
            val cambios: Registro? =
                when (tipo) {
                    "generales" -> {
                        validacion =
                            Validacion.nombre(nombre)
                                ?: if (materia)
                                    Validacion.horas(horas)
                                        ?: Validacion.horas(independientes)
                                        ?: if (
                                            ciclo.toIntOrNull()?.let {
                                                it in
                                                    1..r.objeto("planes_estudio")
                                                            .numero("numero_ciclos", 30)
                                            } == true
                                        )
                                            null
                                        else "Selecciona un ciclo válido."
                                else null
                        if (materia)
                            objeto(
                                "nombre" to nombre.trim(),
                                "codigo" to codigo.trim(),
                                "horas_academicas" to horas.toIntOrNull(),
                                "horas_independientes" to independientes.toIntOrNull(),
                                "numero_ciclo" to ciclo.toIntOrNull(),
                                "tipo" to tipoAsignatura,
                            )
                        else if (r.objeto("estructuras_plan").texto("tipo") == "CURRICULAR") {
                            if (horas.toIntOrNull()?.let { it in 1..52 } != true)
                                validacion = "Usa entre 1 y 52 semanas."
                            objeto("semanas_por_ciclo" to horas.toIntOrNull())
                        } else
                            objeto("nombre" to nombre.trim(), "nombre_propuesto" to nombre.trim())
                    }
                    "campo" -> {
                        val schema = inicial.objeto("definicion")
                        val tipoCampo = schema.texto("type", "string")
                        val valor: JsonElement =
                            when (tipoCampo) {
                                "integer" -> {
                                    val numero = texto.toIntOrNull()
                                    if (numero == null) validacion = "Escribe un número entero."
                                    numero?.let { JsonPrimitive(it) } ?: JsonNull
                                }
                                "number" -> {
                                    val numero = texto.toDoubleOrNull()
                                    if (numero == null || !numero.isFinite())
                                        validacion = "Escribe un número válido."
                                    numero?.let { JsonPrimitive(it) } ?: JsonNull
                                }
                                "boolean" -> JsonPrimitive(texto == "true")
                                else ->
                                    JsonPrimitive(
                                        if (texto == textoPlano(inicial.texto("valor")))
                                            inicial.texto("valor")
                                        else if (inicial.texto("valor").contains(Regex("<[^>]+>")))
                                            "<p>${android.text.Html.escapeHtml(texto).replace("\n","<br>")}</p>"
                                        else texto
                                    )
                            }
                        val opciones = schema["enum"] as? JsonArray
                        if (opciones != null && valor !in opciones)
                            validacion = "Selecciona un valor del catálogo."
                        objeto(inicial.texto("clave") to valor)
                    }
                    "bloque" -> {
                        validacion = Validacion.nombre(nombre)
                        objeto(
                            "nombre" to nombre.trim(),
                            "proposito" to proposito,
                            "aporte_perfil_egreso" to aporte,
                            "alcance_formativo" to alcance,
                            "orden" to inicial.numero("orden", expediente.bloques.size),
                        )
                    }
                    "bibliografia" -> {
                        if (cita.isBlank()) validacion = "Escribe la cita."
                        if (
                            referencia.isNotBlank() &&
                                !referencia.startsWith("https://") &&
                                !referencia.startsWith("http://")
                        )
                            validacion = "Usa una URL http o https."
                        objeto(
                            "cita" to cita.trim(),
                            "tipo" to tipoBiblio,
                            "titulo" to titulo.ifBlank { null },
                            "referencia_en_linea" to referencia.ifBlank { null },
                        )
                    }
                    "unidad" -> {
                        if (titulo.isBlank() || temas.any { it.texto("nombre").isBlank() })
                            validacion = "La unidad y sus temas necesitan un nombre."
                        val unidades = r.lista("contenido_tematico").toMutableList()
                        val unidad =
                            JsonObject(
                                inicial +
                                    objeto(
                                        "id" to inicial.id.ifBlank { UUID.randomUUID().toString() },
                                        "titulo" to titulo,
                                        "unidad" to inicial.numero("unidad", unidades.size + 1),
                                        "temas" to JsonArray(temas),
                                    )
                            )
                        val index = unidades.indexOfFirst { it == inicial }
                        if (index >= 0) unidades[index] = unidad else unidades.add(unidad)
                        objeto("contenido_tematico" to JsonArray(unidades))
                    }
                    "evaluacion" -> {
                        validacion = Validacion.evaluacion(criterios)
                        objeto("criterios_de_evaluacion" to JsonArray(criterios))
                    }
                    "comentario" -> {
                        if (texto.isBlank()) validacion = "Escribe tu observación."
                        objeto("cuerpo" to texto)
                    }
                    "transicion" -> {
                        if (seleccion.isBlank())
                            validacion = "No hay transiciones disponibles desde Android."
                        if (
                            materia &&
                                r.texto("estado") == "revisada" &&
                                seleccion == "borrador" &&
                                texto.isBlank()
                        )
                            validacion = "Describe los cambios solicitados."
                        objeto("estado" to seleccion, "comentario" to texto)
                    }
                    else -> null
                }
            if (validacion == null && cambios != null) guardar(cambios)
        },
    ) {
        when (tipo) {
            "generales" -> {
                if (materia || r.objeto("estructuras_plan").texto("tipo") != "CURRICULAR")
                    CampoTexto("Nombre", nombre, { nombre = it })
                else {
                    Text(
                        "El nombre y la fecha de un plan curricular son inmutables.",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    CampoTexto("Semanas por ciclo", horas, { horas = it }, true)
                }
                if (materia) {
                    CampoTexto("Código", codigo, { codigo = it })
                    Selector(
                        "Tipo",
                        tipoAsignatura,
                        listOf("OBLIGATORIA", "OPTATIVA", "TRONCAL", "OTRA").map {
                            it to etiquetaCampo(it.lowercase())
                        },
                    ) {
                        tipoAsignatura = it
                    }
                    CampoTexto("Ciclo", ciclo, { ciclo = it }, true)
                    CampoTexto("Horas académicas", horas, { horas = it }, true)
                    CampoTexto(
                        "Horas independientes",
                        independientes,
                        { independientes = it },
                        true,
                    )
                }
            }
            "campo" -> {
                val schema = inicial.objeto("definicion")
                val opciones = schema["enum"] as? JsonArray
                when {
                    opciones != null ->
                        Selector(
                            "Valor",
                            texto,
                            opciones.map { it.jsonPrimitive.content to it.jsonPrimitive.content },
                        ) {
                            texto = it
                        }
                    schema.texto("type") == "boolean" ->
                        Selector("Valor", texto, listOf("true" to "Sí", "false" to "No")) {
                            texto = it
                        }
                    else ->
                        CampoTexto(
                            "Contenido",
                            texto,
                            { texto = it },
                            numerico = schema.texto("type") in listOf("integer", "number"),
                            multilinea = schema.texto("type") !in listOf("integer", "number"),
                        )
                }
                if (inicial.texto("valor").contains(Regex("<[^>]+>")))
                    Text(
                        "Edición en texto: al guardar cambios se conserva el contenido, no el formato enriquecido original.",
                        style = MaterialTheme.typography.bodySmall,
                    )
            }
            "comentario" -> CampoTexto("Observación", texto, { texto = it }, multilinea = true)
            "bloque" -> {
                CampoTexto("Nombre", nombre, { nombre = it })
                CampoTexto("Propósito", proposito, { proposito = it }, multilinea = true)
                CampoTexto("Aporte al perfil de egreso", aporte, { aporte = it }, multilinea = true)
                CampoTexto("Alcance formativo", alcance, { alcance = it }, multilinea = true)
            }
            "bibliografia" -> {
                Selector(
                    "Tipo",
                    tipoBiblio,
                    listOf("BASICA" to "Básica", "COMPLEMENTARIA" to "Complementaria"),
                ) {
                    tipoBiblio = it
                }
                CampoTexto("Título", titulo, { titulo = it })
                CampoTexto("Cita completa", cita, { cita = it }, multilinea = true)
                CampoTexto("Fuente en línea", referencia, { referencia = it })
            }
            "unidad" -> {
                CampoTexto("Título de la unidad", titulo, { titulo = it })
                temas.forEachIndexed { i, tema ->
                    Row {
                        OutlinedTextField(
                            tema.texto("nombre"),
                            { nuevo ->
                                unidadesTexto =
                                    JsonArray(
                                            temas.mapIndexed { j, t ->
                                                if (j == i)
                                                    JsonObject(t + objeto("nombre" to nuevo))
                                                else t
                                            }
                                        )
                                        .toString()
                            },
                            label = { Text("Tema ${i+1}") },
                            modifier = Modifier.weight(1f),
                        )
                        AccionIcono("Quitar tema ${i+1}", Icons.Outlined.Close) {
                            unidadesTexto =
                                JsonArray(temas.filterIndexed { j, _ -> j != i }).toString()
                        }
                    }
                }
                TextButton(
                    onClick = {
                        unidadesTexto =
                            JsonArray(
                                    temas +
                                        objeto("id" to UUID.randomUUID().toString(), "nombre" to "")
                                )
                                .toString()
                    }
                ) {
                    Text("Añadir tema")
                }
            }
            "evaluacion" -> {
                criterios.forEachIndexed { i, criterio ->
                    CampoTexto(
                        "Criterio ${i+1}",
                        criterio.texto("nombre"),
                        { nuevo ->
                            evaluacionTexto =
                                JsonArray(
                                        criterios.mapIndexed { j, c ->
                                            if (i == j) JsonObject(c + objeto("nombre" to nuevo))
                                            else c
                                        }
                                    )
                                    .toString()
                        },
                    )
                    Row {
                        OutlinedTextField(
                            criterio.texto("porcentaje"),
                            { nuevo ->
                                evaluacionTexto =
                                    JsonArray(
                                            criterios.mapIndexed { j, c ->
                                                if (i == j)
                                                    JsonObject(
                                                        c +
                                                            objeto(
                                                                "porcentaje" to
                                                                    (nuevo.toDoubleOrNull() ?: 0)
                                                            )
                                                    )
                                                else c
                                            }
                                        )
                                        .toString()
                            },
                            label = { Text("Porcentaje") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.weight(1f),
                        )
                        AccionIcono("Quitar criterio", Icons.Outlined.Close) {
                            evaluacionTexto =
                                JsonArray(criterios.filterIndexed { j, _ -> j != i }).toString()
                        }
                    }
                }
                Text(
                    "Total ${criterios.sumOf{it.decimal("porcentaje")}} %",
                    style = MaterialTheme.typography.titleMedium,
                )
                TextButton(
                    onClick = {
                        evaluacionTexto =
                            JsonArray(criterios + objeto("nombre" to "", "porcentaje" to 0))
                                .toString()
                    }
                ) {
                    Text("Añadir criterio")
                }
            }
            "transicion" -> {
                Selector(
                    "Siguiente estado",
                    seleccion,
                    expediente.transiciones
                        .filter { it.texto("clave") != "APROBADO" }
                        .map { it.id to it.texto("etiqueta") },
                ) {
                    seleccion = it
                }
                CampoTexto("Comentario", texto, { texto = it }, multilinea = true)
                if (!materia)
                    Text(
                        "La aprobación oficial con documentos se completa en la versión web.",
                        style = MaterialTheme.typography.bodySmall,
                    )
            }
        }
    }
}

@Composable
fun CampoTexto(
    etiqueta: String,
    valor: String,
    cambiar: (String) -> Unit,
    numerico: Boolean = false,
    multilinea: Boolean = false,
) {
    OutlinedTextField(
        valor,
        cambiar,
        label = { Text(etiqueta) },
        modifier = Modifier.fillMaxWidth(),
        minLines = if (multilinea) 4 else 1,
        singleLine = !multilinea,
        keyboardOptions =
            KeyboardOptions(
                keyboardType = if (numerico) KeyboardType.Number else KeyboardType.Text
            ),
    )
}

private data class OpcionesNuevo(
    val carreras: List<Registro>,
    val estructuras: List<Registro>,
    val plan: Registro? = null,
)

@Composable
fun NuevoPantalla(
    repo: RepositorioAcad,
    planId: String,
    atras: () -> Unit,
    creado: (String, Boolean) -> Unit,
) {
    val materia = planId.isNotBlank()
    val solicitudId = rememberSaveable { UUID.randomUUID().toString() }
    val vm: ContenidoViewModel<OpcionesNuevo> =
        viewModel(
            factory =
                fabrica {
                    ContenidoViewModel({
                        if (materia) {
                            val plan = repo.uno("planes_estudio", planId)
                            OpcionesNuevo(
                                emptyList(),
                                repo.filas(
                                    "estructuras_asignatura",
                                    "estructura_plan_id",
                                    plan.texto("estructura_id"),
                                    "nombre",
                                ),
                                plan,
                            )
                        } else
                            OpcionesNuevo(
                                repo.catalogos("carreras"),
                                repo.catalogos("estructuras_plan"),
                            )
                    })
                }
        )
    val estado by vm.estado.collectAsStateWithLifecycle()
    val ocupado by vm.guardando.collectAsStateWithLifecycle()
    val error by vm.mensaje.collectAsStateWithLifecycle()
    var carrera by rememberSaveable { mutableStateOf("") }
    var estructura by rememberSaveable { mutableStateOf("") }
    var nombre by rememberSaveable { mutableStateOf("") }
    var codigo by rememberSaveable { mutableStateOf("") }
    var ciclos by rememberSaveable { mutableStateOf(if (materia) "1" else "8") }
    var semanas by rememberSaveable { mutableStateOf("16") }
    var fecha by rememberSaveable {
        mutableStateOf(LocalDate.now().plusMonths(1).withDayOfMonth(1).toString())
    }
    var tipo by rememberSaveable { mutableStateOf("Semestre") }
    var validacion by remember { mutableStateOf<String?>(null) }
    Pagina(if (materia) "Nueva asignatura" else "Nuevo plan", atras) { padding ->
        Box(Modifier.padding(padding)) {
            Carga(estado, vm::actualizar) { opciones ->
                LazyColumn(
                    contentPadding = PaddingValues(24.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                ) {
                    item {
                        Encabezado(
                            if (materia) "Asignatura" else "Plan de estudios",
                            if (materia) opciones.plan?.nombre else "Crear",
                        )
                    }
                    if (!materia)
                        item {
                            Selector(
                                "Carrera",
                                carrera,
                                opciones.carreras.map { it.id to it.nombre },
                            ) {
                                carrera = it
                            }
                        }
                    item {
                        Selector(
                            "Estructura académica",
                            estructura,
                            opciones.estructuras.map { it.id to it.nombre },
                        ) {
                            estructura = it
                        }
                    }
                    val curricular =
                        !materia &&
                            opciones.estructuras.find { it.id == estructura }?.texto("tipo") ==
                                "CURRICULAR"
                    if (!curricular) item { CampoTexto("Nombre", nombre, { nombre = it }) }
                    if (materia) item { CampoTexto("Código", codigo, { codigo = it }) }
                    if (curricular)
                        item {
                            CampoTexto("Inicio de impartición (AAAA-MM-DD)", fecha, { fecha = it })
                        }
                    item {
                        CampoTexto(
                            if (materia) "Ciclo" else "Número de ciclos",
                            ciclos,
                            { ciclos = it },
                            true,
                        )
                    }
                    if (!materia) {
                        item {
                            Selector(
                                "Periodicidad",
                                tipo,
                                listOf("Semestre", "Cuatrimestre", "Trimestre", "Otro").map {
                                    it to it
                                },
                            ) {
                                tipo = it
                            }
                        }
                        item { CampoTexto("Semanas por ciclo", semanas, { semanas = it }, true) }
                    }
                    if (validacion != null || error != null) item { Aviso(validacion ?: error!!) }
                    item {
                        Button(
                            enabled =
                                !ocupado &&
                                    estructura.isNotBlank() &&
                                    (materia || carrera.isNotBlank()),
                            modifier = Modifier.fillMaxWidth(),
                            onClick = {
                                validacion =
                                    if (ciclos.toIntOrNull()?.let { it > 0 } != true)
                                        "Revisa el número de ciclos."
                                    else if (!curricular && nombre.isBlank()) "Escribe el nombre."
                                    else if (curricular) Validacion.fechaCurricular(fecha) else null
                                if (validacion == null) {
                                    var nuevoId = ""
                                    vm.guardar(
                                        {
                                            val nuevo =
                                                if (materia)
                                                    repo.crearAsignatura(
                                                        opciones.plan!!,
                                                        estructura,
                                                        nombre,
                                                        codigo,
                                                        ciclos.toInt(),
                                                        solicitudId,
                                                    )
                                                else
                                                    repo.crearPlan(
                                                        opciones.carreras.first {
                                                            it.id == carrera
                                                        },
                                                        opciones.estructuras.first {
                                                            it.id == estructura
                                                        },
                                                        nombre,
                                                        fecha,
                                                        ciclos.toInt(),
                                                        semanas.toIntOrNull() ?: 0,
                                                        tipo,
                                                        solicitudId,
                                                    )
                                            nuevoId = nuevo.id
                                        },
                                        { creado(nuevoId, materia) },
                                    )
                                }
                            },
                        ) {
                            if (ocupado)
                                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                            else Text(if (materia) "Crear asignatura" else "Crear plan")
                        }
                    }
                }
            }
        }
    }
}

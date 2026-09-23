@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package mx.sgi.acadia.ui

import android.content.Intent
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.serialization.json.*
import mx.sgi.acadia.data.*

@Composable
fun ExpedientePantalla(
    repo: RepositorioAcad,
    ruta: Detalle,
    sesion: Sesion,
    atras: () -> Unit,
    abrirAsignatura: (String) -> Unit,
    nuevaAsignatura: (String) -> Unit,
    chat: () -> Unit,
) {
    val materia = ruta.asignatura
    val vm: ContenidoViewModel<Expediente> =
        viewModel(
            factory =
                fabrica {
                    ContenidoViewModel(
                        { if (materia) repo.asignatura(ruta.id) else repo.plan(ruta.id) },
                        repo,
                        if (materia)
                            listOf(
                                "asignaturas",
                                "bibliografia_asignatura",
                                "comentarios_asignatura",
                                "comentarios_plan",
                                "cambios_asignatura",
                                "planes_estudio",
                                "estructuras_asignatura",
                            )
                        else
                            listOf(
                                "planes_estudio",
                                "asignaturas",
                                "comentarios_plan",
                                "lineas_plan",
                                "cambios_plan",
                                "carreras",
                                "facultades",
                                "estructuras_plan",
                            ),
                    )
                }
        )
    val estado by vm.estado.collectAsStateWithLifecycle()
    val guardando by vm.guardando.collectAsStateWithLifecycle()
    val mensaje by vm.mensaje.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var selectorResponsableAbierto by rememberSaveable { mutableStateOf(false) }
    var vistaMapa by rememberSaveable { mutableStateOf("Mapa") }
    var historialAbierto by rememberSaveable { mutableStateOf(false) }
    var editor by rememberSaveable { mutableStateOf<String?>(null) }
    var registroEditorJson by rememberSaveable { mutableStateOf<String?>(null) }
    val registroEditor = registroEditorJson?.let { Json.parseToJsonElement(it).jsonObject }
    var revisionEditor by rememberSaveable { mutableStateOf<String?>(null) }
    var datosEditor by rememberSaveable { mutableStateOf("{}") }
    var eliminacion by remember { mutableStateOf<Registro?>(null) }
    val context = LocalContext.current
    val tabs =
        if (materia)
            listOf("Resumen", "Contenido", "Evaluación", "Bibliografía", "Responsables", "Revisión")
        else listOf("Resumen", "Mapa curricular", "Revisión")
    fun editar(tipo: String, registro: Registro? = null) {
        vm.mensaje.value = null
        registroEditorJson = registro?.toString()
        editor = tipo
        revisionEditor = estado.datos?.registro?.texto("actualizado_en")
        datosEditor =
            estado.datos?.registro?.objeto("datos").toString().takeUnless { it == "null" } ?: "{}"
    }
    Pagina(
        if (materia) "Asignatura" else "Plan de estudio",
        atras,
        mensaje = mensaje.takeIf { editor == null },
        consumirMensaje = { vm.mensaje.value = null },
        accionFlotante = {
            if (tab == tabs.lastIndex) {
                estado.datos?.let { expediente ->
                    AccionFlotanteRevision(
                        expediente,
                        materia,
                        sesion,
                        guardando,
                        mensaje,
                        comentar = { editar("comentario") },
                        transicionar = { destino, comentario, completado ->
                            vm.guardar(
                                { repo.cambiarEstado(ruta.id, materia, destino, comentario) },
                                completado,
                            )
                        },
                    )
                }
            }
        },
        acciones = {
            val datos = estado.datos
            if (datos != null) {
                val enRevision = tab == tabs.lastIndex
                if (tab == 0 && sesion.permite(Permiso.IA))
                    AccionIcono("Asistente IA", Icons.Outlined.AutoAwesome, accion = chat)
                if (!materia && tab == 1 && datos.editable)
                    AccionCrearEnMapa(
                        vistaMapa,
                        sesion.permite(Permiso.EditarAsignaturas),
                        guardando,
                        { nuevaAsignatura(ruta.id) },
                        { editar("bloque") },
                    )
                if (materia && datos.editable)
                    when (tab) {
                        1 ->
                            AccionIcono("Añadir unidad", Icons.Outlined.Add, !guardando) {
                                editar("unidad")
                            }
                        2 ->
                            AccionIcono("Editar evaluación", Icons.Outlined.Edit, !guardando) {
                                editar("evaluacion")
                            }
                        3 ->
                            AccionIcono("Añadir referencia", Icons.Outlined.Add, !guardando) {
                                editar("bibliografia")
                            }
                    }
                if (
                    materia &&
                        tab == 4 &&
                        datos.editable &&
                        sesion.permite(Permiso.GestionarResponsables)
                )
                    AccionIcono(
                        "Asignar profesor responsable",
                        Icons.Outlined.PersonAdd,
                        !guardando,
                    ) {
                        selectorResponsableAbierto = true
                    }
                if (enRevision)
                    AccionIcono("Historial de cambios", Icons.Outlined.History) {
                        vm.actualizar()
                        historialAbierto = true
                    }
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding)) {
            Carga(estado, vm::actualizar) { expediente ->
                val r = expediente.registro
                Column {
                    SecondaryScrollableTabRow(
                        selectedTabIndex = tab,
                        edgePadding = 24.dp,
                        containerColor = MaterialTheme.colorScheme.background,
                    ) {
                        tabs.forEachIndexed { i, titulo ->
                            Tab(
                                selected = tab == i,
                                onClick = {
                                    tab = i
                                    if (titulo != "Responsables") selectorResponsableAbierto = false
                                    if (titulo == "Revisión") vm.actualizar()
                                },
                                text = { Text(titulo) },
                            )
                        }
                    }
                    if (!materia && tab == 1)
                        MapaCurricular(
                            expediente,
                            expediente.editable && sesion.permite(Permiso.EditarAsignaturas),
                            guardando,
                            null,
                            abrirAsignatura,
                            { nuevaAsignatura(r.id) },
                            { asignatura, destino ->
                                vm.guardarOptimista(
                                    { anterior -> moverEnMapa(anterior, asignatura.id, destino) },
                                    { repo.moverAsignaturaMapa(r, asignatura, destino) },
                                )
                            },
                            nuevoBloque =
                                if (expediente.editable) {
                                    { editar("bloque") }
                                } else null,
                            editarBloque =
                                if (expediente.editable) {
                                    { editar("bloque", it) }
                                } else null,
                            mostrarAltaAsignatura = false,
                            vistaSeleccionada = vistaMapa,
                            cambiarVista = { vistaMapa = it },
                        )
                    else if (tab == tabs.lastIndex)
                        Column {
                            if (guardando) LinearProgressIndicator(Modifier.fillMaxWidth())
                            RevisionAcademica(
                                expediente,
                                materia,
                                sesion,
                                guardando,
                                mensaje?.takeUnless { it == "Cambios guardados" },
                                comentar = { editar("comentario") },
                                resolver = { comentario, resuelto ->
                                    vm.guardarOptimista(
                                        { anterior ->
                                            anterior.copy(
                                                comentarios =
                                                    anterior.comentarios.map {
                                                        if (it.id == comentario.id)
                                                            JsonObject(
                                                                it + objeto("resuelto" to resuelto)
                                                            )
                                                        else it
                                                    }
                                            )
                                        },
                                        {
                                            repo.resolverComentario(
                                                comentario.id,
                                                materia && !comentario.booleano("_origen_plan"),
                                                resuelto,
                                            )
                                        },
                                    )
                                },
                                transicionar = { destino, comentario, completado ->
                                    vm.guardar(
                                        { repo.cambiarEstado(r.id, materia, destino, comentario) },
                                        completado,
                                    )
                                },
                                mostrarAccionComentario = false,
                            )
                        }
                    else
                        LazyColumn(
                            Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(24.dp),
                            verticalArrangement = Arrangement.spacedBy(24.dp),
                        ) {
                            if (guardando) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
                            if (tab == 0) {
                                item {
                                    Encabezado(
                                        r.nombre,
                                        if (materia) r.texto("codigo").ifBlank { "Asignatura" }
                                        else r.objeto("carreras").texto("nivel"),
                                    )
                                }
                                if (
                                    !materia &&
                                        r.objeto("carreras").objeto("facultades").isNotEmpty()
                                )
                                    item {
                                        FacultadIdentidad(r.objeto("carreras").objeto("facultades"))
                                    }
                                item {
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        EtiquetaEstado(
                                            if (materia) r.texto("estado")
                                            else r.objeto("estados_plan").texto("etiqueta")
                                        )
                                        if (r.texto("tipo_origen") == "IA")
                                            EtiquetaEstado("Generado con IA")
                                    }
                                }
                                item {
                                    FlowRow(
                                        Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(24.dp),
                                        verticalArrangement = Arrangement.spacedBy(16.dp),
                                    ) {
                                        if (materia) {
                                            Dato(r.decimal("creditos").toString(), "Créditos")
                                            Dato(
                                                r.numero("horas_academicas").toString(),
                                                "Horas académicas",
                                            )
                                            Dato(
                                                r.numero("horas_independientes").toString(),
                                                "Independientes",
                                            )
                                        } else {
                                            Dato(
                                                r.numero("numero_ciclos").toString(),
                                                r.texto("tipo_ciclo") + "s",
                                            )
                                            Dato(
                                                expediente.asignaturas
                                                    .count { it.texto("estado") != "archivada" }
                                                    .toString(),
                                                "Asignaturas",
                                            )
                                            Dato(
                                                expediente.asignaturas
                                                    .filter { it.texto("estado") != "archivada" }
                                                    .sumOf { it.decimal("creditos") }
                                                    .toString(),
                                                "Créditos",
                                            )
                                        }
                                    }
                                }
                                if (
                                    !materia &&
                                        r.objeto("estructuras_plan").texto("tipo") == "CURRICULAR"
                                )
                                    item {
                                        TextoAcademico(
                                            "Duración del ciclo",
                                            "${r.numero("semanas_por_ciclo", 16)} semanas",
                                            if (expediente.editable) ({ editar("generales", r) })
                                            else null,
                                        )
                                    }
                                else
                                    item {
                                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                            if (expediente.editable)
                                                OutlinedButton(
                                                    onClick = { editar("generales", r) }
                                                ) {
                                                    Icon(Icons.Outlined.Edit, null)
                                                    Spacer(Modifier.width(8.dp))
                                                    Text("Editar")
                                                }
                                        }
                                    }
                                if (!expediente.editable)
                                    item {
                                        Text(
                                            "Consulta · La edición está restringida por tus permisos o por el estado académico.",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                val schema =
                                    r.objeto(
                                            if (materia) "estructuras_asignatura"
                                            else "estructuras_plan"
                                        )
                                        .objeto("definicion")
                                        .objeto("properties")
                                val datos = r.objeto("datos")
                                val claves = (schema.keys + datos.keys).toList()
                                if (claves.isEmpty()) item { Vacio("Sin fundamentos registrados") }
                                items(claves, key = { it }) { clave ->
                                    val valor = datos[clave]
                                    val definicion = schema[clave] as? JsonObject
                                    val titulo =
                                        definicion?.texto("title")?.ifBlank { etiquetaCampo(clave) }
                                            ?: etiquetaCampo(clave)
                                    when (valor) {
                                        is JsonObject -> {
                                            Text(
                                                titulo,
                                                style = MaterialTheme.typography.titleMedium,
                                            )
                                            valor.forEach { (k, v) ->
                                                TextoAcademico(etiquetaCampo(k), renderValor(v))
                                            }
                                        }
                                        is JsonArray -> {
                                            Text(
                                                titulo,
                                                style = MaterialTheme.typography.titleMedium,
                                            )
                                            valor.forEach {
                                                ContenidoEnriquecido(renderValor(it))
                                            }
                                        }
                                        else ->
                                            TextoAcademico(
                                                titulo,
                                                (valor as? JsonPrimitive)?.contentOrNull.orEmpty(),
                                                if (
                                                    expediente.editable &&
                                                        definicion?.texto("type", "string") !in
                                                            listOf("object", "array")
                                                ) {
                                                    {
                                                        editar(
                                                            "campo",
                                                            objeto(
                                                                "clave" to clave,
                                                                "titulo" to titulo,
                                                                "valor" to valor,
                                                                "definicion" to definicion,
                                                            ),
                                                        )
                                                    }
                                                } else null,
                                            )
                                    }
                                }
                            } else if (materia && tab == 4) {
                                item {
                                    ResponsablesAsignatura(
                                        repo,
                                        ruta.id,
                                        selectorResponsableAbierto,
                                        { selectorResponsableAbierto = it },
                                    )
                                }
                            } else if (materia && tab == 1) {
                                val unidades = r.lista("contenido_tematico")
                                if (unidades.isEmpty()) item { Vacio("Añade una unidad") }
                                items(
                                    unidades,
                                    key = { it.id.ifBlank { it.numero("unidad").toString() } },
                                ) { unidad ->
                                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(
                                                "${unidad.numero("unidad")}. ${unidad.texto("titulo")}",
                                                Modifier.weight(1f),
                                                style = MaterialTheme.typography.titleLarge,
                                            )
                                            if (expediente.editable)
                                                AccionIcono("Editar unidad", Icons.Outlined.Edit) {
                                                    editar("unidad", unidad)
                                                }
                                        }
                                        unidad.lista("temas").forEachIndexed { i, tema ->
                                            Text(
                                                "${unidad.numero("unidad")}.${i+1}  ${tema.texto("nombre")}",
                                                style = MaterialTheme.typography.bodyLarge,
                                            )
                                            tema.lista("subtemas").forEach { sub ->
                                                Text(
                                                    "    • ${sub.texto("nombre")}",
                                                    style = MaterialTheme.typography.bodyMedium,
                                                )
                                            }
                                        }
                                        HorizontalDivider()
                                    }
                                }
                            } else if (materia && tab == 2) {
                                val criterios = r.lista("criterios_de_evaluacion")
                                if (criterios.isEmpty()) item { Vacio("Define la evaluación") }
                                items(criterios) { criterio ->
                                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Row(
                                            Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                        ) {
                                            Text(criterio.nombreCriterio, Modifier.weight(1f))
                                            Text(
                                                "${criterio.decimal("porcentaje")}%",
                                                style = MaterialTheme.typography.titleMedium,
                                            )
                                        }
                                        LinearProgressIndicator(
                                            progress = {
                                                (criterio.decimal("porcentaje") / 100)
                                                    .toFloat()
                                                    .coerceIn(0f, 1f)
                                            },
                                            modifier = Modifier.fillMaxWidth(),
                                        )
                                    }
                                }
                                item {
                                    Text(
                                        "Total: ${criterios.sumOf{it.decimal("porcentaje")}} %",
                                        style = MaterialTheme.typography.titleMedium,
                                    )
                                }
                            } else if (materia && tab == 3) {
                                if (expediente.bibliografia.isEmpty())
                                    item {
                                        Vacio(
                                            "Añade una referencia",
                                            Icons.AutoMirrored.Outlined.MenuBook,
                                        )
                                    }
                                items(expediente.bibliografia, key = { it.id }) { ref ->
                                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                        EtiquetaEstado(ref.texto("tipo"))
                                        if (ref.texto("titulo").isNotBlank())
                                            Text(
                                                ref.texto("titulo"),
                                                style = MaterialTheme.typography.titleMedium,
                                            )
                                        Text(
                                            ref.texto("cita"),
                                            style = MaterialTheme.typography.bodyLarge,
                                        )
                                        enlaceReferenciaEnLinea(ref.texto("referencia_en_linea"))
                                            ?.let { url ->
                                                TextButton(
                                                    onClick = {
                                                        context.startActivity(
                                                            Intent(Intent.ACTION_VIEW, url.toUri())
                                                        )
                                                    }
                                                ) {
                                                    Text("Consultar fuente")
                                                    Icon(
                                                        Icons.AutoMirrored.Outlined.OpenInNew,
                                                        null,
                                                    )
                                                }
                                            }
                                        enlaceBiblioteca(ref.texto("referencia_biblioteca"))?.let {
                                            url ->
                                            TextButton(
                                                onClick = {
                                                    context.startActivity(
                                                        Intent(Intent.ACTION_VIEW, url.toUri())
                                                    )
                                                }
                                            ) {
                                                Icon(Icons.Outlined.LocalLibrary, null)
                                                Spacer(Modifier.width(8.dp))
                                                Text("Biblioteca La Salle")
                                            }
                                        }
                                        if (expediente.editable)
                                            Row {
                                                AccionIcono(
                                                    "Editar referencia",
                                                    Icons.Outlined.Edit,
                                                ) {
                                                    editar("bibliografia", ref)
                                                }
                                                AccionIcono(
                                                    "Eliminar referencia",
                                                    Icons.Outlined.DeleteOutline,
                                                ) {
                                                    eliminacion = ref
                                                }
                                            }
                                        HorizontalDivider()
                                    }
                                }
                            }
                        }
                }
                if (historialAbierto) HistorialAcademico(expediente) { historialAbierto = false }
                if (editor == "bibliografia")
                    BibliografiaEditor(
                        repo,
                        registroEditor,
                        guardando,
                        mensaje,
                        { editor = null },
                    ) { cambios ->
                        vm.guardar(
                            { repo.bibliografia(registroEditor?.id, r.id, cambios) },
                            { editor = null },
                        )
                    }
                else if (editor != null)
                    EditarExpediente(
                        editor!!,
                        registroEditor,
                        expediente,
                        materia,
                        guardando,
                        mensaje,
                        { editor = null },
                    ) { cambios ->
                        val tipoEditor = editor!!
                        vm.guardar(
                            accion = {
                                when (tipoEditor) {
                                    "generales" ->
                                        if (materia)
                                            repo.guardarAsignatura(r.id, cambios, revisionEditor)
                                        else repo.guardarPlan(r.id, cambios, revisionEditor)
                                    "campo" -> {
                                        val datos =
                                            JsonObject(
                                                Json.parseToJsonElement(datosEditor).jsonObject +
                                                    cambios
                                            )
                                        if (materia)
                                            repo.guardarAsignatura(
                                                r.id,
                                                objeto("datos" to datos),
                                                revisionEditor,
                                            )
                                        else
                                            repo.guardarPlan(
                                                r.id,
                                                objeto("datos" to datos),
                                                revisionEditor,
                                            )
                                    }
                                    "bloque" ->
                                        repo.guardarBloque(registroEditor?.id, r.id, cambios)
                                    "unidad",
                                    "evaluacion" ->
                                        repo.guardarAsignatura(r.id, cambios, revisionEditor)
                                    "comentario" ->
                                        repo.comentar(r.id, materia, cambios.texto("cuerpo"))
                                }
                            },
                            alCompletar = { editor = null },
                        )
                    }
            }
        }
    }
    eliminacion?.let { referencia ->
        AlertDialog(
            onDismissRequest = { if (!guardando) eliminacion = null },
            title = { Text("Eliminar referencia") },
            text = {
                Text(
                    "Se eliminará esta referencia de la bibliografía de la asignatura. Esta acción no puede deshacerse."
                )
            },
            confirmButton = {
                TextButton(
                    enabled = !guardando,
                    onClick = {
                        vm.guardar(
                            { repo.eliminarBibliografia(referencia.id) },
                            { eliminacion = null },
                        )
                    },
                ) {
                    Text("Eliminar", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(enabled = !guardando, onClick = { eliminacion = null }) {
                    Text("Volver")
                }
            },
        )
    }
}

fun renderValor(valor: JsonElement?): String =
    when (valor) {
        null,
        JsonNull -> "Sin registro"
        is JsonPrimitive -> valor.content
        is JsonArray -> valor.joinToString("\n") { renderValor(it) }
        is JsonObject ->
            valor.entries.joinToString("\n") {
                "${etiquetaCampo(it.key)}: ${renderValor(it.value)}"
            }
    }

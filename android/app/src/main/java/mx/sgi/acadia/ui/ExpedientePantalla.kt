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
                            )
                        else
                            listOf(
                                "planes_estudio",
                                "asignaturas",
                                "comentarios_plan",
                                "lineas_plan",
                            ),
                    )
                }
        )
    val estado by vm.estado.collectAsStateWithLifecycle()
    val guardando by vm.guardando.collectAsStateWithLifecycle()
    val mensaje by vm.mensaje.collectAsStateWithLifecycle()
    val vivo by vm.vivo.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var editor by rememberSaveable { mutableStateOf<String?>(null) }
    var registroEditorJson by rememberSaveable { mutableStateOf<String?>(null) }
    val registroEditor = registroEditorJson?.let { Json.parseToJsonElement(it).jsonObject }
    var revisionEditor by rememberSaveable { mutableStateOf<String?>(null) }
    var datosEditor by rememberSaveable { mutableStateOf("{}") }
    var eliminacion by remember { mutableStateOf<Registro?>(null) }
    val context = LocalContext.current
    val tabs =
        if (materia)
            listOf("Resumen", "Contenido", "Evaluación", "Bibliografía", "Revisión", "Historial")
        else listOf("Resumen", "Mapa curricular", "Bloques", "Revisión", "Historial")
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
        acciones = {
            AccionIcono("Actualizar", Icons.Outlined.Refresh, accion = vm::actualizar)
            if (estado.datos != null)
                AccionIcono("Compartir resumen", Icons.Outlined.Share) {
                    val data = estado.datos!!
                    val resumen = buildString {
                        appendLine(data.registro.nombre)
                        appendLine("Acad-IA · ${if(materia) "Asignatura" else "Plan de estudio"}")
                        data.asignaturas.forEach {
                            appendLine(
                                "Ciclo ${it.numero("numero_ciclo")} · ${it.nombre} · ${it.decimal("creditos")} créditos"
                            )
                        }
                        data.registro.objeto("datos").forEach { (k, v) ->
                            appendLine(
                                "${etiquetaCampo(k)}: ${textoPlano((v as? JsonPrimitive)?.contentOrNull ?: v.toString())}"
                            )
                        }
                    }
                    context.startActivity(
                        Intent.createChooser(
                            Intent(Intent.ACTION_SEND)
                                .setType("text/plain")
                                .putExtra(Intent.EXTRA_TEXT, resumen),
                            "Compartir resumen académico",
                        )
                    )
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
                            Tab(selected = tab == i, onClick = { tab = i }, text = { Text(titulo) })
                        }
                    }
                    LazyColumn(
                        Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(24.dp),
                        verticalArrangement = Arrangement.spacedBy(24.dp),
                    ) {
                        if (mensaje != null && editor == null)
                            item { Aviso(mensaje!!, mensaje != "Cambios guardados") }
                        if (!vivo)
                            item {
                                Aviso(
                                    "Actualización en vivo interrumpida. Usa Actualizar para ver los cambios recientes.",
                                    false,
                                )
                            }
                        if (guardando) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
                        if (tab == 0) {
                            item {
                                Encabezado(
                                    r.nombre,
                                    if (materia) r.texto("codigo").ifBlank { "Asignatura" }
                                    else r.objeto("carreras").texto("nivel"),
                                )
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
                            item {
                                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    if (expediente.editable)
                                        OutlinedButton(onClick = { editar("generales", r) }) {
                                            Icon(Icons.Outlined.Edit, null)
                                            Spacer(Modifier.width(8.dp))
                                            Text("Editar")
                                        }
                                    if (sesion.permite(Permiso.IA))
                                        FilledTonalButton(onClick = chat) {
                                            Icon(Icons.Outlined.AutoAwesome, null)
                                            Spacer(Modifier.width(8.dp))
                                            Text("Asistente IA")
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
                                        Text(titulo, style = MaterialTheme.typography.titleMedium)
                                        valor.forEach { (k, v) ->
                                            TextoAcademico(etiquetaCampo(k), renderValor(v))
                                        }
                                    }
                                    is JsonArray -> {
                                        Text(titulo, style = MaterialTheme.typography.titleMedium)
                                        valor.forEach {
                                            Text(
                                                renderValor(it),
                                                style = MaterialTheme.typography.bodyLarge,
                                            )
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
                        } else if (!materia && tab == 1) {
                            item {
                                Encabezado(
                                    "Progresión académica",
                                    "Mapa curricular",
                                    if (expediente.editable) {
                                        {
                                            AccionIcono("Añadir asignatura", Icons.Outlined.Add) {
                                                nuevaAsignatura(r.id)
                                            }
                                        }
                                    } else null,
                                )
                            }
                            val activas =
                                expediente.asignaturas.filter { it.texto("estado") != "archivada" }
                            if (activas.isEmpty())
                                item {
                                    Vacio(
                                        "Añade una asignatura",
                                        accion =
                                            if (expediente.editable) {
                                                {
                                                    Button({ nuevaAsignatura(r.id) }) {
                                                        Text("Nueva asignatura")
                                                    }
                                                }
                                            } else null,
                                    )
                                }
                            activas
                                .groupBy { it.numero("numero_ciclo") }
                                .toSortedMap()
                                .forEach { (ciclo, asignaturas) ->
                                    item {
                                        Row(
                                            Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                        ) {
                                            Text(
                                                "${r.texto("tipo_ciclo")} $ciclo",
                                                style = MaterialTheme.typography.titleLarge,
                                            )
                                            Text(
                                                "${asignaturas.sumOf{it.decimal("creditos")}} cr.",
                                                color = MaterialTheme.colorScheme.primary,
                                            )
                                        }
                                    }
                                    items(asignaturas, key = { it.id }) {
                                        FilaAsignatura(it) { abrirAsignatura(it.id) }
                                    }
                                }
                            val archivadas =
                                expediente.asignaturas.filter { it.texto("estado") == "archivada" }
                            if (archivadas.isNotEmpty()) {
                                item {
                                    Text("Archivadas", style = MaterialTheme.typography.titleLarge)
                                }
                                items(archivadas, key = { it.id }) {
                                    FilaAsignatura(it) { abrirAsignatura(it.id) }
                                }
                            }
                        } else if (!materia && tab == 2) {
                            item {
                                Encabezado(
                                    "Bloques formativos",
                                    accion =
                                        if (expediente.editable) {
                                            {
                                                AccionIcono("Nuevo bloque", Icons.Outlined.Add) {
                                                    editar("bloque")
                                                }
                                            }
                                        } else null,
                                )
                            }
                            if (expediente.bloques.isEmpty()) item { Vacio("Añade un bloque") }
                            items(expediente.bloques, key = { it.id }) { bloque ->
                                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    TextoAcademico(
                                        bloque.nombre,
                                        bloque.texto("proposito"),
                                        if (expediente.editable) {
                                            { editar("bloque", bloque) }
                                        } else null,
                                    )
                                    if (bloque.texto("aporte_perfil_egreso").isNotBlank())
                                        TextoAcademico(
                                            "Aporte al perfil de egreso",
                                            bloque.texto("aporte_perfil_egreso"),
                                        )
                                    expediente.asignaturas
                                        .filter { it.texto("linea_plan_id") == bloque.id }
                                        .forEach { FilaAsignatura(it) { abrirAsignatura(it.id) } }
                                }
                            }
                        } else if (materia && tab == 1) {
                            item {
                                Encabezado(
                                    "Contenido temático",
                                    accion =
                                        if (expediente.editable) {
                                            {
                                                AccionIcono("Añadir unidad", Icons.Outlined.Add) {
                                                    editar("unidad")
                                                }
                                            }
                                        } else null,
                                )
                            }
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
                            item {
                                Encabezado(
                                    "Criterios de evaluación",
                                    accion =
                                        if (expediente.editable) {
                                            {
                                                AccionIcono(
                                                    "Editar evaluación",
                                                    Icons.Outlined.Edit,
                                                ) {
                                                    editar("evaluacion")
                                                }
                                            }
                                        } else null,
                                )
                            }
                            val criterios = r.lista("criterios_de_evaluacion")
                            if (criterios.isEmpty()) item { Vacio("Define la evaluación") }
                            items(criterios) { criterio ->
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Row(
                                        Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                    ) {
                                        Text(criterio.nombre, Modifier.weight(1f))
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
                            item {
                                Encabezado(
                                    "Bibliografía",
                                    accion =
                                        if (expediente.editable) {
                                            {
                                                AccionIcono(
                                                    "Añadir referencia",
                                                    Icons.Outlined.Add,
                                                ) {
                                                    editar("bibliografia")
                                                }
                                            }
                                        } else null,
                                )
                            }
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
                                    Text(
                                        ref.texto("cita"),
                                        style = MaterialTheme.typography.bodyLarge,
                                    )
                                    ref.texto("referencia_en_linea")
                                        .takeIf {
                                            it.startsWith("https://") || it.startsWith("http://")
                                        }
                                        ?.let { url ->
                                            TextButton(
                                                onClick = {
                                                    context.startActivity(
                                                        Intent(Intent.ACTION_VIEW, url.toUri())
                                                    )
                                                }
                                            ) {
                                                Text("Consultar fuente")
                                                Icon(Icons.AutoMirrored.Outlined.OpenInNew, null)
                                            }
                                        }
                                    if (expediente.editable)
                                        Row {
                                            AccionIcono("Editar referencia", Icons.Outlined.Edit) {
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
                        } else if (tab == if (materia) 4 else 3) {
                            item { Encabezado("Revisión académica") }
                            if (expediente.transiciones.isNotEmpty())
                                item {
                                    OutlinedButton(onClick = { editar("transicion") }) {
                                        Text("Cambiar estado")
                                    }
                                }
                            if (sesion.permite(Permiso.Comentar))
                                item {
                                    Button(onClick = { editar("comentario") }) {
                                        Icon(Icons.Outlined.AddComment, null)
                                        Spacer(Modifier.width(8.dp))
                                        Text("Comentar")
                                    }
                                }
                            if (expediente.comentarios.isEmpty())
                                item { Vacio("Sin observaciones", Icons.Outlined.Forum) }
                            items(expediente.comentarios, key = { it.id }) { comentario ->
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text(
                                        comentario
                                            .objeto("autor")
                                            .texto("nombre_completo", "Comunidad académica"),
                                        style = MaterialTheme.typography.titleMedium,
                                    )
                                    Text(
                                        comentario.texto("cuerpo"),
                                        style = MaterialTheme.typography.bodyLarge,
                                    )
                                    Text(
                                        comentario.texto("creado_en").take(10),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                    if (comentario.booleano("resuelto")) EtiquetaEstado("Resuelto")
                                    if (expediente.editable)
                                        TextButton(
                                            onClick = {
                                                vm.guardar({
                                                    repo.resolverComentario(
                                                        comentario.id,
                                                        materia,
                                                        !comentario.booleano("resuelto"),
                                                    )
                                                })
                                            },
                                            enabled = !guardando,
                                        ) {
                                            Text(
                                                if (comentario.booleano("resuelto")) "Reabrir"
                                                else "Resolver"
                                            )
                                        }
                                    HorizontalDivider()
                                }
                            }
                        } else {
                            item { Encabezado("Trazabilidad", "Historial de cambios") }
                            if (expediente.historial.isEmpty())
                                item { Vacio("Sin cambios registrados", Icons.Outlined.History) }
                            items(expediente.historial, key = { it.id }) { cambio ->
                                var expandido by
                                    rememberSaveable(cambio.id) { mutableStateOf(false) }
                                Column(
                                    Modifier.fillMaxWidth().clickable { expandido = !expandido },
                                    verticalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    Text(
                                        etiquetaCampo(
                                            cambio.texto("campo").ifBlank { cambio.texto("tipo") }
                                        ),
                                        style = MaterialTheme.typography.titleMedium,
                                    )
                                    Text(
                                        "${cambio.objeto("usuarios_app").texto("nombre_completo","Sistema")} · ${cambio.texto("cambiado_en").take(16).replace('T',' ')}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                    if (expandido) {
                                        TextoAcademico(
                                            "Antes",
                                            renderValor(cambio["valor_anterior"]),
                                        )
                                        TextoAcademico(
                                            "Después",
                                            renderValor(cambio["valor_nuevo"]),
                                        )
                                    }
                                    HorizontalDivider()
                                }
                            }
                        }
                    }
                }
                if (editor != null)
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
                                    "bibliografia" ->
                                        repo.bibliografia(registroEditor?.id, r.id, cambios)
                                    "unidad",
                                    "evaluacion" ->
                                        repo.guardarAsignatura(r.id, cambios, revisionEditor)
                                    "comentario" ->
                                        repo.comentar(r.id, materia, cambios.texto("cuerpo"))
                                    "transicion" ->
                                        repo.cambiarEstado(
                                            r.id,
                                            materia,
                                            cambios.texto("estado"),
                                            cambios.texto("comentario"),
                                        )
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

package mx.sgi.acadia.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import mx.sgi.acadia.data.*

@Composable
fun CatalogoInstitucional(
    repo: RepositorioAcad,
    ruta: Catalogo,
    sesion: Sesion,
    atras: () -> Unit,
) {
    val permitido =
        ruta.tabla == "registros_oficiales_plan_detalle" || sesion.permite(Permiso.Catalogos)
    val vm: ContenidoViewModel<List<Registro>> =
        viewModel(
            factory =
                fabrica {
                    ContenidoViewModel(
                        {
                            if (!permitido)
                                throw FalloAcad(
                                    CategoriaError.Permiso,
                                    "Tu cuenta no tiene acceso a este catálogo.",
                                )
                            when (ruta.tabla) {
                                "registros_oficiales_plan_detalle" -> repo.registros()
                                "facultades" ->
                                    repo.filas(
                                        "facultades",
                                        orden = "nombre",
                                        columnas = "*,carreras(*)",
                                    )
                                "carreras" ->
                                    repo.filas(
                                        "carreras",
                                        orden = "nombre",
                                        columnas = "*,facultades(*)",
                                    )
                                else -> repo.catalogos(ruta.tabla)
                            }
                        },
                        repo,
                        when (ruta.tabla) {
                            "registros_oficiales_plan_detalle" -> listOf("registros_oficiales_plan")
                            "carreras",
                            "facultades" -> listOf("carreras", "facultades")
                            else -> listOf(ruta.tabla)
                        },
                    )
                }
        )
    val estado by vm.estado.collectAsStateWithLifecycle()
    var busqueda by rememberSaveable { mutableStateOf("") }
    Pagina(ruta.titulo, atras) { padding ->
        Column(Modifier.padding(padding)) {
            OutlinedTextField(
                busqueda,
                { busqueda = it },
                label = { Text("Buscar en el catálogo") },
                leadingIcon = { Icon(Icons.Outlined.Search, null) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 16.dp),
                singleLine = true,
            )
            Carga(estado, vm::actualizar) { rows ->
                val visibles = rows.filter {
                    normalizarBusqueda(it.toString()).contains(normalizarBusqueda(busqueda))
                }
                val fila: @Composable (Registro) -> Unit = { registro ->
                    if (ruta.tabla == "facultades") {
                        FacultadConCarreras(registro, busqueda)
                    } else if (ruta.tabla == "carreras") {
                        Text(registro.nombre, style = MaterialTheme.typography.bodyLarge)
                    } else {
                        var abierto by rememberSaveable(registro.id) { mutableStateOf(false) }
                        Column(
                            Modifier.fillMaxWidth().clickable { abierto = !abierto },
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                registro.nombre.ifBlank { registro.texto("plan_nombre") },
                                style = MaterialTheme.typography.titleLarge,
                            )
                            Text(
                                listOf(
                                        "nivel",
                                        "prefijo",
                                        "clave_sep",
                                        "numero_acuerdo",
                                        "estado_etiqueta",
                                        "tipo",
                                    )
                                    .map { registro.texto(it) }
                                    .filter { it.isNotBlank() }
                                    .joinToString(" · "),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            if (abierto)
                                registro
                                    .filterKeys {
                                        it in
                                            setOf(
                                                "descripcion",
                                                "fecha_aprobacion",
                                                "vigencia_inicio",
                                                "vigencia_fin",
                                                "autoridad",
                                                "observaciones",
                                                "version",
                                                "publicada",
                                                "activo",
                                            )
                                    }
                                    .forEach { (clave, valor) ->
                                        TextoAcademico(etiquetaCampo(clave), renderValor(valor))
                                    }
                            HorizontalDivider()
                        }
                    }
                }
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 24.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    if (visibles.isEmpty()) item { Vacio("Sin registros") }
                    if (ruta.tabla == "carreras") {
                        carrerasPorNivel(visibles).forEach { (nivel, carreras) ->
                            item(key = "nivel-$nivel") { EncabezadoNivelAcademico(nivel) }
                            items(carreras, key = { it.id }) { fila(it) }
                        }
                    } else items(visibles, key = { it.id }) { fila(it) }
                }
            }
        }
    }
}

@Composable
private fun FacultadConCarreras(facultad: Registro, busqueda: String) {
    var expandida by
        rememberSaveable(facultad.id, busqueda) { mutableStateOf(busqueda.isNotBlank()) }
    val filtro = normalizarBusqueda(busqueda)
    val carreras =
        facultad.lista("carreras").filter {
            filtro.isBlank() ||
                normalizarBusqueda(nombreFacultad(facultad)).contains(filtro) ||
                normalizarBusqueda(nombreCarrera(it)).contains(filtro)
        }
    Column {
        Row(
            Modifier.fillMaxWidth()
                .clickable(role = Role.Button) { expandida = !expandida }
                .semantics { stateDescription = if (expandida) "Expandida" else "Contraída" }
                .padding(vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            FacultadIdentidad(facultad, Modifier.weight(1f))
            Text(
                "${carreras.size} ${if (carreras.size == 1) "carrera" else "carreras"}",
                style = MaterialTheme.typography.labelMedium,
                modifier = Modifier.semantics { contentDescription = "${carreras.size} carreras" },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Icon(if (expandida) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore, null)
        }
        AnimatedVisibility(expandida) {
            Column(
                Modifier.padding(start = 16.dp, bottom = 20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                if (carreras.isEmpty())
                    Text("Sin carreras", color = MaterialTheme.colorScheme.onSurfaceVariant)
                carrerasPorNivel(carreras).forEach { (nivel, grupo) ->
                    EncabezadoNivelAcademico(nivel)
                    grupo.forEach { carrera ->
                        Text(
                            carrera.nombre,
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.padding(start = 8.dp),
                        )
                    }
                }
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .5f))
    }
}

@Composable
fun ConversacionesPantalla(
    repo: RepositorioAcad,
    ruta: Conversaciones,
    atras: () -> Unit,
    abrir: (String, Boolean) -> Unit,
) {
    val vm: ContenidoViewModel<List<Registro>> =
        viewModel(
            factory =
                fabrica {
                    ContenidoViewModel(
                        { repo.conversaciones(ruta.id, ruta.asignatura) },
                        repo,
                        listOf(
                            if (ruta.asignatura) "conversaciones_asignatura"
                            else "conversaciones_plan"
                        ),
                    )
                }
        )
    val estado by vm.estado.collectAsStateWithLifecycle()
    val ocupado by vm.guardando.collectAsStateWithLifecycle()
    val mensaje by vm.mensaje.collectAsStateWithLifecycle()
    Pagina(
        "Investigación con IA",
        atras,
        mensaje = mensaje,
        consumirMensaje = { vm.mensaje.value = null },
    ) { padding ->
        Box(Modifier.padding(padding)) {
            Carga(estado, vm::actualizar) { rows ->
                LazyColumn(
                    contentPadding = PaddingValues(24.dp),
                    verticalArrangement = Arrangement.spacedBy(24.dp),
                ) {
                    item {
                        Button(
                            enabled = !ocupado,
                            onClick = {
                                var id = ""
                                vm.guardar(
                                    {
                                        id =
                                            repo
                                                .crearConversacion(ruta.id, ruta.asignatura)
                                                .objeto(
                                                    if (ruta.asignatura) "conversation_asignatura"
                                                    else "conversation_plan"
                                                )
                                                .id
                                        check(id.isNotBlank()) {
                                            "El servidor no devolvió una conversación."
                                        }
                                    },
                                    { abrir(id, ruta.asignatura) },
                                )
                            },
                        ) {
                            if (ocupado)
                                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                            else Icon(Icons.Outlined.Add, null)
                            Spacer(Modifier.width(8.dp))
                            Text("Nueva conversación")
                        }
                    }
                    if (rows.isEmpty())
                        item { Vacio("Inicia una conversación", Icons.Outlined.AutoAwesome) }
                    items(rows, key = { it.id }) { row ->
                        ListItem(
                            headlineContent = {
                                Text(row.nombre.ifBlank { "Conversación académica" })
                            },
                            supportingContent = {
                                Text("${row.texto("creado_en").take(10)} · ${row.texto("estado")}")
                            },
                            leadingContent = { Icon(Icons.Outlined.Forum, null) },
                            modifier = Modifier.clickable { abrir(row.id, ruta.asignatura) },
                            colors =
                                ListItemDefaults.colors(
                                    containerColor = MaterialTheme.colorScheme.background
                                ),
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ConversacionPantalla(repo: RepositorioAcad, ruta: Conversacion, atras: () -> Unit) {
    val vm: ContenidoViewModel<List<Registro>> =
        viewModel(
            factory =
                fabrica {
                    ContenidoViewModel(
                        { repo.mensajes(ruta.id, ruta.asignatura) },
                        repo,
                        listOf(
                            if (ruta.asignatura) "asignatura_mensajes_ia" else "plan_mensajes_ia"
                        ),
                    )
                }
        )
    val estado by vm.estado.collectAsStateWithLifecycle()
    val ocupado by vm.guardando.collectAsStateWithLifecycle()
    val mensaje by vm.mensaje.collectAsStateWithLifecycle()
    var texto by rememberSaveable { mutableStateOf("") }
    var confirmar by remember { mutableStateOf(false) }
    val scroll = rememberLazyListState()
    Pagina(
        "Asistente académico",
        atras,
        mensaje = mensaje,
        consumirMensaje = { vm.mensaje.value = null },
    ) { padding ->
        Column(Modifier.padding(padding).imePadding()) {
            Box(Modifier.weight(1f)) {
                Carga(estado, vm::actualizar) { rows ->
                    LazyColumn(
                        state = scroll,
                        contentPadding = PaddingValues(24.dp),
                        verticalArrangement = Arrangement.spacedBy(24.dp),
                    ) {
                        if (rows.isEmpty())
                            item { Vacio("Escribe tu consulta", Icons.Outlined.AutoAwesome) }
                        items(rows, key = { it.id }) { row ->
                            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                Text(
                                    "TÚ",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                                Text(
                                    row.texto("mensaje"),
                                    style = MaterialTheme.typography.bodyLarge,
                                )
                                Text(
                                    "ACAD-IA",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.secondary,
                                )
                                if (row.texto("respuesta").isNotBlank())
                                    Text(
                                        row.texto("respuesta"),
                                        style = MaterialTheme.typography.bodyLarge,
                                    )
                                else EtiquetaEstado(row.texto("estado", "Pendiente"))
                                if (row.objeto("propuesta").isNotEmpty())
                                    Aviso(
                                        "Hay una propuesta estructurada. Revísala y aplícala desde la versión web; Android no la aplica automáticamente.",
                                        false,
                                    )
                                HorizontalDivider()
                            }
                        }
                    }
                }
            }
            Row(
                Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    texto,
                    { texto = it },
                    label = { Text("Consulta académica") },
                    modifier = Modifier.weight(1f),
                    maxLines = 5,
                    enabled = !ocupado,
                )
                AccionIcono(
                    "Enviar consulta",
                    Icons.AutoMirrored.Outlined.Send,
                    !ocupado && texto.isNotBlank(),
                ) {
                    confirmar = true
                }
            }
            if (ocupado) LinearProgressIndicator(Modifier.fillMaxWidth())
        }
    }
    if (confirmar)
        AlertDialog(
            onDismissRequest = { confirmar = false },
            title = { Text("Enviar consulta a IA") },
            text = {
                Text(
                    "El servidor enviará tu consulta y el contexto académico al proveedor de IA configurado. Puede generar consumo del servicio."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmar = false
                        vm.guardar(
                            { repo.enviarMensaje(ruta.id, ruta.asignatura, texto) },
                            { texto = "" },
                        )
                    }
                ) {
                    Text("Enviar")
                }
            },
            dismissButton = { TextButton(onClick = { confirmar = false }) { Text("Volver") } },
        )
}

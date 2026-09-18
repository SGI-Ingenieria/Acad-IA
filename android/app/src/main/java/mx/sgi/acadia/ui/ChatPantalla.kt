@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package mx.sgi.acadia.ui

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.mohamedrejeb.richeditor.model.RichTextState
import kotlinx.coroutines.delay
import kotlinx.serialization.json.*
import mx.sgi.acadia.data.*

@Composable
fun AsistentePantalla(
    repo: RepositorioAcad,
    entidadId: String,
    asignatura: Boolean,
    conversacionId: String? = null,
    atras: () -> Unit,
) {
    val vm: ChatViewModel =
        viewModel(
            factory =
                viewModelFactory {
                    initializer {
                        ChatViewModel(
                            repo,
                            entidadId,
                            asignatura,
                            conversacionId,
                            createSavedStateHandle(),
                        )
                    }
                }
        )
    val estado by vm.estado.collectAsStateWithLifecycle()
    val texto by vm.texto.collectAsStateWithLifecycle()
    val aviso by vm.aviso.collectAsStateWithLifecycle()
    var recientes by rememberSaveable { mutableStateOf(false) }
    var propuestaId by rememberSaveable { mutableStateOf<String?>(null) }
    var revisionPropuesta by rememberSaveable { mutableStateOf("") }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { vm.actualizar() }
    LaunchedEffect(estado.mensajes) {
        val ahora = System.currentTimeMillis()
        val proximo =
            estado.mensajes
                .mapNotNull(::vencimientoChatSinPublicar)
                .filter { it > ahora }
                .minOrNull()
        if (proximo != null) {
            delay(proximo - ahora)
            vm.actualizar()
        }
    }
    val dictado =
        rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            resultado ->
            if (resultado.resultCode == Activity.RESULT_OK) {
                val transcripcion =
                    resultado.data
                        ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                        ?.firstOrNull()
                        .orEmpty()
                if (transcripcion.isNotBlank())
                    vm.escribir(
                        listOf(texto, transcripcion).filter(String::isNotBlank).joinToString(" ")
                    )
            }
        }
    Pagina(
        "Asistente IA",
        atras,
        acciones = {
            if (estado.conversacionId != null)
                AccionIcono("Nuevo chat", Icons.Outlined.Add, !estado.ocupado) { vm.abrir(null) }
            AccionIcono("Chats recientes", Icons.Outlined.History, !estado.ocupado) {
                recientes = true
            }
        },
        mensaje = aviso,
        consumirMensaje = { vm.aviso.value = null },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).imePadding()) {
            ConversacionContenido(
                estado,
                Modifier.weight(1f),
                abrirPropuesta = {
                    propuestaId = it
                    revisionPropuesta =
                        estado.expediente?.registro?.texto("actualizado_en").orEmpty()
                },
                reintentar = vm::enviar,
                volverCargar = vm::actualizar,
            )
            if (estado.archivada) {
                Row(
                    Modifier.fillMaxWidth().padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.Archive, null)
                    Text("Chat archivado", Modifier.weight(1f).padding(horizontal = 12.dp))
                    TextButton(
                        onClick = { estado.conversacionId?.let { vm.archivar(it, false) } },
                        enabled = !estado.ocupado,
                    ) {
                        Text("Restaurar")
                    }
                }
            } else
                CompositorChat(
                    texto,
                    vm::escribir,
                    estado.ocupado || estado.generando || estado.comprobandoConversacion,
                    enviar = { vm.enviar() },
                    dictar = {
                        try {
                            dictado.launch(
                                Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                                    putExtra(
                                        RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                                        RecognizerIntent.LANGUAGE_MODEL_FREE_FORM,
                                    )
                                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-MX")
                                    putExtra(RecognizerIntent.EXTRA_PROMPT, "Dictar consulta")
                                }
                            )
                        } catch (_: ActivityNotFoundException) {
                            vm.aviso.value =
                                "El dictado no está disponible en este teléfono. Puedes escribir tu consulta."
                        }
                    },
                )
        }
    }
    if (recientes)
        ChatsRecientesSheet(
            estado,
            cerrar = { recientes = false },
            abrir = {
                vm.abrir(it)
                recientes = false
            },
            archivar = vm::archivar,
        )
    val mensajePropuesta = estado.mensajes.firstOrNull { it.id == propuestaId }
    val aplicadas = mensajePropuesta?.let {
        recomendacionesChat(it).count(RecomendacionChat::aplicada)
    }
    LaunchedEffect(propuestaId, aplicadas) {
        // After an accepted field, the next review uses that saved revision. An unrelated
        // background edit does not change this snapshot and is still rejected by compare-and-set.
        if (mensajePropuesta != null && !estado.ocupado)
            revisionPropuesta = estado.expediente?.registro?.texto("actualizado_en").orEmpty()
    }
    if (mensajePropuesta != null)
        RecomendacionesChatSheet(
            mensajePropuesta,
            estado.expediente,
            estado.ocupado,
            estado.archivada,
            aviso,
            cerrar = { propuestaId = null },
            aplicar = { vm.aplicar(mensajePropuesta.id, it, revisionPropuesta) },
        )
}

@Composable
fun CompositorChat(
    texto: String,
    escribir: (String) -> Unit,
    ocupado: Boolean,
    enviar: () -> Unit,
    dictar: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        OutlinedTextField(
            texto,
            escribir,
            placeholder = { Text("Escribe tu consulta") },
            minLines = 1,
            maxLines = 5,
            shape = MaterialTheme.shapes.extraLarge,
            trailingIcon = { AccionIcono("Dictar consulta", Icons.Outlined.Mic, !ocupado, dictar) },
            modifier =
                Modifier.weight(1f).semantics { contentDescription = "Consulta al asistente" },
        )
        FilledIconButton(
            onClick = enviar,
            enabled = texto.isNotBlank() && !ocupado,
            modifier = Modifier.size(56.dp),
        ) {
            if (ocupado) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
            else Icon(Icons.AutoMirrored.Outlined.Send, "Enviar consulta")
        }
    }
}

@Composable
fun ConversacionContenido(
    estado: EstadoChat,
    modifier: Modifier = Modifier,
    abrirPropuesta: (String) -> Unit = {},
    reintentar: (Registro) -> Unit = {},
    volverCargar: () -> Unit = {},
) {
    val lista = rememberLazyListState()
    val cola = estado.mensajes.lastOrNull()
    LaunchedEffect(
        estado.conversacionId,
        estado.mensajes.size,
        cola?.texto("estado"),
        estado.consultaPendiente,
    ) {
        if (lista.layoutInfo.totalItemsCount > 0)
            lista.animateScrollToItem(lista.layoutInfo.totalItemsCount - 1)
    }
    Box(modifier.fillMaxWidth()) {
        if (
            estado.mensajes.isEmpty() &&
                estado.consultaPendiente == null &&
                !estado.cargando &&
                estado.error == null
        ) {
            Column(
                Modifier.align(Alignment.Center).padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Icon(
                    Icons.Outlined.AutoAwesome,
                    null,
                    Modifier.size(40.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
                Text("¿Qué quieres trabajar?", style = MaterialTheme.typography.headlineSmall)
                estado.expediente?.registro?.nombre?.takeIf(String::isNotBlank)?.let {
                    Text(
                        it,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        LazyColumn(
            state = lista,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(20.dp),
            verticalArrangement = Arrangement.spacedBy(28.dp),
        ) {
            items(estado.mensajes, key = { it.id }) { mensaje ->
                Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                    BurbujaConsulta(mensaje.texto("mensaje"))
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                Icons.Outlined.AutoAwesome,
                                null,
                                Modifier.size(18.dp),
                                tint = MaterialTheme.colorScheme.primary,
                            )
                            Text("Acad-IA", style = MaterialTheme.typography.labelMedium)
                        }
                        val procesando = chatEnProceso(mensaje)
                        if (procesando)
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                                Text(
                                    "Preparando respuesta…",
                                    modifier =
                                        Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        else {
                            if (chatSinPublicarCaducado(mensaje))
                                Text(
                                    "La solicitud no llegó a iniciar la generación. Puedes volver a intentarlo."
                                )
                            else
                                mensaje.texto("respuesta").takeIf(String::isNotBlank)?.let {
                                    TextoRespuestaChat(it)
                                }
                            if (
                                chatSinPublicarCaducado(mensaje) ||
                                    mensaje.texto("estado") in
                                        setOf("ERROR", "CANCELADO", "FALLIDO")
                            ) {
                                TextButton(
                                    enabled =
                                        !estado.ocupado && !estado.generando && !estado.archivada,
                                    onClick = { reintentar(mensaje) },
                                ) {
                                    Icon(Icons.Outlined.Replay, null, Modifier.size(18.dp))
                                    Spacer(Modifier.width(8.dp))
                                    Text("Reintentar consulta")
                                }
                            }
                        }
                        val propuestas = recomendacionesChat(mensaje)
                        if (propuestas.isNotEmpty())
                            Surface(
                                onClick = { abrirPropuesta(mensaje.id) },
                                color = MaterialTheme.colorScheme.surfaceContainer,
                                shape = MaterialTheme.shapes.large,
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Row(
                                    Modifier.padding(16.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                                ) {
                                    Icon(Icons.Outlined.AutoAwesome, null)
                                    Column(Modifier.weight(1f)) {
                                        Text(
                                            "Ver recomendación de IA",
                                            style = MaterialTheme.typography.titleSmall,
                                        )
                                        Text(
                                            if (propuestas.all { it.aplicada }) "Aplicada"
                                            else
                                                "${propuestas.size} ${if (propuestas.size == 1) "elemento para revisar" else "elementos para revisar"}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                    Icon(Icons.Outlined.ChevronRight, null)
                                }
                            }
                    }
                }
            }
            estado.consultaPendiente?.let { consulta ->
                item(key = "envio-pendiente") {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        BurbujaConsulta(consulta)
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                            Text("Enviando…", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
            estado.error?.let { error ->
                item(key = "error-chat") {
                    Column {
                        Text(error, color = MaterialTheme.colorScheme.error)
                        TextButton(onClick = volverCargar) { Text("Reintentar conexión") }
                    }
                }
            }
        }
        if (estado.cargando)
            LinearProgressIndicator(Modifier.fillMaxWidth().align(Alignment.TopCenter))
    }
}

@Composable
private fun BurbujaConsulta(texto: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
        Surface(
            color = MaterialTheme.colorScheme.primaryContainer,
            shape = MaterialTheme.shapes.large,
            modifier = Modifier.widthIn(max = 340.dp),
        ) {
            SelectionContainer {
                Text(
                    texto,
                    Modifier.padding(16.dp),
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
        }
    }
}

@Composable
private fun TextoRespuestaChat(texto: String) {
    val html =
        remember(texto) {
            if (Regex("</?(p|ul|ol|li|strong|em|h[1-6])(?:>|\\s)").containsMatchIn(texto)) texto
            else RichTextState().setMarkdown(texto).toHtml()
        }
    ContenidoEnriquecido(html)
}

@Composable
private fun ChatsRecientesSheet(
    estado: EstadoChat,
    cerrar: () -> Unit,
    abrir: (String?) -> Unit,
    archivar: (String, Boolean) -> Unit,
) {
    var archivados by rememberSaveable { mutableStateOf(false) }
    ModalBottomSheet(
        onDismissRequest = cerrar,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Chats recientes",
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.weight(1f),
                )
                AccionIcono("Cerrar chats recientes", Icons.Outlined.Close, accion = cerrar)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = !archivados,
                    onClick = { archivados = false },
                    label = { Text("Activos") },
                )
                FilterChip(
                    selected = archivados,
                    onClick = { archivados = true },
                    label = { Text("Archivados") },
                )
                Spacer(Modifier.weight(1f))
                AccionIcono("Nuevo chat", Icons.Outlined.Add, !estado.ocupado) { abrir(null) }
            }
            val visibles =
                estado.recientes.filter { (it.texto("estado") == "ARCHIVADA") == archivados }
            LazyColumn(
                Modifier.fillMaxWidth().heightIn(max = 540.dp),
                contentPadding = PaddingValues(bottom = 24.dp),
            ) {
                if (visibles.isEmpty())
                    item {
                        Vacio(
                            if (archivados) "Sin chats archivados" else "Sin chats recientes",
                            Icons.Outlined.Forum,
                        )
                    }
                items(visibles, key = { it.id }) { chat ->
                    ListItem(
                        headlineContent = {
                            Text(
                                chat.nombre.ifBlank { "Consulta académica" },
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                        },
                        supportingContent = {
                            Text(
                                fechaAcademica(chat.texto("creado_en")),
                                style = MaterialTheme.typography.bodySmall,
                            )
                        },
                        leadingContent = {
                            Icon(
                                if (chat.id == estado.conversacionId) Icons.Outlined.ChatBubble
                                else Icons.Outlined.ChatBubbleOutline,
                                null,
                            )
                        },
                        trailingContent = {
                            AccionIcono(
                                if (archivados) "Restaurar chat" else "Archivar chat",
                                if (archivados) Icons.Outlined.Unarchive
                                else Icons.Outlined.Archive,
                                !estado.ocupado,
                            ) {
                                archivar(chat.id, !archivados)
                            }
                        },
                        modifier = Modifier.clickable(enabled = !estado.ocupado) { abrir(chat.id) },
                        colors =
                            ListItemDefaults.colors(
                                containerColor = MaterialTheme.colorScheme.surfaceContainerLow
                            ),
                    )
                }
            }
        }
    }
}

@Composable
private fun RecomendacionesChatSheet(
    mensaje: Registro,
    expediente: Expediente?,
    ocupado: Boolean,
    archivada: Boolean,
    aviso: String?,
    cerrar: () -> Unit,
    aplicar: (RecomendacionChat) -> Unit,
) {
    val recomendaciones = recomendacionesChat(mensaje)
    var confirmacion by remember { mutableStateOf<RecomendacionChat?>(null) }
    ModalBottomSheet(
        onDismissRequest = cerrar,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    ) {
        LazyColumn(
            Modifier.fillMaxWidth().fillMaxHeight(.9f),
            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Recomendación de IA",
                        Modifier.weight(1f),
                        style = MaterialTheme.typography.titleLarge,
                    )
                    AccionIcono("Cerrar recomendación", Icons.Outlined.Close, accion = cerrar)
                }
                aviso?.let {
                    Text(
                        it,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    )
                }
            }
            items(recomendaciones, key = { it.clave }) { recomendacion ->
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(recomendacion.titulo, style = MaterialTheme.typography.titleMedium)
                    if (recomendacion.tipo == "campo") {
                        val propuesta = recomendacion.datos
                        propuesta.texto("explicacion").takeIf(String::isNotBlank)?.let {
                            Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        val valor = valorPropuestoChat(propuesta["texto_mejora"])
                        if (valor is JsonPrimitive) TextoRespuestaChat(valor.content)
                        else ContenidoPropuestoChat(valor)
                    } else if (recomendacion.tipo == "bibliografia") {
                        Text(
                            if (recomendacion.datos.texto("referencia_biblioteca").isNotBlank())
                                "Biblioteca institucional"
                            else "En línea",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Text(recomendacion.datos.texto("cita"))
                    } else
                        ContenidoPropuestoChat(
                            JsonObject(
                                recomendacion.datos.filterKeys { it !in setOf("tipo", "aplicada") }
                            )
                        )
                    when {
                        recomendacion.aplicada ->
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Outlined.CheckCircle, null)
                                Text("Aplicada")
                            }
                        expediente?.editable != true || archivada ->
                            Text(
                                "Sólo consulta",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        else ->
                            Button(onClick = { confirmacion = recomendacion }, enabled = !ocupado) {
                                if (ocupado)
                                    CircularProgressIndicator(
                                        Modifier.size(18.dp),
                                        strokeWidth = 2.dp,
                                    )
                                else Icon(Icons.Outlined.Check, null, Modifier.size(18.dp))
                                Spacer(Modifier.width(8.dp))
                                Text("Aceptar recomendación")
                            }
                    }
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                }
            }
            item {
                TextButton(
                    onClick = cerrar,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !ocupado,
                ) {
                    Text("Cerrar sin aplicar más")
                }
            }
        }
        confirmacion?.let { propuesta ->
            AlertDialog(
                onDismissRequest = { confirmacion = null },
                icon = { Icon(Icons.Outlined.AutoAwesome, null) },
                title = { Text("¿Aplicar esta recomendación?") },
                text = {
                    Text(
                        when (propuesta.tipo) {
                            "eliminar_linea" ->
                                "Se eliminará el bloque y sus asignaturas quedarán sin bloque. Esta acción no se puede deshacer."
                            "asignatura" ->
                                "Se creará la asignatura y se generará su contenido con IA. Esto puede generar consumo del servicio."
                            else ->
                                "${propuesta.titulo}. Se actualizará el expediente con el contenido que revisaste."
                        }
                    )
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            confirmacion = null
                            aplicar(propuesta)
                        }
                    ) {
                        Text("Aplicar")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { confirmacion = null }) { Text("Seguir revisando") }
                },
            )
        }
    }
}

@Composable
private fun ContenidoPropuestoChat(valor: JsonElement?, nivel: Int = 0) {
    when (valor) {
        is JsonArray ->
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                valor.forEach { ContenidoPropuestoChat(it, nivel) }
            }
        is JsonObject ->
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                valor
                    .filterKeys { it != "id" && !it.endsWith("_id") }
                    .forEach { (clave, contenido) ->
                        if (contenido != JsonNull) {
                            Text(
                                etiquetaCampo(clave),
                                style =
                                    if (nivel == 0) MaterialTheme.typography.labelLarge
                                    else MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            ContenidoPropuestoChat(contenido, nivel + 1)
                        }
                    }
            }
        is JsonPrimitive -> TextoRespuestaChat(valor.content)
        else -> Unit
    }
}

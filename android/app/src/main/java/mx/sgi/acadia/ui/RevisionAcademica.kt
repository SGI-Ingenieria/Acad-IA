@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package mx.sgi.acadia.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.automirrored.outlined.Undo
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import androidx.core.graphics.toColorInt
import mx.sgi.acadia.data.*

/** A review is an action and a conversation, not a second document header. */
@Composable
fun RevisionAcademica(
    expediente: Expediente,
    asignatura: Boolean,
    sesion: Sesion,
    guardando: Boolean,
    error: String?,
    comentar: () -> Unit,
    resolver: (Registro, Boolean) -> Unit,
    transicionar: (String, String, () -> Unit) -> Unit,
    mostrarAccionComentario: Boolean = true,
) {
    var filtro by rememberSaveable(expediente.registro.id) { mutableStateOf("pendientes") }
    var destino by rememberSaveable(expediente.registro.id) { mutableStateOf<String?>(null) }
    var otras by remember { mutableStateOf(false) }
    val acciones = accionesRevision(expediente, asignatura)
    val seleccionada = acciones.firstOrNull { it.destinoId == destino }
    val comentarios =
        expediente.comentarios
            .filter {
                filtro == "todos" || it.booleano("resuelto") == (filtro == "resueltos")
            }
            .sortedByDescending { it.texto("creado_en") }
    val pendientes = expediente.comentarios.count { !it.booleano("resuelto") }
    val resueltos = expediente.comentarios.size - pendientes
    val estado = expediente.registro.objeto("estados_plan")
    val nombreEstado =
        if (asignatura) etiquetaEstadoRevision(expediente.registro.texto("estado"))
        else estado.texto("etiqueta", "Borrador")
    val colorEstado = runCatching {
        Color(estado.texto("color").toColorInt())
    }
        .getOrDefault(MaterialTheme.colorScheme.primary)

    Box(Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding =
                PaddingValues(start = 24.dp, end = 24.dp, top = 20.dp, bottom = 100.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            item(key = "estado") {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Surface(
                        color = colorEstado,
                        shape = CircleShape,
                        modifier = Modifier.size(8.dp),
                    ) {}
                    Text(
                        nombreEstado,
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f),
                    )
                    if (acciones.size > 1)
                        Box {
                            AccionIcono(
                                "Otras acciones de revisión",
                                Icons.Outlined.MoreHoriz,
                                !guardando,
                            ) {
                                otras = true
                            }
                            DropdownMenu(expanded = otras, onDismissRequest = { otras = false }) {
                                acciones.drop(1).forEach { accion ->
                                    DropdownMenuItem(
                                        text = { Text(accion.etiqueta) },
                                        leadingIcon = { Icon(iconoRevision(accion.tipo), null) },
                                        onClick = {
                                            otras = false
                                            destino = accion.destinoId
                                        },
                                    )
                                }
                            }
                        }
                }
            }
            acciones.firstOrNull()?.let { accion ->
                item(key = "accion-principal") {
                    Button(
                        onClick = { destino = accion.destinoId },
                        enabled = !guardando,
                        modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
                    ) {
                        Icon(iconoRevision(accion.tipo), null)
                        Spacer(Modifier.width(12.dp))
                        Text(accion.etiqueta, modifier = Modifier.weight(1f))
                    }
                }
            }
            item(key = "filtros") {
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    listOf(
                            "pendientes" to "Pendientes · $pendientes",
                            "resueltos" to "Resueltos · $resueltos",
                            "todos" to "Todos",
                        )
                        .forEach { (clave, nombre) ->
                            FilterChip(
                                selected = filtro == clave,
                                onClick = { filtro = clave },
                                label = { Text(nombre) },
                            )
                        }
                }
            }
            if (comentarios.isEmpty())
                item(key = "vacio") {
                    Vacio(
                        if (filtro == "resueltos") "Sin observaciones resueltas"
                        else if (pendientes == 0 && resueltos > 0) "Todo revisado"
                        else "Sin observaciones",
                        Icons.Outlined.Forum,
                    )
                }
            items(comentarios, key = { it.id }) { comentario ->
                ComentarioAcademico(
                    comentario = comentario,
                    respuestaA =
                        expediente.comentarios.firstOrNull {
                            it.id == comentario.texto("comentario_padre_id")
                        },
                    puedeResolver =
                        sesion.id == comentario.texto("autor_id") || "ADMIN" in sesion.roles,
                    guardando = guardando,
                    resolver = { resolver(comentario, !comentario.booleano("resuelto")) },
                )
            }
        }
        if (mostrarAccionComentario && sesion.permite(Permiso.Comentar)) {
            FilledIconButton(
                onClick = comentar,
                enabled = !guardando,
                shape = CircleShape,
                modifier = Modifier.align(Alignment.BottomEnd).padding(24.dp).size(56.dp),
            ) {
                Icon(Icons.Outlined.Edit, "Escribir comentario")
            }
        }
    }
    if (seleccionada != null) {
        DialogoAccionRevision(
            accion = seleccionada,
            asignatura = asignatura,
            guardando = guardando,
            error = error,
            cerrar = { destino = null },
            confirmar = { comentario ->
                transicionar(seleccionada.destinoId, comentario) { destino = null }
            },
        )
    }
}

@Composable
private fun ComentarioAcademico(
    comentario: Registro,
    respuestaA: Registro?,
    puedeResolver: Boolean,
    guardando: Boolean,
    resolver: () -> Unit,
) {
    val autor = comentario.objeto("autor").texto("nombre_completo", "Comunidad académica")
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            AvatarAcademico(autor, 32)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(autor, style = MaterialTheme.typography.titleSmall)
                Text(
                    fechaAcademica(comentario.texto("creado_en")),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (puedeResolver)
                AccionIcono(
                    if (comentario.booleano("resuelto")) "Reabrir observación"
                    else "Marcar como resuelta",
                    if (comentario.booleano("resuelto")) Icons.Outlined.CheckCircle
                    else Icons.Outlined.Check,
                    !guardando,
                    resolver,
                )
            else if (comentario.booleano("resuelto"))
                Icon(
                    Icons.Outlined.CheckCircle,
                    "Observación resuelta",
                    tint = MaterialTheme.colorScheme.primary,
                )
        }
        Column(Modifier.padding(start = 44.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (respuestaA != null)
                Text(
                    "En respuesta a ${respuestaA.objeto("autor").texto("nombre_completo", "Comunidad académica")}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            ContenidoEnriquecido(comentario.texto("cuerpo"))
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .55f))
    }
}

@Composable
internal fun AvatarAcademico(nombre: String, tamano: Int = 40) {
    Surface(
        shape = CircleShape,
        color = MaterialTheme.colorScheme.secondaryContainer,
        modifier = Modifier.size(tamano.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                inicialesAutor(nombre),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSecondaryContainer,
                modifier = Modifier.clearAndSetSemantics {},
            )
        }
    }
}

private fun iconoRevision(tipo: TipoAccionRevision): ImageVector =
    when (tipo) {
        TipoAccionRevision.Enviar -> Icons.AutoMirrored.Outlined.Send
        TipoAccionRevision.Aprobar -> Icons.Outlined.Verified
        TipoAccionRevision.Devolver -> Icons.AutoMirrored.Outlined.Undo
        TipoAccionRevision.Rechazar -> Icons.Outlined.Block
    }

@Composable
private fun DialogoAccionRevision(
    accion: AccionRevision,
    asignatura: Boolean,
    guardando: Boolean,
    error: String?,
    cerrar: () -> Unit,
    confirmar: (String) -> Unit,
) {
    var comentario by rememberSaveable(accion.destinoId) { mutableStateOf("") }
    var intento by rememberSaveable(accion.destinoId) { mutableStateOf(false) }
    var descartar by rememberSaveable { mutableStateOf(false) }
    val solicitarCierre = {
        if (!guardando) {
            if (comentario.isNotBlank()) descartar = true else cerrar()
        }
    }
    val sheetState =
        rememberModalBottomSheetState(
            skipPartiallyExpanded = true,
            confirmValueChange = {
                when {
                    it != SheetValue.Hidden -> true
                    guardando -> false
                    comentario.isNotBlank() -> {
                        descartar = true
                        false
                    }
                    else -> true
                }
            },
        )
    ModalBottomSheet(
        onDismissRequest = solicitarCierre,
        sheetState = sheetState,
        modifier = Modifier.semantics { paneTitle = accion.etiqueta },
    ) {
        BackHandler(enabled = guardando || comentario.isNotBlank()) { solicitarCierre() }
        Column(
            Modifier.fillMaxWidth()
                .imePadding()
                .padding(horizontal = 24.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(verticalAlignment = Alignment.Top) {
                Text(
                    accion.etiqueta,
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.weight(1f).semantics { heading() },
                )
                AccionIcono("Cerrar", Icons.Outlined.Close, !guardando, solicitarCierre)
            }
            if (accion.requiereRegistroOficial) {
                Aviso(
                    "La aprobación curricular requiere el dictamen y el documento oficial SEP. Completa este registro en la versión web.",
                    error = false,
                )
            } else {
                if (asignatura && accion.tipo == TipoAccionRevision.Enviar)
                    Text(
                        "La asignatura quedará en revisión. No podrás editarla hasta que sea devuelta para cambios.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                OutlinedTextField(
                    value = comentario,
                    onValueChange = { if (it.length <= 5000) comentario = it },
                    enabled = !guardando,
                    label = {
                        Text(
                            if (accion.requiereComentario) "Motivo"
                            else "¿Quieres agregar un comentario?"
                        )
                    },
                    placeholder = {
                        Text(
                            if (accion.requiereComentario) "Describe los cambios solicitados"
                            else "Comentario opcional"
                        )
                    },
                    minLines = 3,
                    maxLines = 8,
                    supportingText = {
                        Text(
                            if (accion.requiereComentario) "Obligatorio · ${comentario.length}/5000"
                            else "Opcional · ${comentario.length}/5000"
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
                if (intento && error != null) Aviso(error)
                Button(
                    onClick = {
                        intento = true
                        confirmar(comentario.trim())
                    },
                    enabled = !guardando && (!accion.requiereComentario || comentario.isNotBlank()),
                    modifier = Modifier.fillMaxWidth().testTag("confirmar-revision"),
                    contentPadding = PaddingValues(16.dp),
                    colors =
                        if (accion.tipo == TipoAccionRevision.Rechazar)
                            ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.error,
                                contentColor = MaterialTheme.colorScheme.onError,
                            )
                        else ButtonDefaults.buttonColors(),
                ) {
                    if (guardando)
                        CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                    else Icon(iconoRevision(accion.tipo), null)
                    Spacer(Modifier.width(12.dp))
                    Text(
                        if (guardando) "Enviando…" else accion.etiqueta,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
    if (descartar)
        AlertDialog(
            onDismissRequest = { descartar = false },
            title = { Text("¿Descartar el comentario?") },
            text = { Text("El comentario todavía no se ha enviado.") },
            confirmButton = { TextButton(onClick = cerrar) { Text("Descartar") } },
            dismissButton = {
                TextButton(onClick = { descartar = false }) { Text("Seguir escribiendo") }
            },
        )
}

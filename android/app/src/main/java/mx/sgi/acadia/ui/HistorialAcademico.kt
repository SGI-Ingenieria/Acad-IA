@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package mx.sgi.acadia.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import mx.sgi.acadia.data.*

/** Read-only audit trail. Resolving an observation must never erase a historical change. */
@Composable
fun HistorialAcademico(expediente: Expediente, cerrar: () -> Unit) {
    var busqueda by rememberSaveable(expediente.registro.id) { mutableStateOf("") }
    val filtro = normalizarBusqueda(busqueda)
    val cambios =
        expediente.historial
            .sortedByDescending { it.texto("cambiado_en") }
            .filter { cambio ->
                filtro.isBlank() ||
                    normalizarBusqueda(
                            listOf(
                                    cambio.texto("campo"),
                                    cambio.texto("tipo"),
                                    cambio.objeto("usuarios_app").texto("nombre_completo"),
                                    cambio.objeto("asignaturas").nombre,
                                    cambio["valor_anterior"].toString(),
                                    cambio["valor_nuevo"].toString(),
                                )
                                .joinToString(" ")
                        )
                        .contains(filtro)
            }
    ModalBottomSheet(
        onDismissRequest = cerrar,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        modifier = Modifier.semantics { paneTitle = "Historial de cambios" },
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 24.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Historial",
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.weight(1f).semantics { heading() },
            )
            AccionIcono("Cerrar historial", Icons.Outlined.Close, accion = cerrar)
        }
        OutlinedTextField(
            value = busqueda,
            onValueChange = { busqueda = it },
            singleLine = true,
            placeholder = { Text("Buscar autor, campo o contenido") },
            leadingIcon = { Icon(Icons.Outlined.Search, null) },
            trailingIcon = {
                if (busqueda.isNotBlank())
                    AccionIcono("Limpiar búsqueda", Icons.Outlined.Close) { busqueda = "" }
            },
            modifier =
                Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 12.dp).semantics {
                    contentDescription = "Buscar en el historial"
                },
        )
        LazyColumn(
            modifier = Modifier.fillMaxWidth().weight(1f, fill = false),
            contentPadding = PaddingValues(start = 24.dp, end = 24.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (cambios.isEmpty())
                item {
                    Vacio(
                        if (busqueda.isNotBlank()) "Sin coincidencias"
                        else "Sin cambios registrados",
                        Icons.Outlined.History,
                    )
                }
            cambios
                .groupBy { diaHistorial(it.texto("cambiado_en")) }
                .forEach { (dia, grupo) ->
                    item(key = "dia-$dia") {
                        Text(
                            etiquetaDiaHistorial(dia),
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier =
                                Modifier.padding(top = 16.dp, bottom = 8.dp).semantics {
                                    heading()
                                },
                        )
                    }
                    items(grupo, key = { "${it.texto("source")}-${it.id}" }) { cambio ->
                        CambioAcademico(cambio, expediente)
                    }
                }
        }
    }
}

@Composable
private fun CambioAcademico(cambio: Registro, expediente: Expediente) {
    var expandido by rememberSaveable(cambio.id) { mutableStateOf(false) }
    val autor = cambio.objeto("usuarios_app").texto("nombre_completo").ifBlank { "Sistema" }
    val campo = cambio.texto("campo")
    val tipo = cambio.texto("tipo").uppercase()
    val transicion = tipo.contains("TRANSICION") || campo in setOf("estado", "estado_actual_id")
    val creacion = tipo in setOf("CREACION", "CREATE", "INSERT", "CREAR")
    val baja = tipo in setOf("DELETE", "ELIMINACION", "ELIMINAR")
    val titulo =
        when {
            transicion -> "Cambió la etapa académica"
            creacion ->
                "Creó ${if (cambio.texto("asignatura_id").isNotBlank()) "la asignatura" else "el plan"}"
            baja -> "Eliminó ${etiquetaCampo(campo).lowercase().ifBlank { "un elemento" }}"
            campo.isNotBlank() ->
                "Actualizó ${etiquetaCampo(campo.removeSuffix("_id")).lowercase()}"
            else -> etiquetaCampo(tipo)
        }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            Modifier.fillMaxWidth()
                .clickable(
                    onClickLabel = if (expandido) "Ocultar comparación" else "Ver comparación"
                ) {
                    expandido = !expandido
                }
                .semantics { stateDescription = if (expandido) "Expandido" else "Contraído" }
                .padding(vertical = 8.dp),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            AvatarAcademico(autor)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(autor, style = MaterialTheme.typography.titleSmall)
                Text(titulo, style = MaterialTheme.typography.bodyMedium)
                cambio
                    .objeto("asignaturas")
                    .nombre
                    .takeIf { it.isNotBlank() }
                    ?.let {
                        Text(
                            it,
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                Text(
                    fechaAcademica(cambio.texto("cambiado_en")),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (
                    cambio.texto("fuente") == "IA" || cambio.texto("interaccion_ia_id").isNotBlank()
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Outlined.AutoAwesome,
                            null,
                            Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.primary,
                        )
                        Text(
                            "Asistido por IA",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
                if (cambio.booleano("admin_override"))
                    Text(
                        "Intervención administrativa",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
            }
            Icon(
                if (expandido) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (expandido) {
            Column(
                Modifier.padding(start = 16.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                if (!creacion) ValorAuditado("Antes", cambio["valor_anterior"], campo, expediente)
                if (!baja)
                    ValorAuditado(
                        if (creacion) "Contenido inicial" else "Después",
                        cambio["valor_nuevo"],
                        campo,
                        expediente,
                    )
                cambio
                    .texto("admin_override_motivo")
                    .takeIf { it.isNotBlank() }
                    ?.let {
                        TextoAcademico("Motivo de la intervención", it)
                    }
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .55f))
    }
}

@Composable
private fun ValorAuditado(
    titulo: String,
    valor: JsonElement?,
    campo: String,
    expediente: Expediente,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            titulo,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
        )
        ContenidoAuditado(valor, campo, expediente)
    }
}

@Composable
private fun ContenidoAuditado(valor: JsonElement?, campo: String, expediente: Expediente) {
    when (valor) {
        null,
        JsonNull ->
            Text(
                "Sin contenido",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        is JsonObject ->
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                valor.forEach { (clave, contenido) ->
                    if (contenido != JsonNull)
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                etiquetaCampo(clave.removeSuffix("_id")),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            ContenidoAuditado(contenido, clave, expediente)
                        }
                }
            }
        is JsonArray ->
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (valor.isEmpty())
                    Text("Sin elementos", color = MaterialTheme.colorScheme.onSurfaceVariant)
                valor.forEachIndexed { indice, elemento ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            "${indice + 1}.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Column(Modifier.weight(1f)) {
                            ContenidoAuditado(elemento, campo, expediente)
                        }
                    }
                }
            }
        is JsonPrimitive -> {
            val contenido = valor.contentOrNull.orEmpty()
            val referencia =
                (expediente.bloques +
                        expediente.asignaturas +
                        expediente.transiciones +
                        listOf(
                            expediente.registro.objeto("estados_plan"),
                            expediente.registro.objeto("carreras"),
                        ))
                    .firstOrNull { it.id == contenido && contenido.isNotBlank() }
            val texto =
                when {
                    referencia != null -> referencia.nombre
                    valor.booleanOrNull != null -> if (valor.booleanOrNull == true) "Sí" else "No"
                    campo == "estado" -> etiquetaEstadoRevision(contenido)
                    contenido.isBlank() -> "Sin contenido"
                    else -> contenido
                }
            ContenidoEnriquecido(texto)
        }
    }
}

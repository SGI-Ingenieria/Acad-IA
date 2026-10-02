@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package mx.sgi.acadia.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ListAlt
import androidx.compose.material.icons.automirrored.outlined.Subject
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

@Composable
fun DetalleEstructura(estructura: Registro, asignatura: Boolean, cerrar: () -> Unit) {
    ModalBottomSheet(
        onDismissRequest = cerrar,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    ) {
        LazyColumn(
            contentPadding = PaddingValues(start = 24.dp, end = 24.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        estructura.nombre,
                        Modifier.weight(1f).semantics { heading() },
                        style = MaterialTheme.typography.headlineSmall,
                    )
                    AccionIcono("Cerrar estructura", Icons.Outlined.Close, accion = cerrar)
                }
                val estado = estructura.texto("estado_publicacion")
                if (estado.isNotBlank())
                    Text(
                        etiquetaCampo(estado.lowercase()),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
            }
            item {
                CamposDeEstructura(estructura, if (asignatura) "Asignatura" else "Plan de estudios")
            }
            if (!asignatura) {
                val vinculada = estructuraAsignaturaVinculada(estructura)
                item {
                    if (vinculada == null)
                        Text(
                            "Sin estructura de asignatura vinculada",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    else CamposDeEstructura(vinculada, "Asignaturas · ${vinculada.nombre}")
                }
            }
        }
    }
}

@Composable
internal fun CamposDeEstructura(estructura: Registro, titulo: String) {
    val campos = camposEstructura(estructura)
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(titulo, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium)
        if (campos.isEmpty()) Text("Sin campos", color = MaterialTheme.colorScheme.onSurfaceVariant)
        campos.forEach { campo ->
            key(campo.clave) {
                var expandido by
                    rememberSaveable(estructura.id, campo.clave) { mutableStateOf(false) }
                Column {
                    Row(
                        Modifier.fillMaxWidth()
                            .clickable(role = Role.Button) { expandido = !expandido }
                            .semantics {
                                stateDescription = if (expandido) "Expandido" else "Contraído"
                            }
                            .padding(vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Icon(
                            when (campo.tipo) {
                                "Número" -> Icons.Outlined.Tag
                                "Opciones",
                                "Lista" -> Icons.AutoMirrored.Outlined.ListAlt
                                "Grupo" -> Icons.Outlined.AccountTree
                                "Sí / No" -> Icons.Outlined.CheckBox
                                else -> Icons.AutoMirrored.Outlined.Subject
                            },
                            null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Column(
                            Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Text(campo.titulo, style = MaterialTheme.typography.bodyLarge)
                            Text(
                                listOfNotNull(campo.tipo, "Requerido".takeIf { campo.requerido })
                                    .joinToString(" · "),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Icon(
                            if (expandido) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
                            null,
                        )
                    }
                    AnimatedVisibility(expandido) {
                        Column(
                            Modifier.padding(start = 36.dp, bottom = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            val def = campo.definicion
                            if (def.texto("description").isNotBlank())
                                ContenidoEnriquecido(def.texto("description"))
                            Text(
                                "Clave: ${campo.clave}",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            (def["enum"] as? JsonArray)?.forEach {
                                Text("• ${(it as? JsonPrimitive)?.contentOrNull ?: it}")
                            }
                            val limites =
                                listOfNotNull(
                                    def["minimum"]?.let { "Mínimo: $it" },
                                    def["maximum"]?.let { "Máximo: $it" },
                                )
                            if (limites.isNotEmpty()) Text(limites.joinToString(" · "))
                            if (def.texto("referencia_normativa").isNotBlank())
                                TextoAcademico(
                                    "Referencia normativa",
                                    def.texto("referencia_normativa"),
                                )
                            val hijos = def.objeto("properties")
                            if (hijos.isNotEmpty())
                                Text(hijos.keys.joinToString(" · ") { etiquetaCampo(it) })
                        }
                    }
                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .5f)
                    )
                }
            }
        }
    }
}

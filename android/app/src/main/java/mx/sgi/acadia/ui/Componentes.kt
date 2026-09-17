@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package mx.sgi.acadia.ui

import android.text.Html
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import mx.sgi.acadia.data.*

@Composable
fun AccionIcono(nombre: String, icono: ImageVector, enabled: Boolean = true, accion: () -> Unit) {
    TooltipBox(
        positionProvider =
            TooltipDefaults.rememberTooltipPositionProvider(TooltipAnchorPosition.Above),
        tooltip = { PlainTooltip { Text(nombre) } },
        state = rememberTooltipState(),
    ) {
        IconButton(onClick = accion, enabled = enabled) { Icon(icono, contentDescription = nombre) }
    }
}

@Composable
fun Pagina(
    titulo: String,
    atras: (() -> Unit)? = null,
    acciones: @Composable RowScope.() -> Unit = {},
    content: @Composable (PaddingValues) -> Unit,
) {
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text(titulo, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                navigationIcon = {
                    if (atras != null)
                        AccionIcono("Volver", Icons.AutoMirrored.Outlined.ArrowBack, accion = atras)
                },
                actions = acciones,
                colors =
                    TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.background
                    ),
            )
        },
        content = content,
    )
}

@Composable
fun Encabezado(titulo: String, etiqueta: String? = null, accion: (@Composable () -> Unit)? = null) {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            if (etiqueta != null)
                Text(
                    etiqueta.uppercase(),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
            Text(
                titulo,
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.semantics { heading() },
            )
        }
        accion?.invoke()
    }
}

@Composable
fun EtiquetaEstado(texto: String) {
    Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = RoundedCornerShape(50)) {
        Text(
            texto.replace('_', ' ').lowercase().replaceFirstChar { it.uppercase() },
            Modifier.padding(horizontal = 12.dp, vertical = 5.dp),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onPrimaryContainer,
        )
    }
}

@Composable
fun Dato(valor: String, etiqueta: String, modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(valor, style = MaterialTheme.typography.headlineSmall)
        Text(
            etiqueta,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
fun Aviso(texto: String, error: Boolean = true, reintentar: (() -> Unit)? = null) {
    Surface(
        color =
            if (error) MaterialTheme.colorScheme.errorContainer
            else MaterialTheme.colorScheme.secondaryContainer,
        shape = MaterialTheme.shapes.medium,
        modifier = Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                texto,
                style = MaterialTheme.typography.bodyMedium,
                color =
                    if (error) MaterialTheme.colorScheme.onErrorContainer
                    else MaterialTheme.colorScheme.onSecondaryContainer,
            )
            if (reintentar != null) TextButton(onClick = reintentar) { Text("Reintentar") }
        }
    }
}

@Composable
fun Vacio(
    titulo: String,
    icono: ImageVector = Icons.Outlined.AutoStories,
    accion: (@Composable () -> Unit)? = null,
) {
    Column(
        Modifier.fillMaxWidth().padding(vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Icon(icono, null, Modifier.size(40.dp), tint = MaterialTheme.colorScheme.primary)
        Text(titulo, style = MaterialTheme.typography.titleLarge)
        accion?.invoke()
    }
}

@Composable
fun Esqueleto() {
    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        LinearProgressIndicator(Modifier.fillMaxWidth())
        repeat(4) {
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth().height(if (it == 0) 110.dp else 72.dp),
            ) {}
        }
    }
}

@Composable
fun <T> Carga(estado: EstadoCarga<T>, reintentar: () -> Unit, content: @Composable (T) -> Unit) {
    Column {
        if (estado.cargando && estado.datos != null)
            LinearProgressIndicator(Modifier.fillMaxWidth())
        if (estado.error != null)
            Box(Modifier.padding(16.dp)) { Aviso(estado.error, reintentar = reintentar) }
        when {
            estado.datos != null -> content(estado.datos)
            estado.cargando -> Esqueleto()
        }
    }
}

@Composable
fun FilaPlan(plan: Registro, abrir: () -> Unit) {
    val carrera = plan.objeto("carreras")
    val estado = plan.objeto("estados_plan").texto("etiqueta", "Borrador")
    val acceso = !plan.containsKey("puede_abrir_detalle") || plan.booleano("puede_abrir_detalle")
    Column(
        Modifier.fillMaxWidth()
            .clickable(enabled = acceso, onClick = abrir)
            .padding(vertical = 22.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                carrera
                    .objeto("facultades")
                    .texto("nombre_corto")
                    .ifBlank { carrera.texto("nivel", "PLAN ACADÉMICO") }
                    .uppercase(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.weight(1f),
            )
            Icon(
                Icons.Outlined.ChevronRight,
                "Abrir plan",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(plan.nombre, style = MaterialTheme.typography.titleLarge)
        Text(
            "${plan.numero("numero_ciclos")} ${plan.texto("tipo_ciclo", "ciclo").lowercase()}s · ${carrera.texto("nivel")}",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        EtiquetaEstado(estado)
        if (!acceso)
            Text(
                "Solo metadatos · Sin acceso al expediente",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .5f))
}

@Composable
fun FilaAsignatura(asignatura: Registro, abrir: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = abrir).padding(vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Surface(
            color = MaterialTheme.colorScheme.primaryContainer,
            shape = RoundedCornerShape(16.dp),
        ) {
            Text(
                asignatura.numero("numero_ciclo").toString(),
                Modifier.padding(16.dp),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(asignatura.nombre, style = MaterialTheme.typography.titleMedium)
            Text(
                listOf(
                        asignatura.texto("codigo"),
                        "${asignatura.decimal("creditos")} créditos",
                        asignatura.texto("estado"),
                    )
                    .filter { it.isNotBlank() }
                    .joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Icon(
            Icons.Outlined.ChevronRight,
            "Abrir asignatura",
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .5f))
}

fun textoPlano(html: String): String =
    Html.fromHtml(html, Html.FROM_HTML_MODE_COMPACT).toString().trim()

fun etiquetaCampo(clave: String) = clave.replace('_', ' ').replaceFirstChar { it.uppercase() }

@Composable
fun TextoAcademico(titulo: String, texto: String, editar: (() -> Unit)? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                titulo,
                Modifier.weight(1f).semantics { heading() },
                style = MaterialTheme.typography.titleMedium,
            )
            if (editar != null) AccionIcono("Editar $titulo", Icons.Outlined.Edit, accion = editar)
        }
        SelectionContainerCompat {
            Text(
                textoPlano(texto).ifBlank { "Pendiente" },
                style = MaterialTheme.typography.bodyLarge,
                color =
                    if (texto.isBlank()) MaterialTheme.colorScheme.onSurfaceVariant
                    else MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

@Composable
private fun SelectionContainerCompat(content: @Composable () -> Unit) =
    androidx.compose.foundation.text.selection.SelectionContainer(content = content)

@Composable
fun DialogoFormulario(
    titulo: String,
    guardando: Boolean,
    error: String?,
    cerrar: () -> Unit,
    guardar: () -> Unit,
    valido: Boolean = true,
    content: @Composable ColumnScope.() -> Unit,
) {
    Dialog(onDismissRequest = { if (!guardando) cerrar() }) {
        Surface(shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surface) {
            Column(
                Modifier.padding(24.dp).heightIn(max = 680.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(titulo, Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
                    AccionIcono("Cerrar", Icons.Outlined.Close, !guardando, cerrar)
                }
                Column(
                    Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    content = content,
                )
                if (error != null)
                    Text(
                        error,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    )
                Button(
                    onClick = guardar,
                    enabled = valido && !guardando,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (guardando)
                        CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    else Icon(Icons.Outlined.Check, null)
                    Spacer(Modifier.width(8.dp))
                    Text(if (guardando) "Guardando…" else "Guardar")
                }
            }
        }
    }
}

@Composable
fun Selector(
    etiqueta: String,
    valor: String,
    opciones: List<Pair<String, String>>,
    seleccionar: (String) -> Unit,
) {
    var abierto by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = abierto, onExpandedChange = { abierto = it }) {
        OutlinedTextField(
            value = opciones.firstOrNull { it.first == valor }?.second.orEmpty(),
            onValueChange = {},
            readOnly = true,
            label = { Text(etiqueta) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(abierto) },
            modifier =
                Modifier.menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
                    .fillMaxWidth(),
        )
        ExposedDropdownMenu(expanded = abierto, onDismissRequest = { abierto = false }) {
            opciones.forEach { (id, nombre) ->
                DropdownMenuItem(
                    text = { Text(nombre) },
                    onClick = {
                        seleccionar(id)
                        abierto = false
                    },
                )
            }
        }
    }
}

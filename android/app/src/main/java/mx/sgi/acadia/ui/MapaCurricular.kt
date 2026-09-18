@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package mx.sgi.acadia.ui

import android.content.ClipData
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.*
import androidx.compose.foundation.draganddrop.dragAndDropSource
import androidx.compose.foundation.draganddrop.dragAndDropTarget
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.DriveFileMove
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draganddrop.*
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.graphics.toColorInt
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import mx.sgi.acadia.data.*

private const val MimeAsignatura = "application/vnd.mx.sgi.acadia.asignatura"

@Composable
fun MapaCurricular(
    expediente: Expediente,
    editable: Boolean,
    guardando: Boolean,
    mensaje: String?,
    abrir: (String) -> Unit,
    nueva: () -> Unit,
    mover: (Registro, CeldaMapa) -> Unit,
    nuevoBloque: (() -> Unit)? = null,
    editarBloque: ((Registro) -> Unit)? = null,
    mostrarAltaAsignatura: Boolean = true,
) {
    val r = expediente.registro
    val asignaturas = expediente.asignaturas.filter { it.texto("estado") != "archivada" }
    var vista by rememberSaveable { mutableStateOf("Mapa") }
    var seleccion by rememberSaveable { mutableStateOf<String?>(null) }
    var menuAsignatura by rememberSaveable { mutableStateOf<String?>(null) }
    var detalleBloque by rememberSaveable { mutableStateOf<String?>(null) }
    var arrastrando by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val horizontal = rememberScrollState()
    val vertical = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current
    val haptic = LocalHapticFeedback.current
    var zona by remember { mutableStateOf(Rect.Zero) }
    var velocidadX by remember { mutableFloatStateOf(0f) }
    var velocidadY by remember { mutableFloatStateOf(0f) }
    val ancho = 224.dp
    val bloquesOrdenados = expediente.bloques.sortedBy { it.numero("orden") }
    val sinBloque = objeto("id" to "", "nombre" to "Sin bloque")
    val bloques = bloquesOrdenados + sinBloque
    val borde = with(density) { 40.dp.toPx() }
    fun posicion(event: DragAndDropEvent) {
        val native = event.toAndroidDragEvent()
        velocidadX =
            when {
                native.x < zona.left + borde -> -14f
                native.x > zona.right - borde -> 14f
                else -> 0f
            }
        velocidadY =
            when {
                native.y < zona.top + borde -> -12f
                native.y > zona.bottom - borde -> 12f
                else -> 0f
            }
    }
    fun terminar() {
        arrastrando = null
        velocidadX = 0f
        velocidadY = 0f
    }
    LaunchedEffect(arrastrando, velocidadX, velocidadY) {
        while (arrastrando != null && (velocidadX != 0f || velocidadY != 0f)) {
            horizontal.scrollBy(velocidadX)
            vertical.scrollBy(velocidadY)
            delay(16)
        }
    }
    fun trasladar(id: String, destino: CeldaMapa) {
        val materia = asignaturas.find { it.id == id } ?: return
        if (!editable || guardando || materia.celdaMapa() == destino) return
        error =
            validarMovimientoMapa(
                materia,
                destino,
                expediente.asignaturas,
                r.numero("numero_ciclos"),
            )
        if (error == null) mover(materia, destino)
        terminar()
    }
    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    "${asignaturas.size} asignaturas · ${asignaturas.sumOf { it.decimal("creditos") }} cr.",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (editable && mostrarAltaAsignatura)
                AccionIcono("Añadir asignatura", Icons.Outlined.Add, !guardando, nueva)
        }
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(horizontal = 24.dp)) {
            listOf("Mapa", "Lista", "Bloques").forEachIndexed { indice, nombre ->
                SegmentedButton(
                    selected = vista == nombre,
                    onClick = { vista = nombre },
                    shape = SegmentedButtonDefaults.itemShape(indice, 3),
                    modifier =
                        Modifier.semantics { contentDescription = "Vista ${nombre.lowercase()}" },
                    icon = {},
                ) {
                    Text(nombre)
                }
            }
        }
        if (vista == "Bloques" && nuevoBloque != null)
            Row(
                Modifier.fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                AssistChip(
                    onClick = nuevoBloque,
                    enabled = !guardando,
                    label = { Text("Añadir bloque") },
                    leadingIcon = { Icon(Icons.Outlined.Add, null, Modifier.size(18.dp)) },
                )
            }
        if (error != null || mensaje != null) {
            Text(
                error ?: mensaje.orEmpty(),
                Modifier.padding(horizontal = 24.dp).semantics {
                    liveRegion = LiveRegionMode.Polite
                },
                style = MaterialTheme.typography.bodySmall,
                color =
                    if (error != null || mensaje != "Cambios guardados")
                        MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.primary,
            )
        }
        if (guardando)
            LinearProgressIndicator(
                Modifier.fillMaxWidth().semantics { contentDescription = "Guardando movimiento" }
            )
        if (vista == "Bloques") {
            LazyColumn(
                contentPadding = PaddingValues(24.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (bloquesOrdenados.isEmpty())
                    item { Vacio("Sin bloques formativos", Icons.Outlined.AccountTree) }
                items(bloquesOrdenados, key = { it.id }) { bloque ->
                    val materias = asignaturas.filter { it.texto("linea_plan_id") == bloque.id }
                    ListItem(
                        headlineContent = {
                            Text(bloque.nombre, style = MaterialTheme.typography.titleMedium)
                        },
                        supportingContent = {
                            Text(
                                "${materias.size} asignaturas · ${materias.sumOf { it.decimal("creditos") }} cr."
                            )
                        },
                        leadingContent = {
                            MarcaBloque(colorBloque(bloque, bloquesOrdenados.indexOf(bloque)))
                        },
                        trailingContent = { Icon(Icons.Outlined.ChevronRight, null) },
                        modifier = Modifier.clickable { detalleBloque = bloque.id },
                        colors =
                            ListItemDefaults.colors(
                                containerColor = MaterialTheme.colorScheme.background
                            ),
                    )
                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .5f)
                    )
                }
            }
        } else if (vista == "Lista") {
            LazyColumn(contentPadding = PaddingValues(24.dp)) {
                asignaturas
                    .groupBy { it.celdaMapa().ciclo }
                    .toSortedMap(compareBy { it ?: Int.MAX_VALUE })
                    .forEach { (ciclo, materias) ->
                        item(key = "ciclo-${ciclo ?: 0}") {
                            Text(
                                if (ciclo == null) "Sin ciclo"
                                else "${r.texto("tipo_ciclo")} $ciclo",
                                style = MaterialTheme.typography.titleMedium,
                                modifier =
                                    Modifier.padding(top = 16.dp, bottom = 8.dp).semantics {
                                        heading()
                                    },
                            )
                        }
                        items(
                            materias.sortedBy { it.texto("linea_plan_id").isBlank() },
                            key = { it.id },
                        ) { materia ->
                            val bloque =
                                bloquesOrdenados.find { it.id == materia.texto("linea_plan_id") }
                                    ?: sinBloque
                            FilaAsignaturaMapa(
                                materia,
                                bloque,
                                colorBloque(bloque, bloquesOrdenados.indexOf(bloque)),
                                editable && !guardando,
                                abrir = { abrir(materia.id) },
                                menu = {
                                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    menuAsignatura = materia.id
                                },
                                mover = { seleccion = materia.id },
                            )
                        }
                    }
                val archivadas = expediente.asignaturas.filter { it.texto("estado") == "archivada" }
                if (archivadas.isNotEmpty()) {
                    item { Text("Archivadas", style = MaterialTheme.typography.titleLarge) }
                    items(archivadas, key = { it.id }) { materia ->
                        FilaAsignatura(materia) { abrir(materia.id) }
                    }
                }
            }
        } else {
            Row(
                Modifier.fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                (1..r.numero("numero_ciclos")).forEach { ciclo ->
                    AssistChip(
                        onClick = {
                            scope.launch {
                                horizontal.animateScrollTo(
                                    with(density) { (ancho + 12.dp).toPx() }.toInt() * (ciclo - 1)
                                )
                            }
                        },
                        label = { Text("${r.texto("tipo_ciclo")} $ciclo") },
                    )
                }
            }
            Column(
                Modifier.weight(1f)
                    .fillMaxWidth()
                    .onGloballyPositioned { zona = it.boundsInRoot() }
                    .horizontalScroll(horizontal)
            ) {
                Row(
                    Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    (1..r.numero("numero_ciclos")).forEach { ciclo ->
                        Column(Modifier.width(ancho)) {
                            Text(
                                "${r.texto("tipo_ciclo")} $ciclo",
                                style = MaterialTheme.typography.titleMedium,
                                modifier = Modifier.semantics { heading() },
                            )
                            val materias = asignaturas.filter { it.celdaMapa().ciclo == ciclo }
                            Text(
                                "${materias.size} asignaturas · ${materias.sumOf { it.decimal("creditos") }} cr.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                LazyColumn(
                    state = vertical,
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                ) {
                    items(bloques, key = { it.id }) { bloque ->
                        val color = colorBloque(bloque, bloquesOrdenados.indexOf(bloque))
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                Modifier.heightIn(min = 48.dp)
                                    .then(
                                        if (bloque.id.isNotBlank())
                                            Modifier.clickable(
                                                onClickLabel = "Ver bloque ${bloque.nombre}",
                                                role = Role.Button,
                                            ) {
                                                detalleBloque = bloque.id
                                            }
                                        else Modifier
                                    ),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                MarcaBloque(color)
                                Text(
                                    bloque.nombre,
                                    style = MaterialTheme.typography.titleSmall,
                                    modifier = Modifier.semantics { heading() },
                                )
                                if (bloque.id.isNotBlank())
                                    Icon(
                                        Icons.Outlined.ChevronRight,
                                        null,
                                        Modifier.size(18.dp),
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                            }
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                modifier = Modifier.height(IntrinsicSize.Min),
                            ) {
                                (1..r.numero("numero_ciclos")).forEach { ciclo ->
                                    val celda = CeldaMapa(ciclo, bloque.id.ifBlank { null })
                                    CeldaCurricular(
                                        celda,
                                        asignaturas
                                            .filter { it.celdaMapa() == celda }
                                            .sortedBy { it.numero("orden_celda") },
                                        color,
                                        editable && !guardando,
                                        arrastrando,
                                        Modifier.width(ancho).fillMaxHeight(),
                                        { id ->
                                            arrastrando = id
                                            haptic.performHapticFeedback(
                                                HapticFeedbackType.LongPress
                                            )
                                        },
                                        ::posicion,
                                        ::terminar,
                                        { id -> trasladar(id, celda) },
                                        abrir,
                                        { menuAsignatura = it },
                                    )
                                }
                            }
                        }
                    }
                    item {
                        Column(
                            Modifier.width(ancho),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text("Sin ciclo", style = MaterialTheme.typography.titleMedium)
                            CeldaCurricular(
                                CeldaMapa(null, null),
                                asignaturas.filter { it.celdaMapa().ciclo == null },
                                MaterialTheme.colorScheme.outline,
                                editable && !guardando,
                                arrastrando,
                                Modifier.fillMaxWidth(),
                                {
                                    arrastrando = it
                                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                },
                                ::posicion,
                                ::terminar,
                                { trasladar(it, CeldaMapa(null, null)) },
                                abrir,
                                { menuAsignatura = it },
                            )
                        }
                    }
                }
            }
        }
    }
    detalleBloque?.let { id ->
        bloquesOrdenados
            .find { it.id == id }
            ?.let { bloque ->
                DetalleBloqueMapa(
                    bloque,
                    colorBloque(bloque, bloquesOrdenados.indexOf(bloque)),
                    asignaturas.filter { it.texto("linea_plan_id") == id },
                    editarBloque != null && !guardando,
                    cerrar = { detalleBloque = null },
                    editar =
                        editarBloque?.let { accion ->
                            {
                                detalleBloque = null
                                accion(bloque)
                            }
                        },
                )
            }
    }
    menuAsignatura?.let { id ->
        asignaturas
            .find { it.id == id }
            ?.let { materia ->
                val bloque =
                    bloquesOrdenados.find { it.id == materia.texto("linea_plan_id") } ?: sinBloque
                ModalBottomSheet(onDismissRequest = { menuAsignatura = null }) {
                    Column(
                        Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Text(
                                materia.nombre,
                                Modifier.weight(1f),
                                style = MaterialTheme.typography.titleLarge,
                            )
                            AccionIcono("Cerrar acciones", Icons.Outlined.Close) {
                                menuAsignatura = null
                            }
                        }
                        IdentidadBloqueMapa(
                            bloque,
                            colorBloque(bloque, bloquesOrdenados.indexOf(bloque)),
                        )
                        ListItem(
                            headlineContent = { Text("Abrir asignatura") },
                            leadingContent = { Icon(Icons.Outlined.AutoStories, null) },
                            modifier =
                                Modifier.clickable {
                                    menuAsignatura = null
                                    abrir(id)
                                },
                        )
                        if (editable)
                            ListItem(
                                headlineContent = { Text("Mover asignatura") },
                                leadingContent = {
                                    Icon(Icons.AutoMirrored.Outlined.DriveFileMove, null)
                                },
                                modifier =
                                    Modifier.clickable(enabled = !guardando) {
                                        menuAsignatura = null
                                        seleccion = id
                                    },
                            )
                    }
                }
            }
    }
    seleccion?.let { id ->
        val materia = asignaturas.find { it.id == id }
        if (materia != null)
            key(id) {
                var ciclo by rememberSaveable {
                    mutableStateOf(materia.celdaMapa().ciclo?.toString().orEmpty())
                }
                var bloque by rememberSaveable {
                    mutableStateOf(materia.celdaMapa().bloque.orEmpty())
                }
                DialogoFormulario(
                    "Mover ${materia.nombre}",
                    guardando,
                    error,
                    {
                        seleccion = null
                        error = null
                    },
                    guardar = {
                        val destino =
                            CeldaMapa(
                                ciclo.toIntOrNull(),
                                if (ciclo.isBlank()) null else bloque.ifBlank { null },
                            )
                        trasladar(id, destino)
                        if (error == null) seleccion = null
                    },
                ) {
                    Selector(
                        "Ciclo de destino",
                        ciclo,
                        listOf("" to "Sin ciclo") +
                            (1..r.numero("numero_ciclos")).map {
                                it.toString() to "${r.texto("tipo_ciclo")} $it"
                            },
                    ) {
                        ciclo = it
                    }
                    if (ciclo.isNotBlank())
                        SelectorBloqueMapa(
                            bloque,
                            bloquesOrdenados,
                        ) {
                            bloque = it
                        }
                }
            }
    }
}

@Composable
private fun colorBloque(bloque: Registro, indice: Int): Color {
    val defecto = MaterialTheme.colorScheme.outline
    if (bloque.id.isBlank()) return defecto
    return try {
        Color(colorBloqueCurricular(bloque, indice).toColorInt())
    } catch (_: IllegalArgumentException) {
        defecto
    }
}

@Composable
private fun MarcaBloque(color: Color) {
    Box(Modifier.size(10.dp).background(color, RoundedCornerShape(3.dp)))
}

@Composable
private fun IdentidadBloqueMapa(bloque: Registro, color: Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        MarcaBloque(color)
        Text(bloque.nombre, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
private fun FilaAsignaturaMapa(
    materia: Registro,
    bloque: Registro,
    color: Color,
    editable: Boolean,
    abrir: () -> Unit,
    menu: () -> Unit,
    mover: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth()
            .testTag("asignatura-lista-${materia.id}")
            .combinedClickable(
                onClickLabel = "Abrir asignatura",
                onClick = abrir,
                onLongClickLabel = if (editable) "Acciones de la asignatura" else null,
                onLongClick = if (editable) menu else null,
            )
            .semantics {
                if (editable)
                    customActions =
                        listOf(
                            CustomAccessibilityAction("Mover asignatura") {
                                mover()
                                true
                            }
                        )
            }
            .padding(vertical = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(4.dp).height(56.dp).background(color, RoundedCornerShape(2.dp)))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(materia.nombre, style = MaterialTheme.typography.titleMedium)
            Text(
                listOf(materia.texto("codigo"), "${materia.decimal("creditos")} cr.")
                    .filter(String::isNotBlank)
                    .joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            IdentidadBloqueMapa(bloque, color)
        }
        Icon(Icons.Outlined.ChevronRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .5f))
}

@Composable
private fun SelectorBloqueMapa(
    valor: String,
    bloques: List<Registro>,
    seleccionar: (String) -> Unit,
) {
    var abierto by remember { mutableStateOf(false) }
    val opciones = listOf(objeto("id" to "", "nombre" to "Sin bloque")) + bloques
    val elegido = opciones.find { it.id == valor } ?: opciones.first()
    ExposedDropdownMenuBox(expanded = abierto, onExpandedChange = { abierto = it }) {
        OutlinedTextField(
            value = elegido.nombre,
            onValueChange = {},
            readOnly = true,
            label = { Text("Bloque formativo") },
            leadingIcon = { MarcaBloque(colorBloque(elegido, bloques.indexOf(elegido))) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(abierto) },
            modifier =
                Modifier.menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
                    .fillMaxWidth(),
        )
        ExposedDropdownMenu(expanded = abierto, onDismissRequest = { abierto = false }) {
            opciones.forEach { bloque ->
                DropdownMenuItem(
                    text = { Text(bloque.nombre) },
                    leadingIcon = { MarcaBloque(colorBloque(bloque, bloques.indexOf(bloque))) },
                    trailingIcon =
                        if (bloque.id == valor) {
                            { Icon(Icons.Outlined.Check, "Seleccionado") }
                        } else null,
                    onClick = {
                        seleccionar(bloque.id)
                        abierto = false
                    },
                )
            }
        }
    }
}

@Composable
private fun DetalleBloqueMapa(
    bloque: Registro,
    color: Color,
    asignaturas: List<Registro>,
    editable: Boolean,
    cerrar: () -> Unit,
    editar: (() -> Unit)?,
) {
    ModalBottomSheet(onDismissRequest = cerrar) {
        Column(
            Modifier.fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                MarcaBloque(color)
                Text(
                    bloque.nombre,
                    Modifier.weight(1f),
                    style = MaterialTheme.typography.titleLarge,
                )
                AccionIcono("Cerrar bloque", Icons.Outlined.Close, accion = cerrar)
            }
            Text(
                "${asignaturas.size} asignaturas · ${asignaturas.sumOf { it.decimal("creditos") }} cr.",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (bloque.texto("area").isNotBlank())
                Text(
                    etiquetaCampo(bloque.texto("area")),
                    style = MaterialTheme.typography.labelMedium,
                )
            if (bloque.texto("proposito").isNotBlank())
                ContenidoEnriquecido(bloque.texto("proposito"))
            if (bloque.texto("aporte_perfil_egreso").isNotBlank())
                TextoAcademico("Aporte al perfil de egreso", bloque.texto("aporte_perfil_egreso"))
            if (bloque.texto("alcance_formativo").isNotBlank())
                TextoAcademico("Alcance formativo", bloque.texto("alcance_formativo"))
            if (editable && editar != null)
                FilledTonalButton(onClick = editar, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Outlined.Edit, null, Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Editar bloque")
                }
        }
    }
}

@Composable
private fun CeldaCurricular(
    celda: CeldaMapa,
    materias: List<Registro>,
    color: Color,
    editable: Boolean,
    arrastrando: String?,
    modifier: Modifier,
    iniciar: (String) -> Unit,
    posicion: (DragAndDropEvent) -> Unit,
    terminar: () -> Unit,
    recibir: (String) -> Unit,
    abrir: (String) -> Unit,
    menu: (String) -> Unit,
) {
    var dentro by remember { mutableStateOf(false) }
    val recibirActual by rememberUpdatedState(recibir)
    val posicionActual by rememberUpdatedState(posicion)
    val terminarActual by rememberUpdatedState(terminar)
    val objetivo = remember {
        object : DragAndDropTarget {
            override fun onDrop(event: DragAndDropEvent): Boolean {
                val id = event.toAndroidDragEvent().localState as? String ?: return false
                recibirActual(id)
                dentro = false
                return true
            }

            override fun onEntered(event: DragAndDropEvent) {
                dentro = true
                posicionActual(event)
            }

            override fun onMoved(event: DragAndDropEvent) {
                posicionActual(event)
            }

            override fun onExited(event: DragAndDropEvent) {
                dentro = false
            }

            override fun onEnded(event: DragAndDropEvent) {
                dentro = false
                terminarActual()
            }
        }
    }
    val fondo by
        animateColorAsState(
            if (dentro) MaterialTheme.colorScheme.primaryContainer
            else MaterialTheme.colorScheme.surfaceContainerLow,
            label = "Destino del mapa",
        )
    Column(
        modifier
            .heightIn(min = 148.dp)
            .testTag("celda-${celda.ciclo ?: 0}-${celda.bloque.orEmpty()}")
            .dragAndDropTarget(
                shouldStartDragAndDrop = { editable && it.mimeTypes().contains(MimeAsignatura) },
                target = objetivo,
            )
            .background(fondo, RoundedCornerShape(16.dp))
            .border(
                if (dentro) 2.dp else 1.dp,
                if (dentro) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.outlineVariant.copy(alpha = .45f),
                RoundedCornerShape(16.dp),
            )
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (materias.isEmpty())
            Box(
                Modifier.fillMaxWidth().heightIn(min = 132.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    if (dentro) "Suelta aquí" else "—",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        materias.forEach { materia ->
            key(materia.id) {
                val origen =
                    if (editable)
                        Modifier.dragAndDropSource { _ ->
                            iniciar(materia.id)
                            DragAndDropTransferData(
                                ClipData(
                                    "Asignatura",
                                    arrayOf(MimeAsignatura),
                                    ClipData.Item(materia.id),
                                ),
                                localState = materia.id,
                            )
                        }
                    else Modifier
                Surface(
                    modifier =
                        Modifier.fillMaxWidth()
                            .testTag("asignatura-mapa-${materia.id}")
                            .then(origen)
                            .graphicsLayer { alpha = if (arrastrando == materia.id) .4f else 1f },
                    color = MaterialTheme.colorScheme.surface,
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, color.copy(alpha = .45f)),
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Row(
                            Modifier.testTag("agarre-${materia.id}").heightIn(min = 48.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            if (editable)
                                Icon(
                                    Icons.Outlined.DragIndicator,
                                    "Mantén pulsado para arrastrar",
                                    Modifier.size(16.dp),
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            Text(
                                materia.texto("codigo").ifBlank { "Sin clave" },
                                Modifier.weight(1f),
                                style = MaterialTheme.typography.labelSmall,
                                maxLines = 1,
                            )
                            if (editable)
                                AccionIcono(
                                    "Mover ${materia.nombre}",
                                    Icons.Outlined.MoreHoriz,
                                    accion = { menu(materia.id) },
                                )
                        }
                        Column(
                            Modifier.fillMaxWidth()
                                .clickable { abrir(materia.id) }
                                .semantics {
                                    customActions =
                                        if (editable)
                                            listOf(
                                                CustomAccessibilityAction("Mover asignatura") {
                                                    menu(materia.id)
                                                    true
                                                }
                                            )
                                        else emptyList()
                                }
                        ) {
                            Text(
                                materia.nombre,
                                style = MaterialTheme.typography.titleSmall,
                                maxLines = 4,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Spacer(Modifier.height(12.dp))
                            Text(
                                "${materia.decimal("creditos")} cr. · ${materia.numero("horas_academicas")} HA · ${materia.numero("horas_independientes")} HI",
                                style = MaterialTheme.typography.labelSmall,
                            )
                            Text(
                                etiquetaCampo(materia.texto("estado")),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }
    }
}

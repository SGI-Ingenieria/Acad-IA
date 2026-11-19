@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package mx.sgi.acadia.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import java.util.UUID
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import mx.sgi.acadia.data.*

/** Drafts keep text percentages intact (including a trailing decimal separator) until save. */
@Composable
internal fun EditorListaAcademica(
    evaluacion: Boolean,
    original: Registro,
    asignatura: Registro,
    ocupado: Boolean,
    error: String?,
    cerrar: () -> Unit,
    guardar: (Registro) -> Unit,
) {
    val fuente =
        if (evaluacion) asignatura.lista("criterios_de_evaluacion") else original.lista("temas")
    // Local keys are separate from domain ids: moving/deleting rows must not steal another row's
    // focus.
    val inicial by rememberSaveable {
        mutableStateOf(
            JsonArray(
                    fuente.map {
                        JsonObject(
                            (if (evaluacion) it - "criterio" else it) +
                                objeto(
                                    "_clave_editor" to UUID.randomUUID().toString(),
                                    "nombre" to if (evaluacion) it.nombreCriterio else it.nombre,
                                )
                        )
                    }
                )
                .toString()
        )
    }
    var borrador by rememberSaveable { mutableStateOf(inicial) }
    var titulo by rememberSaveable { mutableStateOf(original.texto("titulo")) }
    var nuevo by rememberSaveable { mutableStateOf("") }
    var porcentaje by rememberSaveable { mutableStateOf("") }
    var validacion by rememberSaveable { mutableStateOf<String?>(null) }
    var confirmarCierre by rememberSaveable { mutableStateOf(false) }
    val filas = Json.parseToJsonElement(borrador).jsonArray.map { it.jsonObject }
    val total = filas.sumOf {
        it.texto("porcentaje").replace(',', '.').toDoubleOrNull()?.takeIf { valor ->
            valor.isFinite()
        } ?: 0.0
    }
    val lista = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val focoNuevo = remember { FocusRequester() }
    val focoPorcentaje = remember { FocusRequester() }
    fun actualizar(datos: List<Registro>) {
        borrador = JsonArray(datos).toString()
        validacion = null
    }
    fun agregar() {
        if (ocupado || nuevo.isBlank()) return
        if (
            evaluacion &&
                porcentaje.replace(',', '.').toDoubleOrNull()?.let { it > 0 && it <= 100 } != true
        ) {
            validacion = "Asigna un porcentaje mayor que 0 y no mayor que 100."
            focoPorcentaje.requestFocus()
            return
        }
        actualizar(
            filas +
                objeto(
                    "_clave_editor" to UUID.randomUUID().toString(),
                    "nombre" to nuevo.trim(),
                    *if (evaluacion) arrayOf("porcentaje" to porcentaje)
                    else arrayOf("id" to UUID.randomUUID().toString()),
                )
        )
        nuevo = ""
        porcentaje = ""
        focoNuevo.requestFocus()
        scope.launch { lista.animateScrollToItem(filas.size) }
    }
    fun solicitarCierre() {
        if (!ocupado) {
            if (
                borrador != inicial ||
                    titulo != original.texto("titulo") ||
                    nuevo.isNotBlank() ||
                    porcentaje.isNotBlank()
            )
                confirmarCierre = true
            else cerrar()
        }
    }
    fun guardarLista() {
        var datos = filas
        if (nuevo.isNotBlank()) {
            datos =
                datos +
                    objeto(
                        "nombre" to nuevo.trim(),
                        *if (evaluacion) arrayOf("porcentaje" to porcentaje)
                        else arrayOf("id" to UUID.randomUUID().toString()),
                    )
        } else if (porcentaje.isNotBlank()) {
            validacion = "Escribe el nombre del criterio."
            return
        }
        datos = datos.map { JsonObject(it - "_clave_editor") }
        if (evaluacion) {
            if (
                datos.any {
                    it.texto("porcentaje").replace(',', '.').toDoubleOrNull()?.isFinite() != true
                }
            ) {
                validacion = "Revisa los porcentajes de cada criterio."
                return
            }
            datos = datos.map {
                JsonObject(
                    it + objeto("porcentaje" to it.texto("porcentaje").replace(',', '.').toDouble())
                )
            }
            validacion = Validacion.evaluacion(datos)
            if (validacion == null)
                guardar(
                    objeto(
                        "criterios_de_evaluacion" to
                            JsonArray(
                                datos.map {
                                    JsonObject(
                                        (it - "nombre") +
                                            objeto(
                                                "criterio" to it.nombreCriterio.trim(),
                                                "porcentaje" to it.decimal("porcentaje").toInt(),
                                            )
                                    )
                                }
                            )
                    )
                )
        } else {
            if (titulo.isBlank() || datos.any { it.nombre.isBlank() }) {
                validacion = "La unidad y sus temas necesitan un nombre."
                return
            }
            val unidades = asignatura.lista("contenido_tematico").toMutableList()
            val unidad =
                JsonObject(
                    original +
                        objeto(
                            "id" to original.id.ifBlank { UUID.randomUUID().toString() },
                            "titulo" to titulo.trim(),
                            "unidad" to original.numero("unidad", unidades.size + 1),
                            "temas" to JsonArray(datos),
                        )
                )
            val indice = unidades.indexOfFirst { it == original }
            if (indice >= 0) unidades[indice] = unidad else unidades.add(unidad)
            guardar(objeto("contenido_tematico" to JsonArray(unidades)))
        }
    }
    Dialog(
        onDismissRequest = ::solicitarCierre,
        properties =
            DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        BarrasDialogoAcad()
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Column(Modifier.safeDrawingPadding().imePadding()) {
                TopAppBar(
                    title = { Text(if (evaluacion) "Evaluación" else "Unidad temática") },
                    navigationIcon = {
                        AccionIcono("Cerrar", Icons.Outlined.Close, !ocupado, ::solicitarCierre)
                    },
                    actions = {
                        TextButton(onClick = ::guardarLista, enabled = !ocupado) {
                            if (ocupado)
                                CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                            else Text("Guardar")
                        }
                    },
                )
                if (!evaluacion)
                    OutlinedTextField(
                        titulo,
                        { titulo = it },
                        label = { Text("Título de la unidad") },
                        enabled = !ocupado,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp),
                    )
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        if (evaluacion)
                            "${filas.size} ${if (filas.size == 1) "criterio" else "criterios"}"
                        else "${filas.size} ${if (filas.size == 1) "tema" else "temas"}",
                        style = MaterialTheme.typography.labelLarge,
                    )
                    if (evaluacion)
                        Text(
                            "${numeroAcademico(total)} / 100 %",
                            style = MaterialTheme.typography.titleMedium,
                            color =
                                if (total > 100) MaterialTheme.colorScheme.error
                                else MaterialTheme.colorScheme.primary,
                        )
                }
                if (evaluacion) {
                    LinearProgressIndicator(
                        progress = { (total / 100).toFloat().coerceIn(0f, 1f) },
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp),
                    )
                    Text(
                        if (total == 100.0) "Distribución completa"
                        else if (total < 100) "Falta distribuir ${numeroAcademico(100 - total)} %"
                        else "Sobran ${numeroAcademico(total - 100)} %",
                        Modifier.padding(horizontal = 24.dp, vertical = 8.dp).semantics {
                            liveRegion = LiveRegionMode.Polite
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                LazyColumn(
                    state = lista,
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(horizontal = 24.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    itemsIndexed(filas, key = { _, fila -> fila.texto("_clave_editor") }) {
                        indice,
                        fila ->
                        Row(
                            verticalAlignment = Alignment.Top,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            OutlinedTextField(
                                fila.nombre,
                                { nombre ->
                                    actualizar(
                                        filas.mapIndexed { i, valor ->
                                            if (i == indice)
                                                JsonObject(valor + objeto("nombre" to nombre))
                                            else valor
                                        }
                                    )
                                },
                                enabled = !ocupado,
                                label = {
                                    Text(
                                        if (evaluacion) "Criterio ${indice + 1}"
                                        else "Tema ${indice + 1}"
                                    )
                                },
                                modifier = Modifier.weight(1f),
                                maxLines = 4,
                            )
                            if (evaluacion)
                                OutlinedTextField(
                                    fila.texto("porcentaje"),
                                    { valor ->
                                        actualizar(
                                            filas.mapIndexed { i, item ->
                                                if (i == indice)
                                                    JsonObject(item + objeto("porcentaje" to valor))
                                                else item
                                            }
                                        )
                                    },
                                    enabled = !ocupado,
                                    label = { Text("%") },
                                    modifier = Modifier.width(88.dp),
                                    singleLine = true,
                                    keyboardOptions =
                                        KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                )
                            var menu by remember { mutableStateOf(false) }
                            Box(Modifier.padding(top = 8.dp)) {
                                AccionIcono(
                                    "Opciones ${if (evaluacion) "del criterio" else "del tema"} ${indice + 1}",
                                    Icons.Outlined.MoreVert,
                                    !ocupado,
                                ) {
                                    menu = true
                                }
                                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                                    fun mover(destino: Int) {
                                        val copia = filas.toMutableList()
                                        copia.add(destino, copia.removeAt(indice))
                                        actualizar(copia)
                                        menu = false
                                    }
                                    DropdownMenuItem(
                                        text = { Text("Subir") },
                                        enabled = indice > 0,
                                        onClick = { mover(indice - 1) },
                                        leadingIcon = { Icon(Icons.Outlined.ArrowUpward, null) },
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Bajar") },
                                        enabled = indice < filas.lastIndex,
                                        onClick = { mover(indice + 1) },
                                        leadingIcon = { Icon(Icons.Outlined.ArrowDownward, null) },
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Quitar") },
                                        onClick = {
                                            actualizar(filas.filterIndexed { i, _ -> i != indice })
                                            menu = false
                                        },
                                        leadingIcon = { Icon(Icons.Outlined.Close, null) },
                                    )
                                }
                            }
                        }
                    }
                }
                Surface(color = MaterialTheme.colorScheme.surfaceContainerLow) {
                    Column(
                        Modifier.padding(horizontal = 24.dp, vertical = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        if (validacion != null || error != null)
                            Text(
                                validacion ?: error.orEmpty(),
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodySmall,
                                modifier =
                                    Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                            )
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            OutlinedTextField(
                                nuevo,
                                {
                                    nuevo = it
                                    validacion = null
                                },
                                enabled = !ocupado,
                                label = {
                                    Text(if (evaluacion) "Nuevo criterio" else "Nuevo tema")
                                },
                                modifier = Modifier.weight(1f).focusRequester(focoNuevo),
                                singleLine = true,
                                keyboardOptions =
                                    KeyboardOptions(
                                        imeAction =
                                            if (evaluacion) ImeAction.Next else ImeAction.Done
                                    ),
                                keyboardActions =
                                    KeyboardActions(
                                        onNext = { focoPorcentaje.requestFocus() },
                                        onDone = { agregar() },
                                    ),
                            )
                            if (evaluacion)
                                OutlinedTextField(
                                    porcentaje,
                                    {
                                        porcentaje = it
                                        validacion = null
                                    },
                                    enabled = !ocupado,
                                    label = { Text("%") },
                                    modifier = Modifier.width(88.dp).focusRequester(focoPorcentaje),
                                    singleLine = true,
                                    keyboardOptions =
                                        KeyboardOptions(
                                            keyboardType = KeyboardType.Decimal,
                                            imeAction = ImeAction.Done,
                                        ),
                                    keyboardActions = KeyboardActions(onDone = { agregar() }),
                                )
                            FilledIconButton(
                                onClick = ::agregar,
                                enabled = !ocupado && nuevo.isNotBlank(),
                            ) {
                                Icon(
                                    Icons.Outlined.Add,
                                    if (evaluacion) "Añadir criterio" else "Añadir tema",
                                )
                            }
                        }
                    }
                }
            }
        }
        if (confirmarCierre)
            AlertDialog(
                onDismissRequest = { confirmarCierre = false },
                title = { Text("¿Descartar cambios?") },
                text = { Text("Los cambios de este editor aún no se han guardado.") },
                confirmButton = { TextButton(onClick = cerrar) { Text("Descartar") } },
                dismissButton = {
                    TextButton(onClick = { confirmarCierre = false }) { Text("Seguir editando") }
                },
            )
    }
}

private fun numeroAcademico(numero: Double): String =
    if (numero % 1.0 == 0.0) numero.toInt().toString()
    else "%.1f".format(java.util.Locale.forLanguageTag("es-MX"), numero)

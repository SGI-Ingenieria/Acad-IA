@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package mx.sgi.acadia.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import java.time.Year
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.serialization.json.*
import mx.sgi.acadia.data.*

class BusquedaBibliografiaViewModel(private val repo: RepositorioAcad) : ViewModel() {
    val estado = MutableStateFlow(EstadoCarga<List<Registro>>(cargando = false))
    private var trabajo: Job? = null

    fun buscar(fuente: FuenteBibliografia, texto: String) {
        trabajo?.cancel()
        estado.value = EstadoCarga(cargando = false)
        if (fuente == FuenteBibliografia.Manual || texto.trim().length < 3) return
        estado.value = EstadoCarga(cargando = true)
        trabajo = viewModelScope.launch {
            delay(350)
            try {
                estado.value = EstadoCarga(repo.buscarReferencias(fuente, texto), false)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                estado.value =
                    EstadoCarga(
                        cargando = false,
                        error =
                            if (
                                e is FalloAcad &&
                                    e.categoria in
                                        setOf(
                                            CategoriaError.Red,
                                            CategoriaError.Permiso,
                                            CategoriaError.Credenciales,
                                        )
                            )
                                e.message
                            else "No se pudo consultar la bibliografía. Inténtalo nuevamente.",
                    )
            }
        }
    }

    fun detener() {
        trabajo?.cancel()
    }
}

@Composable
fun BibliografiaEditor(
    repo: RepositorioAcad,
    original: Registro?,
    guardando: Boolean,
    error: String?,
    cerrar: () -> Unit,
    guardar: (Registro) -> Unit,
) {
    var fuenteNombre by rememberSaveable { mutableStateOf(FuenteBibliografia.Manual.name) }
    val fuente = FuenteBibliografia.valueOf(fuenteNombre)
    var capturar by rememberSaveable { mutableStateOf(original != null) }
    var consulta by rememberSaveable { mutableStateOf("") }
    var datosJson by rememberSaveable { mutableStateOf((original ?: objeto()).toString()) }
    val datos = Json.parseToJsonElement(datosJson).jsonObject
    var consultada by rememberSaveable {
        mutableStateOf(original?.esReferenciaConsultada() == true)
    }
    fun campo(clave: String, valor: JsonElement) {
        datosJson = JsonObject(datos + (clave to valor)).toString()
    }
    fun texto(clave: String, valor: String) = campo(clave, JsonPrimitive(valor))
    var formato by rememberSaveable {
        mutableStateOf(
            original?.let { registro ->
                registro.texto("formato").takeIf {
                    it.isNotBlank() || registro.texto("cita").isNotBlank()
                }
            } ?: "apa"
        )
    }
    var formatoCita by rememberSaveable { mutableStateOf(formato) }
    val formatos = formatosBibliograficos.let {
        if (it.any { opcion -> opcion.first == formato }) it
        else listOf(formato to formato.ifBlank { "Formato original" }) + it
    }
    val citaCalculada =
        remember(datosJson, formato, consultada) {
            if (consultada || datos.texto("cita").isBlank())
                runCatching { citaBibliografica(datos, formato) }
            else Result.success(datos.texto("cita"))
        }
    val cita = citaCalculada.getOrDefault("")
    var sustitucion by rememberSaveable { mutableStateOf<String?>(null) }
    var validacion by rememberSaveable { mutableStateOf<String?>(null) }
    var descartar by remember { mutableStateOf(false) }
    val formatoOriginal =
        original?.let { registro ->
            registro.texto("formato").takeIf {
                it.isNotBlank() || registro.texto("cita").isNotBlank()
            }
        } ?: "apa"
    val hayCambios =
        !consultada &&
            (datosJson != (original ?: objeto()).toString() || formato != formatoOriginal)
    fun seleccionar(resultado: Registro) {
        datosJson = resultado.toString()
        consultada = resultado.esReferenciaConsultada()
        formato =
            resultado.texto("formato").takeIf {
                it.isNotBlank() || resultado.texto("cita").isNotBlank()
            } ?: "apa"
        validacion = null
        capturar = true
    }
    fun salir() {
        if (!guardando) {
            if (hayCambios) descartar = true else cerrar()
        }
    }
    val vm: BusquedaBibliografiaViewModel =
        viewModel(
            key = "busqueda-bibliografia-${original?.id.orEmpty()}",
            factory = fabrica { BusquedaBibliografiaViewModel(repo) },
        )
    val resultados by vm.estado.collectAsStateWithLifecycle()
    LaunchedEffect(fuente, consulta, capturar) {
        if (!capturar) vm.buscar(fuente, consulta) else vm.detener()
    }
    DisposableEffect(vm) { onDispose { vm.detener() } }

    Dialog(
        onDismissRequest = ::salir,
        properties =
            DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        BarrasDialogoAcad()
        BackHandler(enabled = !guardando, onBack = ::salir)
        Surface(color = MaterialTheme.colorScheme.background) {
            Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        if (capturar && consultada) "Previsualizar referencia"
                        else if (original == null) "Añadir referencia" else "Editar referencia",
                        Modifier.weight(1f),
                        style = MaterialTheme.typography.titleLarge,
                    )
                    AccionIcono("Cerrar bibliografía", Icons.Outlined.Close, !guardando, ::salir)
                }
                LazyColumn(
                    Modifier.weight(1f),
                    contentPadding = PaddingValues(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    if (!capturar) {
                        item {
                            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                                FuenteBibliografia.entries.forEachIndexed { index, opcion ->
                                    SegmentedButton(
                                        selected = fuente == opcion,
                                        enabled = !guardando,
                                        onClick = { fuenteNombre = opcion.name },
                                        shape =
                                            SegmentedButtonDefaults.itemShape(
                                                index,
                                                FuenteBibliografia.entries.size,
                                            ),
                                    ) {
                                        Text(opcion.etiqueta)
                                    }
                                }
                            }
                        }
                        if (fuente == FuenteBibliografia.Manual)
                            item {
                                FilledTonalButton(
                                    onClick = {
                                        if (consultada) seleccionar(objeto()) else capturar = true
                                    },
                                    enabled = !guardando,
                                    modifier = Modifier.fillMaxWidth(),
                                ) {
                                    Icon(Icons.Outlined.EditNote, null)
                                    Spacer(Modifier.width(8.dp))
                                    Text("Capturar referencia")
                                }
                            }
                        else {
                            item {
                                OutlinedTextField(
                                    consulta,
                                    { consulta = it },
                                    label = { Text("Título, autor o ISBN") },
                                    leadingIcon = { Icon(Icons.Outlined.Search, null) },
                                    enabled = !guardando,
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            }
                            if (resultados.cargando)
                                item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
                            if (resultados.error != null)
                                item {
                                    Aviso(
                                        resultados.error!!,
                                        reintentar = { vm.buscar(fuente, consulta) },
                                    )
                                }
                            if (resultados.datos?.isEmpty() == true)
                                item { Vacio("Sin referencias") }
                            itemsIndexed(resultados.datos.orEmpty()) { _, resultado ->
                                ListItem(
                                    headlineContent = {
                                        Text(resultado.texto("titulo").ifBlank { "Sin título" })
                                    },
                                    supportingContent = {
                                        Text(
                                            listOf(
                                                    resultado.textos("autores").joinToString(", "),
                                                    resultado.texto("anio"),
                                                    resultado.texto("fuente_busqueda"),
                                                )
                                                .filter(String::isNotBlank)
                                                .joinToString(" · ")
                                        )
                                    },
                                    leadingContent = {
                                        Icon(
                                            if (fuente == FuenteBibliografia.Biblioteca)
                                                Icons.Outlined.LocalLibrary
                                            else Icons.AutoMirrored.Outlined.MenuBook,
                                            null,
                                        )
                                    },
                                    trailingContent = { Icon(Icons.Outlined.ChevronRight, null) },
                                    modifier =
                                        Modifier.clickable(enabled = !guardando) {
                                            if (hayCambios) sustitucion = resultado.toString()
                                            else {
                                                seleccionar(resultado)
                                            }
                                        },
                                    colors =
                                        ListItemDefaults.colors(
                                            containerColor = MaterialTheme.colorScheme.background
                                        ),
                                )
                                HorizontalDivider()
                            }
                        }
                    } else {
                        if (original == null)
                            item {
                                TextButton(onClick = { capturar = false }, enabled = !guardando) {
                                    Text(
                                        if (consultada) "Elegir otra referencia"
                                        else "Cambiar método"
                                    )
                                }
                            }
                        if (consultada)
                            item {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    Icon(
                                        if (datos.texto("referencia_biblioteca").isNotBlank())
                                            Icons.Outlined.LocalLibrary
                                        else Icons.Outlined.Language,
                                        null,
                                        tint = MaterialTheme.colorScheme.primary,
                                    )
                                    Text(
                                        datos.texto("fuente_busqueda").ifBlank {
                                            if (datos.texto("referencia_biblioteca").isNotBlank())
                                                "Biblioteca La Salle"
                                            else "Fuente en línea"
                                        },
                                        style = MaterialTheme.typography.labelLarge,
                                    )
                                }
                            }
                        if (consultada) item { DatosReferenciaConsultada(datos) }
                        item {
                            SelectorBibliografico(
                                "Clasificación",
                                datos.texto("tipo", "BASICA"),
                                listOf("BASICA" to "Básica", "COMPLEMENTARIA" to "Complementaria"),
                                !guardando,
                            ) {
                                texto("tipo", it)
                            }
                        }
                        if (!consultada) {
                            item {
                                CampoTexto(
                                    "Título",
                                    datos.texto("titulo"),
                                    { texto("titulo", it) },
                                    habilitado = !guardando,
                                )
                            }
                            item {
                                CampoTexto(
                                    "Autores · uno por línea",
                                    datos.textos("autores").joinToString("\n"),
                                    {
                                        campo("autores", JsonArray(it.lines().map(::JsonPrimitive)))
                                    },
                                    multilinea = true,
                                    habilitado = !guardando,
                                )
                            }
                            item {
                                CampoTexto(
                                    "Editorial",
                                    datos.texto("editorial"),
                                    { texto("editorial", it) },
                                    habilitado = !guardando,
                                )
                            }
                            item {
                                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Column(Modifier.weight(1f)) {
                                        CampoTexto(
                                            "Año",
                                            datos.texto("anio"),
                                            { texto("anio", it.filter(Char::isDigit).take(4)) },
                                            true,
                                            habilitado = !guardando,
                                        )
                                    }
                                    Column(Modifier.weight(2f)) {
                                        CampoTexto(
                                            "ISBN",
                                            datos.texto("isbn"),
                                            { texto("isbn", it) },
                                            habilitado = !guardando,
                                        )
                                    }
                                }
                            }
                        }
                        item {
                            SelectorBibliografico(
                                "Formato de cita",
                                formato,
                                formatos,
                                !guardando,
                            ) {
                                formato = it
                                validacion = null
                            }
                        }
                        if (
                            !consultada &&
                                datos.texto("cita").isNotBlank() &&
                                formato != formatoCita
                        )
                            item {
                                Aviso(
                                    "Revisa la cita capturada: cambiar el formato no reformatea su contenido automáticamente.",
                                    error = false,
                                )
                            }
                        if (consultada)
                            item {
                                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    ) {
                                        Icon(
                                            Icons.Outlined.FormatQuote,
                                            null,
                                            tint = MaterialTheme.colorScheme.primary,
                                        )
                                        Text("Cita", style = MaterialTheme.typography.titleMedium)
                                    }
                                    if (citaCalculada.isFailure)
                                        Aviso(
                                            citaCalculada.exceptionOrNull()?.message
                                                ?: "No se pudo preparar la cita."
                                        )
                                    else
                                        SelectionContainer {
                                            Text(cita, style = MaterialTheme.typography.bodyLarge)
                                        }
                                }
                            }
                        else {
                            item {
                                CampoTexto(
                                    "Cita completa",
                                    cita,
                                    {
                                        texto("cita", it)
                                        formatoCita = formato
                                    },
                                    multilinea = true,
                                    habilitado = !guardando,
                                )
                            }
                            item {
                                CampoTexto(
                                    "Fuente en línea",
                                    datos.texto("referencia_en_linea"),
                                    { texto("referencia_en_linea", it) },
                                    habilitado = !guardando,
                                )
                            }
                        }
                        if (datos.texto("referencia_biblioteca").isNotBlank())
                            item {
                                Text(
                                    "Registro de biblioteca · ${datos.texto("referencia_biblioteca")}",
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                    }
                }
                if (validacion != null || (error != null && error != "Cambios guardados"))
                    Text(
                        validacion ?: error.orEmpty(),
                        Modifier.padding(horizontal = 24.dp),
                        color = MaterialTheme.colorScheme.error,
                    )
                if (capturar)
                    Button(
                        enabled = !guardando && (!consultada || citaCalculada.isSuccess),
                        modifier = Modifier.fillMaxWidth().padding(24.dp),
                        onClick = {
                            val anio = datos.texto("anio")
                            validacion =
                                when {
                                    datos.texto("titulo").isBlank() -> "Escribe el título."
                                    cita.isBlank() ->
                                        "Escribe la cita completa en el formato seleccionado."
                                    anio.isNotBlank() &&
                                        anio.toIntOrNull() !in 1450..Year.now().value + 1 ->
                                        "Revisa el año de publicación."
                                    datos.texto("referencia_en_linea") !=
                                        original?.texto("referencia_en_linea") &&
                                        !urlBibliograficaValida(
                                            datos.texto("referencia_en_linea")
                                        ) ->
                                        "Usa una URL completa http o https, o una referencia válida de Google Books u Open Library."
                                    else -> null
                                }
                            if (validacion == null)
                                guardar(
                                    objeto(
                                        "titulo" to datos.texto("titulo").trim(),
                                        "cita" to cita.trim(),
                                        "tipo" to datos.texto("tipo", "BASICA"),
                                        "formato" to formato.ifBlank { null },
                                        "autores" to
                                            JsonArray(
                                                datos.textos("autores").map {
                                                    JsonPrimitive(it.trim())
                                                }
                                            ),
                                        "editorial" to datos.texto("editorial").ifBlank { null },
                                        "anio" to anio.toIntOrNull(),
                                        "isbn" to datos.texto("isbn").ifBlank { null },
                                        "referencia_en_linea" to
                                            datos.texto("referencia_en_linea").ifBlank { null },
                                        "referencia_biblioteca" to
                                            datos.texto("referencia_biblioteca").ifBlank { null },
                                    )
                                )
                        },
                    ) {
                        if (guardando)
                            CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                        else Icon(Icons.Outlined.Check, null)
                        Spacer(Modifier.width(8.dp))
                        Text(
                            if (guardando) "Guardando…"
                            else if (consultada) "Aceptar referencia" else "Guardar referencia"
                        )
                    }
            }
        }
        if (descartar)
            AlertDialog(
                onDismissRequest = { descartar = false },
                title = { Text("¿Descartar cambios?") },
                text = { Text("La referencia aún no se ha guardado.") },
                confirmButton = { TextButton(onClick = cerrar) { Text("Descartar") } },
                dismissButton = {
                    TextButton(onClick = { descartar = false }) { Text("Seguir editando") }
                },
            )
        if (sustitucion != null)
            AlertDialog(
                onDismissRequest = { sustitucion = null },
                title = { Text("¿Sustituir la referencia?") },
                text = { Text("Se reemplazarán los datos y la cita aún no guardados.") },
                confirmButton = {
                    TextButton(
                        onClick = {
                            seleccionar(Json.parseToJsonElement(sustitucion!!).jsonObject)
                            sustitucion = null
                        }
                    ) {
                        Text("Sustituir")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { sustitucion = null }) { Text("Conservar referencia") }
                },
            )
    }
}

@Composable
private fun DatosReferenciaConsultada(datos: Registro) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SelectionContainer {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    datos.texto("titulo").ifBlank { "Sin título" },
                    style = MaterialTheme.typography.headlineSmall,
                )
                val autores = datos.textos("autores").joinToString("; ")
                if (autores.isNotBlank()) Text(autores, style = MaterialTheme.typography.bodyLarge)
                val publicacion =
                    listOf(datos.texto("editorial"), datos.texto("anio"))
                        .filter(String::isNotBlank)
                        .joinToString(" · ")
                if (publicacion.isNotBlank())
                    Text(publicacion, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (datos.texto("isbn").isNotBlank())
                    Text(
                        "ISBN ${datos.texto("isbn")}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
            }
        }
        val faltantes =
            listOfNotNull(
                "Sin autor".takeIf { datos.textos("autores").isEmpty() },
                "Sin año".takeIf { datos.texto("anio").isBlank() },
                "Sin editorial".takeIf { datos.texto("editorial").isBlank() },
            )
        if (faltantes.isNotEmpty())
            Text(
                faltantes.joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
    }
}

@Composable
private fun SelectorBibliografico(
    etiqueta: String,
    valor: String,
    opciones: List<Pair<String, String>>,
    habilitado: Boolean,
    seleccionar: (String) -> Unit,
) {
    if (habilitado) Selector(etiqueta, valor, opciones, seleccionar)
    else
        OutlinedTextField(
            value = opciones.firstOrNull { it.first == valor }?.second.orEmpty(),
            onValueChange = {},
            label = { Text(etiqueta) },
            readOnly = true,
            enabled = false,
            modifier = Modifier.fillMaxWidth(),
        )
}

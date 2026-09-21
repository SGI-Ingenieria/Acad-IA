@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package mx.sgi.acadia.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import mx.sgi.acadia.data.*

/**
 * The invitation and assignment are separate server contracts. Keep partial success in the VM so
 * retrying assignment never sends a second invitation after an acknowledged invitation.
 */
class ResponsablesViewModel(private val repo: RepositorioAcad, private val asignaturaId: String) :
    ViewModel() {
    val invitadoPendiente = MutableStateFlow<Registro?>(null)
    val ocupado = MutableStateFlow(false)
    val error = MutableStateFlow<String?>(null)

    fun asignar(usuarioId: String, completar: () -> Unit) =
        ejecutar(completar) {
            repo.asignarProfesorResponsable(asignaturaId, usuarioId)
        }

    fun invitar(nombre: String, correo: String, completar: () -> Unit) =
        ejecutar(completar) {
            completarInvitacionProfesor(
                invitadoPendiente.value,
                invitar = { repo.invitarProfesor(asignaturaId, nombre, correo) },
                recordarInvitado = { invitadoPendiente.value = it },
                asignar = { repo.asignarProfesorResponsable(asignaturaId, it) },
            )
            invitadoPendiente.value = null
        }

    private fun ejecutar(completar: () -> Unit, accion: suspend () -> Unit) {
        if (ocupado.value) return
        ocupado.value = true
        error.value = null
        viewModelScope.launch {
            try {
                accion()
                completar()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error.value = e.message ?: "No se pudo asignar al profesor."
            } finally {
                ocupado.value = false
            }
        }
    }
}

@Composable
fun ResponsablesAsignatura(
    repo: RepositorioAcad,
    asignaturaId: String,
    selectorAbierto: Boolean,
    cambiarSelectorAbierto: (Boolean) -> Unit,
) {
    val vm: ContenidoViewModel<DatosResponsables> =
        viewModel(
            key = "responsables-$asignaturaId",
            factory =
                fabrica {
                    ContenidoViewModel(
                        { repo.responsablesAsignatura(asignaturaId) },
                        repo,
                        listOf(
                            "responsables_asignatura",
                            "usuarios_app",
                            "asignaturas",
                            "planes_estudio",
                        ),
                    )
                },
        )
    val acciones: ResponsablesViewModel =
        viewModel(
            key = "asignar-responsable-$asignaturaId",
            factory = fabrica { ResponsablesViewModel(repo, asignaturaId) },
        )
    val estado by vm.estado.collectAsStateWithLifecycle()
    val ocupado by acciones.ocupado.collectAsStateWithLifecycle()
    val error by acciones.error.collectAsStateWithLifecycle()
    val invitado by acciones.invitadoPendiente.collectAsStateWithLifecycle()
    val datos = estado.datos
    LaunchedEffect(selectorAbierto) {
        if (selectorAbierto) acciones.error.value = null
    }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (estado.cargando && datos == null) LinearProgressIndicator(Modifier.fillMaxWidth())
        if (estado.error != null) {
            Aviso(estado.error!!)
            TextButton(onClick = vm::actualizar) { Text("Reintentar") }
        }
        if (datos != null) {
            if (datos.responsables.isEmpty())
                Text(
                    "Sin profesor asignado",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            datos.responsables.forEach { responsable ->
                val usuario =
                    datos.usuarios.firstOrNull { it.id == responsable.texto("usuario_id") }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    val nombre =
                        usuario
                            ?.texto("nombre_completo")
                            .orEmpty()
                            .ifBlank { responsable.objeto("usuario").texto("nombre_completo") }
                            .ifBlank { "Profesor asignado" }
                    AvatarAcademico(nombre, 32)
                    Column {
                        Text(nombre, style = MaterialTheme.typography.bodyLarge)
                        Text(
                            etiquetaRolResponsable(responsable.texto("rol")),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
    if (selectorAbierto && datos != null)
        SelectorProfesorResponsable(
            datos,
            ocupado,
            error,
            invitado,
            cerrar = { cambiarSelectorAbierto(false) },
            reintentar = vm::actualizar,
            asignar = { usuarioId ->
                acciones.asignar(usuarioId) {
                    cambiarSelectorAbierto(false)
                    vm.actualizar()
                }
            },
            invitar = { nombre, correo ->
                acciones.invitar(nombre, correo) {
                    cambiarSelectorAbierto(false)
                    vm.actualizar()
                }
            },
        )
}

@Composable
fun SelectorProfesorResponsable(
    datos: DatosResponsables,
    ocupado: Boolean,
    error: String?,
    invitadoPendiente: Registro?,
    cerrar: () -> Unit,
    reintentar: () -> Unit,
    asignar: (String) -> Unit,
    invitar: (String, String) -> Unit,
) {
    var invitando by rememberSaveable { mutableStateOf(invitadoPendiente != null) }
    var busqueda by rememberSaveable { mutableStateOf("") }
    var seleccionado by rememberSaveable { mutableStateOf<String?>(null) }
    var nombre by rememberSaveable { mutableStateOf("") }
    var correo by rememberSaveable { mutableStateOf("") }
    var descartar by rememberSaveable { mutableStateOf(false) }
    val conBorrador =
        invitando && (nombre.isNotBlank() || correo.isNotBlank()) && invitadoPendiente == null
    val solicitarCierre = {
        if (!ocupado) {
            if (conBorrador) descartar = true else cerrar()
        }
    }
    val sheet =
        rememberModalBottomSheetState(
            skipPartiallyExpanded = true,
            confirmValueChange = {
                if (it != SheetValue.Hidden) true
                else if (ocupado) false
                else if (conBorrador) {
                    descartar = true
                    false
                } else true
            },
        )
    ModalBottomSheet(onDismissRequest = solicitarCierre, sheetState = sheet) {
        BackHandler(ocupado || conBorrador) { solicitarCierre() }
        LazyColumn(
            Modifier.fillMaxWidth().imePadding(),
            contentPadding = PaddingValues(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        if (invitando) "Invitar profesor" else "Profesor responsable",
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.weight(1f),
                    )
                    AccionIcono(
                        "Cerrar responsables",
                        Icons.Outlined.Close,
                        !ocupado,
                        solicitarCierre,
                    )
                }
            }
            if (error != null) item { Aviso(error) }
            if (invitando) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        OutlinedTextField(
                            invitadoPendiente?.texto("nombre_completo") ?: nombre,
                            { nombre = it },
                            label = { Text("Nombre completo") },
                            enabled = !ocupado && invitadoPendiente == null,
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        OutlinedTextField(
                            invitadoPendiente?.texto("email")?.ifBlank { correo } ?: correo,
                            { correo = it },
                            label = { Text("Correo electrónico") },
                            enabled = !ocupado && invitadoPendiente == null,
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Button(
                            onClick = { invitar(nombre, correo) },
                            modifier = Modifier.fillMaxWidth(),
                            enabled =
                                datos.puedeInvitar &&
                                    !ocupado &&
                                    (invitadoPendiente != null ||
                                        validarInvitacionProfesor(nombre, correo) == null),
                        ) {
                            if (ocupado)
                                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                            else Icon(Icons.Outlined.PersonAdd, null)
                            Spacer(Modifier.width(8.dp))
                            Text(
                                if (invitadoPendiente != null) "Completar asignación"
                                else "Invitar y asignar"
                            )
                        }
                        if (invitadoPendiente == null)
                            TextButton(onClick = { invitando = false }, enabled = !ocupado) {
                                Text("Elegir profesor existente")
                            }
                    }
                }
            } else {
                item {
                    OutlinedTextField(
                        busqueda,
                        { busqueda = it },
                        singleLine = true,
                        enabled = !ocupado,
                        label = { Text("Buscar por nombre o correo") },
                        leadingIcon = { Icon(Icons.Outlined.Search, null) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                if (datos.errorDirectorio != null)
                    item {
                        Aviso(datos.errorDirectorio)
                        TextButton(onClick = reintentar, enabled = !ocupado) {
                            Text("Reintentar directorio")
                        }
                    }
                val candidatos = candidatosResponsables(datos, busqueda)
                if (!datos.puedeConsultarDirectorio)
                    item { Aviso("Tu cuenta no puede consultar el directorio de profesores.") }
                else if (candidatos.isEmpty() && datos.errorDirectorio == null)
                    item { Text("Sin coincidencias") }
                items(candidatos, key = { it.id }) { profesor ->
                    ListItem(
                        headlineContent = {
                            Text(
                                profesor.texto("nombre_completo").ifBlank {
                                    profesor.texto("email")
                                }
                            )
                        },
                        supportingContent = { Text(profesor.texto("email")) },
                        trailingContent = {
                            RadioButton(selected = seleccionado == profesor.id, onClick = null)
                        },
                        modifier =
                            Modifier.selectable(
                                    selected = seleccionado == profesor.id,
                                    enabled = !ocupado,
                                    role = Role.RadioButton,
                                ) {
                                    seleccionado = profesor.id
                                }
                                .testTag("profesor-${profesor.id}"),
                        colors =
                            ListItemDefaults.colors(
                                containerColor = MaterialTheme.colorScheme.surfaceContainerLow
                            ),
                    )
                }
                item {
                    Button(
                        onClick = { seleccionado?.let(asignar) },
                        enabled =
                            datos.puedeGestionar &&
                                !ocupado &&
                                candidatos.any { it.id == seleccionado },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        if (ocupado)
                            CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                        else Icon(Icons.Outlined.Check, null)
                        Spacer(Modifier.width(8.dp))
                        Text("Asignar profesor")
                    }
                    if (datos.puedeInvitar)
                        TextButton(
                            onClick = { invitando = true },
                            enabled = !ocupado,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Icon(Icons.Outlined.PersonAdd, null)
                            Spacer(Modifier.width(8.dp))
                            Text("Invitar por correo")
                        }
                }
            }
        }
    }
    if (descartar)
        AlertDialog(
            onDismissRequest = { descartar = false },
            title = { Text("¿Descartar invitación?") },
            text = { Text("Todavía no se ha enviado ningún correo.") },
            confirmButton = { TextButton(onClick = cerrar) { Text("Descartar") } },
            dismissButton = {
                TextButton(onClick = { descartar = false }) { Text("Seguir editando") }
            },
        )
}

@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package mx.sgi.acadia.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.edit
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.compose.*
import androidx.navigation.toRoute
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.Serializable
import mx.sgi.acadia.BuildConfig
import mx.sgi.acadia.R
import mx.sgi.acadia.data.*

@Serializable data object Inicio

@Serializable data object Planes

@Serializable data object Asignaturas

@Serializable data object Actividad

@Serializable data object Cuenta

@Serializable data class Detalle(val id: String, val asignatura: Boolean = false)

@Serializable data class Nuevo(val planId: String = "")

@Serializable data class Catalogo(val tabla: String, val titulo: String)

@Serializable data class Conversaciones(val id: String, val asignatura: Boolean)

@Serializable data class Conversacion(val id: String, val asignatura: Boolean)

@Composable
fun AcadApp(repo: RepositorioAcad) {
    val context = LocalContext.current
    val preferencias = remember { context.getSharedPreferences("apariencia", 0) }
    var modo by rememberSaveable {
        mutableStateOf(preferencias.getString("tema", "sistema") ?: "sistema")
    }
    val vm: SesionViewModel = viewModel(factory = fabrica { SesionViewModel(repo) })
    val sesion by vm.sesion.collectAsStateWithLifecycle()
    val iniciando by vm.iniciando.collectAsStateWithLifecycle()
    val ocupado by vm.ocupado.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    TemaAcad(modo) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            when {
                iniciando ->
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                sesion == null -> Acceso(vm)
                else ->
                    key(sesion!!.id) {
                        Aplicacion(
                            repo,
                            sesion!!,
                            modo,
                            {
                                modo = it
                                preferencias.edit { putString("tema", it) }
                            },
                            vm::salir,
                        )
                    }
            }
        }
        if (sesion != null && ocupado)
            AlertDialog(
                onDismissRequest = {},
                title = { Text("Actualizando sesión") },
                text = { LinearProgressIndicator(Modifier.fillMaxWidth()) },
                confirmButton = {},
            )
        else if (sesion != null && error != null)
            AlertDialog(
                onDismissRequest = { vm.error.value = null },
                title = { Text("No se pudo completar") },
                text = { Text(error!!) },
                confirmButton = {
                    TextButton(onClick = { vm.error.value = null }) { Text("Entendido") }
                },
            )
    }
}

@Composable
private fun Acceso(vm: SesionViewModel) {
    var identificador by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var visible by remember { mutableStateOf(false) }
    var institucional by rememberSaveable { mutableStateOf(false) }
    val ocupado by vm.ocupado.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    val foco = LocalFocusManager.current
    fun entrar() {
        foco.clearFocus()
        vm.entrar(identificador, password, institucional)
    }
    Box(
        Modifier.fillMaxSize().safeDrawingPadding().imePadding(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier.widthIn(max = 480.dp)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(32.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Icon(
                painterResource(R.drawable.ic_acadia),
                null,
                Modifier.size(64.dp),
                tint = androidx.compose.ui.graphics.Color.Unspecified,
            )
            Spacer(Modifier.height(16.dp))
            Text("Acad-IA", style = MaterialTheme.typography.displayMedium)
            Text(
                "Diseño académico",
                style = MaterialTheme.typography.headlineSmall.copy(fontFamily = IndivisaSerif),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (BuildConfig.LOCAL_PREVIEW) EtiquetaEstado("Preview · Supabase local")
            Spacer(Modifier.height(8.dp))
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                listOf("Externo", "Institucional").forEachIndexed { i, label ->
                    SegmentedButton(
                        selected = institucional == (i == 1),
                        onClick = { institucional = i == 1 },
                        shape = SegmentedButtonDefaults.itemShape(i, 2),
                    ) {
                        Text(label)
                    }
                }
            }
            OutlinedTextField(
                identificador,
                { identificador = it },
                label = { Text(if (institucional) "Clave La Salle" else "Correo electrónico") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions =
                    KeyboardOptions(
                        keyboardType = if (institucional) KeyboardType.Text else KeyboardType.Email
                    ),
            )
            OutlinedTextField(
                password,
                { password = it },
                label = { Text("Contraseña") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation =
                    if (visible) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions =
                    KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done,
                    ),
                keyboardActions =
                    KeyboardActions(
                        onDone = {
                            if (!ocupado && identificador.isNotBlank() && password.isNotBlank())
                                entrar()
                        }
                    ),
                trailingIcon = {
                    AccionIcono(
                        if (visible) "Ocultar contraseña" else "Mostrar contraseña",
                        if (visible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                    ) {
                        visible = !visible
                    }
                },
            )
            if (error != null) Aviso(error!!)
            Button(
                onClick = ::entrar,
                enabled =
                    !ocupado &&
                        identificador.isNotBlank() &&
                        password.isNotBlank() &&
                        vm.repo.configurado,
                modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
            ) {
                if (ocupado) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                else Text("Entrar a Acad-IA")
            }
            if (!institucional)
                TextButton(
                    onClick = { vm.recuperar(identificador) },
                    enabled = !ocupado && identificador.contains('@'),
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                ) {
                    Text("Recuperar contraseña")
                }
        }
    }
}

@Composable
private fun Aplicacion(
    repo: RepositorioAcad,
    sesion: Sesion,
    modo: String,
    tema: (String) -> Unit,
    salir: () -> Unit,
) {
    val nav = rememberNavController()
    val actual by nav.currentBackStackEntryAsState()
    val destino = actual?.destination
    val raices = listOf(Inicio, Planes, Asignaturas, Actividad, Cuenta)
    val etiquetas = listOf("Inicio", "Planes", "Asignaturas", "Actividad", "Cuenta")
    val iconos =
        listOf(
            Icons.Outlined.SpaceDashboard,
            Icons.Outlined.AutoStories,
            Icons.Outlined.School,
            Icons.Outlined.Notifications,
            Icons.Outlined.PersonOutline,
        )
    val esRaiz = destino == null || raices.any { destino.hasRoute(it::class) }
    BoxWithConstraints {
        val amplio = maxWidth >= 840.dp
        val navegar: (Any) -> Unit = { ruta ->
            nav.navigate(ruta) {
                popUpTo<Inicio> { saveState = true }
                launchSingleTop = true
                restoreState = true
            }
        }
        Row {
            if (amplio)
                NavigationRail(
                    containerColor = MaterialTheme.colorScheme.surfaceContainerLow,
                    modifier = Modifier.fillMaxHeight(),
                ) {
                    Spacer(Modifier.height(24.dp))
                    Icon(
                        painterResource(R.drawable.ic_acadia),
                        null,
                        Modifier.size(40.dp),
                        tint = androidx.compose.ui.graphics.Color.Unspecified,
                    )
                    Spacer(Modifier.height(24.dp))
                    raices.forEachIndexed { i, ruta ->
                        NavigationRailItem(
                            selected = destino?.hasRoute(ruta::class) == true,
                            onClick = { navegar(ruta) },
                            icon = { Icon(iconos[i], null) },
                            label = {
                                Text(etiquetas[i], maxLines = 1, overflow = TextOverflow.Ellipsis)
                            },
                        )
                    }
                }
            Scaffold(
                contentWindowInsets = WindowInsets(0, 0, 0, 0),
                bottomBar = {
                    if (!amplio && esRaiz)
                        NavigationBar(
                            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
                        ) {
                            raices.forEachIndexed { i, ruta ->
                                NavigationBarItem(
                                    selected = destino?.hasRoute(ruta::class) == true,
                                    onClick = { navegar(ruta) },
                                    icon = { Icon(iconos[i], null) },
                                    label = {
                                        Text(
                                            etiquetas[i],
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                    },
                                )
                            }
                        }
                },
            ) { padding ->
                NavHost(
                    navController = nav,
                    startDestination = Inicio,
                    modifier = Modifier.padding(padding),
                ) {
                    composable<Inicio> {
                        InicioPantalla(
                            repo,
                            sesion,
                            { nav.navigate(Detalle(it)) },
                            { nav.navigate(Nuevo()) },
                            { navegar(Planes) },
                        )
                    }
                    composable<Planes> {
                        CatalogoAcademico(
                            repo,
                            false,
                            { nav.navigate(Detalle(it)) },
                            { nav.navigate(Nuevo()) },
                            sesion.permite(Permiso.CrearPlanes),
                        )
                    }
                    composable<Asignaturas> {
                        CatalogoAcademico(
                            repo,
                            true,
                            { nav.navigate(Detalle(it, true)) },
                            {},
                            false,
                        )
                    }
                    composable<Actividad> { ActividadPantalla(repo) }
                    composable<Cuenta> {
                        CuentaPantalla(sesion, modo, tema, salir) { tabla, titulo ->
                            nav.navigate(Catalogo(tabla, titulo))
                        }
                    }
                    composable<Detalle> { entry ->
                        val route = entry.toRoute<Detalle>()
                        ExpedientePantalla(
                            repo,
                            route,
                            sesion,
                            { nav.popBackStack() },
                            { nav.navigate(Detalle(it, true)) },
                            { nav.navigate(Nuevo(it)) },
                            { nav.navigate(Conversaciones(route.id, route.asignatura)) },
                        )
                    }
                    composable<Nuevo> { entry ->
                        NuevoPantalla(
                            repo,
                            entry.toRoute<Nuevo>().planId,
                            { nav.popBackStack() },
                        ) { id, materia ->
                            nav.navigate(Detalle(id, materia)) {
                                popUpTo<Nuevo> { inclusive = true }
                            }
                        }
                    }
                    composable<Catalogo> { entry ->
                        val route = entry.toRoute<Catalogo>()
                        CatalogoInstitucional(repo, route, sesion) { nav.popBackStack() }
                    }
                    composable<Conversaciones> { entry ->
                        ConversacionesPantalla(
                            repo,
                            entry.toRoute<Conversaciones>(),
                            { nav.popBackStack() },
                        ) { id, materia ->
                            nav.navigate(Conversacion(id, materia))
                        }
                    }
                    composable<Conversacion> { entry ->
                        ConversacionPantalla(repo, entry.toRoute<Conversacion>()) {
                            nav.popBackStack()
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun InicioPantalla(
    repo: RepositorioAcad,
    sesion: Sesion,
    abrir: (String) -> Unit,
    nuevo: () -> Unit,
    todos: () -> Unit,
) {
    val vm: ContenidoViewModel<List<Registro>> =
        viewModel(
            factory =
                fabrica {
                    ContenidoViewModel(
                        { repo.planes() },
                        repo,
                        listOf("planes_estudio", "carreras", "facultades"),
                    )
                }
        )
    val estado by vm.estado.collectAsStateWithLifecycle()
    Pagina(
        "Acad-IA",
        mostrarBarra = false,
    ) { padding ->
        Box(Modifier.padding(padding)) {
            Carga(estado, vm::actualizar) { planes ->
                LazyColumn(
                    Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(24.dp),
                    verticalArrangement = Arrangement.spacedBy(24.dp),
                ) {
                    item {
                        Surface(
                            color = MaterialTheme.colorScheme.primary,
                            shape = RoundedCornerShape(24.dp),
                        ) {
                            Column(
                                Modifier.fillMaxWidth().padding(24.dp),
                                verticalArrangement = Arrangement.spacedBy(20.dp),
                            ) {
                                Text(
                                    "Arquitectura del aprendizaje",
                                    style =
                                        MaterialTheme.typography.headlineSmall.copy(
                                            fontFamily = IndivisaSerif
                                        ),
                                    color = MaterialTheme.colorScheme.onPrimary,
                                )
                                Text(
                                    "${planes.size}${if(planes.size == 30) "+" else ""} ${if(planes.size == 1) "plan" else "planes"} en tu catálogo",
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = MaterialTheme.colorScheme.onPrimary,
                                )
                                Button(
                                    onClick = todos,
                                    colors =
                                        ButtonDefaults.buttonColors(
                                            containerColor = MaterialTheme.colorScheme.surface,
                                            contentColor = MaterialTheme.colorScheme.primary,
                                        ),
                                ) {
                                    Text("Explorar planes")
                                    Spacer(Modifier.width(8.dp))
                                    Icon(Icons.Outlined.ArrowOutward, null)
                                }
                            }
                        }
                    }
                    item {
                        Encabezado(
                            "Planes recientes",
                            null,
                            if (sesion.permite(Permiso.CrearPlanes)) {
                                { AccionIcono("Nuevo plan", Icons.Outlined.Add, accion = nuevo) }
                            } else null,
                        )
                    }
                    if (planes.isEmpty())
                        item {
                            Vacio(
                                "Crea tu primer plan",
                                accion =
                                    if (sesion.permite(Permiso.CrearPlanes)) {
                                        { Button(nuevo) { Text("Crear plan") } }
                                    } else null,
                            )
                        }
                    items(planes.take(5), key = { it.id }) { FilaPlan(it) { abrir(it.id) } }
                }
            }
        }
    }
}

@OptIn(kotlinx.coroutines.FlowPreview::class)
private class CatalogoViewModel(val repo: RepositorioAcad, val materia: Boolean) :
    androidx.lifecycle.ViewModel() {
    val busqueda = MutableStateFlow("")
    val estado = MutableStateFlow(EstadoCarga<List<Registro>>())
    val hayMas = MutableStateFlow(false)
    private var trabajo: Job? = null
    private var consultaCargada: String? = null
    private var siguienteOffset = 0L

    init {
        viewModelScopeCompat {
            busqueda.debounce(300).distinctUntilChanged().collect { cargar(false) }
        }
        viewModelScopeCompat {
            repo
                .cambios(listOf("planes_estudio", "asignaturas", "carreras", "facultades"))
                .debounce(200)
                .collect { cargar(false) }
        }
    }

    private fun viewModelScopeCompat(block: suspend CoroutineScope.() -> Unit) =
        viewModelScope.launch(block = block)

    fun cargar(mas: Boolean) {
        trabajo?.cancel()
        trabajo = viewModelScopeCompat {
            val consulta = busqueda.value
            val mismaConsulta = consultaCargada == consulta
            val ampliar = mas && mismaConsulta
            val previos = if (ampliar) estado.value.datos.orEmpty() else emptyList()
            val objetivo =
                if (!ampliar && mismaConsulta) estado.value.datos.orEmpty().size.coerceAtLeast(30)
                else 30
            estado.value = estado.value.copy(cargando = true, error = null)
            try {
                val data = mutableListOf<Registro>()
                var offset = if (ampliar) siguienteOffset else 0L
                var ultimaPagina: List<Registro>
                do {
                    ultimaPagina =
                        if (materia) repo.asignaturas(consulta, offset)
                        else repo.planes(consulta, offset)
                    data.addAll(ultimaPagina)
                    offset += ultimaPagina.size
                } while (!ampliar && data.size < objetivo && ultimaPagina.size == 30)
                estado.value =
                    EstadoCarga(
                        (previos + data).distinctBy {
                            if (materia) it.texto("asignatura_id") else it.id
                        },
                        false,
                    )
                hayMas.value = ultimaPagina.size == 30
                siguienteOffset = offset
                consultaCargada = consulta
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                estado.value = estado.value.copy(cargando = false, error = e.message)
            }
        }
    }
}

@Composable
private fun CatalogoAcademico(
    repo: RepositorioAcad,
    materia: Boolean,
    abrir: (String) -> Unit,
    nuevo: () -> Unit,
    crear: Boolean,
) {
    val vm: CatalogoViewModel = viewModel(factory = fabrica { CatalogoViewModel(repo, materia) })
    val estado by vm.estado.collectAsStateWithLifecycle()
    val busqueda by vm.busqueda.collectAsStateWithLifecycle()
    val mas by vm.hayMas.collectAsStateWithLifecycle()
    Pagina(
        if (materia) "Asignaturas" else "Planes de estudio",
        acciones = {
            if (crear) AccionIcono("Nuevo plan", Icons.Outlined.Add, accion = nuevo)
        },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            OutlinedTextField(
                busqueda,
                { vm.busqueda.value = it },
                label = { Text(if (materia) "Buscar asignaturas" else "Buscar planes") },
                leadingIcon = { Icon(Icons.Outlined.Search, null) },
                singleLine = true,
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp).fillMaxWidth(),
            )
            Carga(estado, { vm.cargar(false) }) { registros ->
                LazyColumn(
                    Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp),
                ) {
                    if (registros.isEmpty())
                        item {
                            Vacio(
                                if (busqueda.isBlank())
                                    "Sin ${if(materia) "asignaturas" else "planes"}"
                                else "Sin resultados"
                            )
                        }
                    items(registros, key = { if (materia) it.texto("asignatura_id") else it.id }) {
                        row ->
                        if (materia) FilaAsignatura(row) { abrir(row.texto("asignatura_id")) }
                        else FilaPlan(row) { abrir(row.id) }
                    }
                    if (mas)
                        item {
                            TextButton(
                                onClick = { vm.cargar(true) },
                                enabled = !estado.cargando,
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text("Cargar más")
                            }
                        }
                }
            }
        }
    }
}

@Composable
private fun CuentaPantalla(
    sesion: Sesion,
    modo: String,
    tema: (String) -> Unit,
    salir: () -> Unit,
    catalogo: (String, String) -> Unit,
) {
    var confirmar by remember { mutableStateOf(false) }
    Pagina("Cuenta") { padding ->
        LazyColumn(
            Modifier.padding(padding),
            contentPadding = PaddingValues(24.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            item {
                Encabezado(
                    sesion.nombre.ifBlank { sesion.correo.substringBefore('@') },
                    "Tu cuenta",
                )
                Text(sesion.correo, style = MaterialTheme.typography.bodyMedium)
            }
            item {
                Text(
                    sesion.roles.joinToString(" · ").ifBlank { "Sin rol asignado" },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            item {
                Selector(
                    "Apariencia",
                    modo,
                    listOf(
                        "sistema" to "Seguir el sistema",
                        "claro" to "Claro",
                        "oscuro" to "Oscuro",
                    ),
                    tema,
                )
            }
            item { Encabezado("Institución") }
            item {
                ListItem(
                    headlineContent = { Text("Registros oficiales") },
                    leadingContent = { Icon(Icons.Outlined.Verified, null) },
                    modifier =
                        Modifier.clickable {
                            catalogo("registros_oficiales_plan_detalle", "Registros oficiales")
                        },
                )
            }
            if (sesion.permite(Permiso.Catalogos)) {
                item {
                    ListItem(
                        headlineContent = { Text("Facultades") },
                        leadingContent = { Icon(Icons.Outlined.AccountBalance, null) },
                        modifier = Modifier.clickable { catalogo("facultades", "Facultades") },
                    )
                }
                item {
                    ListItem(
                        headlineContent = { Text("Carreras") },
                        leadingContent = { Icon(Icons.Outlined.School, null) },
                        modifier = Modifier.clickable { catalogo("carreras", "Carreras") },
                    )
                }
                item {
                    ListItem(
                        headlineContent = { Text("Estructuras académicas") },
                        leadingContent = { Icon(Icons.Outlined.Schema, null) },
                        modifier =
                            Modifier.clickable {
                                catalogo("estructuras_plan", "Estructuras académicas")
                            },
                    )
                }
            }
            item {
                HorizontalDivider()
                Spacer(Modifier.height(16.dp))
                Text(
                    if (BuildConfig.LOCAL_PREVIEW) "Conectado a Supabase local · API 54321"
                    else "Acad-IA Android",
                    style = MaterialTheme.typography.bodySmall,
                )
                Text(
                    "Versión ${BuildConfig.VERSION_NAME}",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            item {
                OutlinedButton(onClick = { confirmar = true }) {
                    Icon(Icons.AutoMirrored.Outlined.Logout, null)
                    Spacer(Modifier.width(8.dp))
                    Text("Cerrar sesión")
                }
            }
        }
    }
    if (confirmar)
        AlertDialog(
            onDismissRequest = { confirmar = false },
            title = { Text("¿Cerrar sesión?") },
            text = { Text("Se cerrará esta sesión en el dispositivo.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmar = false
                        salir()
                    }
                ) {
                    Text("Cerrar sesión")
                }
            },
            dismissButton = { TextButton(onClick = { confirmar = false }) { Text("Volver") } },
        )
}

@Composable
private fun ActividadPantalla(repo: RepositorioAcad) {
    val vm: ContenidoViewModel<List<Registro>> =
        viewModel(
            factory =
                fabrica {
                    ContenidoViewModel({ repo.notificaciones() }, repo, listOf("notificaciones"))
                }
        )
    val estado by vm.estado.collectAsStateWithLifecycle()
    val mensaje by vm.mensaje.collectAsStateWithLifecycle()
    Pagina("Actividad") { padding ->
        Box(Modifier.padding(padding)) {
            Carga(estado, vm::actualizar) { rows ->
                LazyColumn(
                    contentPadding = PaddingValues(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    if (mensaje != null) item { Aviso(mensaje!!, false) }
                    if (rows.isEmpty()) item { Vacio("Todo al día", Icons.Outlined.TaskAlt) }
                    items(rows, key = { it.id }) { row ->
                        val payload = row.objeto("payload")
                        ListItem(
                            headlineContent = {
                                Text(
                                    payload.texto("titulo").ifBlank {
                                        etiquetaCampo(row.texto("tipo"))
                                    }
                                )
                            },
                            supportingContent = {
                                Text(payload.texto("mensaje").ifBlank { payload.texto("cuerpo") })
                            },
                            trailingContent = {
                                if (!row.booleano("leida"))
                                    AccionIcono("Marcar como leída", Icons.Outlined.Done) {
                                        vm.guardar({ repo.leerNotificacion(row.id) })
                                    }
                            },
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

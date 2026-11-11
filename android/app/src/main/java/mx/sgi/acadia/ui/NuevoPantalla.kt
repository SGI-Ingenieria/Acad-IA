package mx.sgi.acadia.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import java.time.LocalDate
import java.util.UUID
import mx.sgi.acadia.data.*

private data class OpcionesNuevo(
    val ambito: AmbitoAltaPlan = AmbitoAltaPlan(emptyList(), emptyList()),
    val estructuras: List<Registro>,
    val plan: Registro? = null,
)

@Composable
fun NuevoPantalla(
    repo: RepositorioAcad,
    planId: String,
    atras: () -> Unit,
    creado: (String, Boolean) -> Unit,
) {
    val materia = planId.isNotBlank()
    val solicitudId = rememberSaveable { UUID.randomUUID().toString() }
    val vm: ContenidoViewModel<OpcionesNuevo> =
        viewModel(
            factory =
                fabrica {
                    ContenidoViewModel({
                        if (materia) {
                            val plan = repo.uno("planes_estudio", planId)
                            OpcionesNuevo(
                                estructuras =
                                    repo.filas(
                                        "estructuras_asignatura",
                                        "estructura_plan_id",
                                        plan.texto("estructura_id"),
                                        "nombre",
                                    ),
                                plan = plan,
                            )
                        } else
                            OpcionesNuevo(repo.ambitoAltaPlan(), repo.catalogos("estructuras_plan"))
                    })
                }
        )
    val estado by vm.estado.collectAsStateWithLifecycle()
    val ocupado by vm.guardando.collectAsStateWithLifecycle()
    val error by vm.mensaje.collectAsStateWithLifecycle()
    var facultad by rememberSaveable { mutableStateOf("") }
    var carrera by rememberSaveable { mutableStateOf("") }
    var estructura by rememberSaveable { mutableStateOf("") }
    var nombre by rememberSaveable { mutableStateOf("") }
    var codigo by rememberSaveable { mutableStateOf("") }
    var ciclos by rememberSaveable { mutableStateOf<String?>(if (materia) "1" else null) }
    var semanas by rememberSaveable { mutableStateOf<String?>(null) }
    var fecha by rememberSaveable {
        mutableStateOf(LocalDate.now().plusMonths(1).withDayOfMonth(1).toString())
    }
    var tipo by rememberSaveable { mutableStateOf<String?>(null) }
    var modificado by rememberSaveable { mutableStateOf(false) }
    var salir by rememberSaveable { mutableStateOf(false) }
    var validacion by rememberSaveable { mutableStateOf<String?>(null) }
    val cerrar = {
        if (!ocupado) {
            if (modificado) salir = true else atras()
        }
    }
    BackHandler { cerrar() }
    Pagina(if (materia) "Nueva asignatura" else "Nuevo plan", cerrar) { padding ->
        Box(Modifier.padding(padding)) {
            Carga(estado, vm::actualizar) { opciones ->
                val facultadId = facultad.ifBlank {
                    opciones.ambito.facultades.singleOrNull()?.id.orEmpty()
                }
                val facultadActual = opciones.ambito.facultades.find { it.id == facultadId }
                val carreras =
                    opciones.ambito.carreras.filter { it.texto("facultad_id") == facultadId }
                val carreraActual = carreras.find { it.id == carrera } ?: carreras.singleOrNull()
                val estructuraActual =
                    opciones.estructuras.find { it.id == estructura }
                        ?: opciones.estructuras.singleOrNull()
                val propuesta = carreraActual?.let(::ciclosPropuestos)
                val ciclosActuales = ciclos ?: propuesta?.ciclos?.toString().orEmpty()
                val semanasActuales = semanas ?: propuesta?.semanas?.toString().orEmpty()
                val tipoActual = tipo ?: propuesta?.tipo ?: "Semestre"
                val curricular = !materia && estructuraActual?.texto("tipo") == "CURRICULAR"
                LazyColumn(
                    modifier = Modifier.imePadding(),
                    contentPadding = PaddingValues(24.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                ) {
                    if (materia)
                        item {
                            opciones.plan?.let {
                                Text(it.nombre, style = MaterialTheme.typography.titleMedium)
                            }
                        }
                    if (!materia) {
                        item {
                            SelectorFacultad(opciones.ambito.facultades, facultadId, !ocupado) {
                                facultad = it
                                carrera = ""
                                ciclos = null
                                semanas = null
                                tipo = null
                                modificado = true
                            }
                        }
                        item {
                            SelectorCarrera(
                                carreras,
                                facultadActual,
                                carreraActual?.id.orEmpty(),
                                !ocupado,
                            ) { id ->
                                carrera = id
                                val siguiente = ciclosPropuestos(carreras.first { it.id == id })
                                ciclos = siguiente.ciclos.toString()
                                semanas = siguiente.semanas?.toString().orEmpty()
                                tipo = siguiente.tipo
                                modificado = true
                            }
                        }
                        if (opciones.ambito.carreras.isEmpty())
                            item { Aviso("No tienes carreras habilitadas para crear planes.") }
                    }
                    item {
                        Selector(
                            "Estructura académica",
                            estructuraActual?.id.orEmpty(),
                            opciones.estructuras.map { it.id to it.nombre },
                        ) {
                            estructura = it
                            modificado = true
                        }
                    }
                    if (!curricular)
                        item {
                            CampoTexto(
                                "Nombre",
                                nombre,
                                {
                                    nombre = it
                                    modificado = true
                                },
                            )
                        }
                    if (materia)
                        item {
                            CampoTexto(
                                "Código",
                                codigo,
                                {
                                    codigo = it
                                    modificado = true
                                },
                            )
                        }
                    if (curricular)
                        item {
                            SelectorMesAnio(fecha, !ocupado) {
                                fecha = it
                                modificado = true
                            }
                        }
                    item {
                        CampoTexto(
                            if (materia) "Ciclo" else "Número de ciclos",
                            ciclosActuales,
                            {
                                ciclos = it
                                modificado = true
                            },
                            true,
                        )
                    }
                    if (!materia) {
                        item {
                            Selector(
                                "Periodicidad",
                                tipoActual,
                                listOf("Semestre", "Cuatrimestre", "Trimestre", "Otro").map {
                                    it to it
                                },
                            ) {
                                tipo = it
                                modificado = true
                            }
                        }
                        item {
                            CampoTexto(
                                "Semanas por ciclo",
                                semanasActuales,
                                {
                                    semanas = it
                                    modificado = true
                                },
                                true,
                            )
                        }
                    }
                    if (validacion != null || error != null) item { Aviso(validacion ?: error!!) }
                    item {
                        Button(
                            enabled =
                                !ocupado &&
                                    estructuraActual != null &&
                                    (materia || carreraActual != null),
                            modifier = Modifier.fillMaxWidth(),
                            onClick = {
                                validacion =
                                    when {
                                        ciclosActuales.toIntOrNull()?.let { it in 1..30 } != true ->
                                            "Indica entre 1 y 30 ciclos."
                                        !materia &&
                                            semanasActuales.toIntOrNull()?.let { it in 1..52 } !=
                                                true -> "Indica entre 1 y 52 semanas por ciclo."
                                        !curricular && nombre.isBlank() -> "Escribe el nombre."
                                        curricular -> Validacion.fechaCurricular(fecha)
                                        else -> null
                                    }
                                if (validacion == null) {
                                    var nuevoId = ""
                                    vm.guardar(
                                        {
                                            val nuevo =
                                                if (materia)
                                                    repo.crearAsignatura(
                                                        opciones.plan!!,
                                                        estructuraActual!!.id,
                                                        nombre,
                                                        codigo,
                                                        ciclosActuales.toInt(),
                                                        solicitudId,
                                                    )
                                                else
                                                    repo.crearPlan(
                                                        carreraActual!!,
                                                        estructuraActual!!,
                                                        nombre,
                                                        fecha,
                                                        ciclosActuales.toInt(),
                                                        semanasActuales.toInt(),
                                                        tipoActual,
                                                        solicitudId,
                                                    )
                                            nuevoId = nuevo.id
                                        },
                                        { creado(nuevoId, materia) },
                                    )
                                }
                            },
                        ) {
                            if (ocupado)
                                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                            else Icon(Icons.Outlined.Add, null)
                            Spacer(Modifier.width(8.dp))
                            Text(if (materia) "Crear asignatura" else "Crear plan")
                        }
                    }
                }
            }
        }
    }
    if (salir)
        AlertDialog(
            onDismissRequest = { salir = false },
            title = {
                Text(
                    "¿Descartar este ${if (materia) "borrador de asignatura" else "borrador de plan"}?"
                )
            },
            text = { Text("Los datos que escribiste todavía no se han guardado.") },
            confirmButton = {
                TextButton(onClick = atras) {
                    Text("Descartar", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { salir = false }) { Text("Seguir editando") } },
        )
}

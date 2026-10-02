package mx.sgi.acadia.ui

import androidx.compose.animation.AnimatedVisibility
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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import mx.sgi.acadia.data.*

@Composable
fun CatalogoInstitucional(
    repo: RepositorioAcad,
    ruta: Catalogo,
    sesion: Sesion,
    atras: () -> Unit,
) {
    val permitido =
        ruta.tabla == "registros_oficiales_plan_detalle" || sesion.permite(Permiso.Catalogos)
    val vm: ContenidoViewModel<List<Registro>> =
        viewModel(
            factory =
                fabrica {
                    ContenidoViewModel(
                        {
                            if (!permitido)
                                throw FalloAcad(
                                    CategoriaError.Permiso,
                                    "Tu cuenta no tiene acceso a este catálogo.",
                                )
                            when (ruta.tabla) {
                                "registros_oficiales_plan_detalle" -> repo.registros()
                                "estructuras_plan" ->
                                    repo.filas(
                                        "estructuras_plan",
                                        orden = "nombre",
                                        columnas = "*,estructuras_asignatura(*)",
                                    )
                                "facultades" ->
                                    repo.filas(
                                        "facultades",
                                        orden = "nombre",
                                        columnas = "*,carreras(*)",
                                    )
                                "carreras" ->
                                    repo.filas(
                                        "carreras",
                                        orden = "nombre",
                                        columnas = "*,facultades(*)",
                                    )
                                else -> repo.catalogos(ruta.tabla)
                            }
                        },
                        repo,
                        when (ruta.tabla) {
                            "registros_oficiales_plan_detalle" -> listOf("registros_oficiales_plan")
                            "estructuras_plan" ->
                                listOf("estructuras_plan", "estructuras_asignatura")
                            "carreras",
                            "facultades" -> listOf("carreras", "facultades")
                            else -> listOf(ruta.tabla)
                        },
                    )
                }
        )
    val estado by vm.estado.collectAsStateWithLifecycle()
    var busqueda by rememberSaveable { mutableStateOf("") }
    var estructuraSeleccionada by rememberSaveable { mutableStateOf<String?>(null) }
    val esEstructura = ruta.tabla in setOf("estructuras_plan", "estructuras_asignatura")
    Pagina(ruta.titulo, atras) { padding ->
        Column(Modifier.padding(padding)) {
            OutlinedTextField(
                busqueda,
                { busqueda = it },
                label = { Text("Buscar en el catálogo") },
                leadingIcon = { Icon(Icons.Outlined.Search, null) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 16.dp),
                singleLine = true,
            )
            Carga(estado, vm::actualizar) { rows ->
                val visibles = rows.filter {
                    normalizarBusqueda(it.toString()).contains(normalizarBusqueda(busqueda))
                }
                val fila: @Composable (Registro) -> Unit = { registro ->
                    if (ruta.tabla == "facultades") {
                        FacultadConCarreras(registro, busqueda)
                    } else if (ruta.tabla == "carreras") {
                        Text(registro.nombre, style = MaterialTheme.typography.bodyLarge)
                    } else if (esEstructura) {
                        ListItem(
                            headlineContent = {
                                Text(registro.nombre, style = MaterialTheme.typography.titleMedium)
                            },
                            supportingContent = {
                                Text(
                                    "${camposEstructura(registro).size} campos · ${etiquetaCampo(registro.texto("tipo").lowercase())}"
                                )
                            },
                            leadingContent = { Icon(Icons.Outlined.AccountTree, null) },
                            trailingContent = { Icon(Icons.Outlined.ChevronRight, null) },
                            modifier =
                                Modifier.clickable(role = Role.Button) {
                                    estructuraSeleccionada = registro.id
                                },
                            colors =
                                ListItemDefaults.colors(
                                    containerColor = MaterialTheme.colorScheme.background
                                ),
                        )
                    } else {
                        var abierto by rememberSaveable(registro.id) { mutableStateOf(false) }
                        Column(
                            Modifier.fillMaxWidth().clickable { abierto = !abierto },
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                registro.nombre.ifBlank { registro.texto("plan_nombre") },
                                style = MaterialTheme.typography.titleLarge,
                            )
                            Text(
                                listOf(
                                        "nivel",
                                        "prefijo",
                                        "clave_sep",
                                        "numero_acuerdo",
                                        "estado_etiqueta",
                                        "tipo",
                                    )
                                    .map { registro.texto(it) }
                                    .filter { it.isNotBlank() }
                                    .joinToString(" · "),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            if (abierto)
                                registro
                                    .filterKeys {
                                        it in
                                            setOf(
                                                "descripcion",
                                                "fecha_aprobacion",
                                                "vigencia_inicio",
                                                "vigencia_fin",
                                                "autoridad",
                                                "observaciones",
                                                "version",
                                                "publicada",
                                                "activo",
                                            )
                                    }
                                    .forEach { (clave, valor) ->
                                        TextoAcademico(etiquetaCampo(clave), renderValor(valor))
                                    }
                            HorizontalDivider()
                        }
                    }
                }
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 24.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    if (visibles.isEmpty()) item { Vacio("Sin registros") }
                    if (ruta.tabla == "carreras") {
                        carrerasPorNivel(visibles).forEach { (nivel, carreras) ->
                            item(key = "nivel-$nivel") { EncabezadoNivelAcademico(nivel) }
                            items(carreras, key = { it.id }) { fila(it) }
                        }
                    } else items(visibles, key = { it.id }) { fila(it) }
                }
            }
        }
    }
    estado.datos
        ?.find { it.id == estructuraSeleccionada }
        ?.let { estructura ->
            DetalleEstructura(estructura, ruta.tabla == "estructuras_asignatura") {
                estructuraSeleccionada = null
            }
        }
}

@Composable
private fun FacultadConCarreras(facultad: Registro, busqueda: String) {
    var expandida by
        rememberSaveable(facultad.id, busqueda) { mutableStateOf(busqueda.isNotBlank()) }
    val filtro = normalizarBusqueda(busqueda)
    val carreras =
        facultad.lista("carreras").filter {
            filtro.isBlank() ||
                normalizarBusqueda(nombreFacultad(facultad)).contains(filtro) ||
                normalizarBusqueda(nombreCarrera(it)).contains(filtro)
        }
    Column {
        Row(
            Modifier.fillMaxWidth()
                .clickable(role = Role.Button) { expandida = !expandida }
                .semantics { stateDescription = if (expandida) "Expandida" else "Contraída" }
                .padding(vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            FacultadIdentidad(facultad, Modifier.weight(1f))
            Text(
                "${carreras.size} ${if (carreras.size == 1) "carrera" else "carreras"}",
                style = MaterialTheme.typography.labelMedium,
                modifier = Modifier.semantics { contentDescription = "${carreras.size} carreras" },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Icon(if (expandida) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore, null)
        }
        AnimatedVisibility(expandida) {
            Column(
                Modifier.padding(start = 16.dp, bottom = 20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                if (carreras.isEmpty())
                    Text("Sin carreras", color = MaterialTheme.colorScheme.onSurfaceVariant)
                carrerasPorNivel(carreras).forEach { (nivel, grupo) ->
                    EncabezadoNivelAcademico(nivel)
                    grupo.forEach { carrera ->
                        Text(
                            carrera.nombre,
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.padding(start = 8.dp),
                        )
                    }
                }
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .5f))
    }
}

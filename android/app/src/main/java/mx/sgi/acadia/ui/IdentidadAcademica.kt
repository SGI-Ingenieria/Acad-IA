package mx.sgi.acadia.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.core.graphics.toColorInt
import kotlinx.serialization.json.JsonNull
import mx.sgi.acadia.data.*

@Composable
fun colorFacultad(facultad: Registro): Color = runCatching {
    Color(facultad.texto("color").toColorInt())
}
    .getOrDefault(MaterialTheme.colorScheme.primary)

/** The web stores Lucide names. Map their meaning to bundled native Material vectors. */
private fun iconoFacultad(nombre: String): ImageVector =
    when (nombre) {
        "DraftingCompass",
        "Ruler",
        "PenTool" -> Icons.Outlined.Architecture
        "Languages",
        "Globe",
        "Globe2" -> Icons.Outlined.Translate
        "FlaskConical",
        "FlaskRound",
        "Atom",
        "Beaker" -> Icons.Outlined.Science
        "HeartHandshake",
        "HandHeart" -> Icons.Outlined.VolunteerActivism
        "Scale",
        "Gavel" -> Icons.Outlined.Balance
        "Stethoscope",
        "Hospital",
        "Cross" -> Icons.Outlined.MedicalServices
        "GraduationCap",
        "School" -> Icons.Outlined.School
        "BookHeart",
        "BookOpen",
        "Book" -> Icons.AutoMirrored.Outlined.MenuBook
        "Users",
        "UsersRound",
        "Contact" -> Icons.Outlined.Groups
        "Hammer",
        "Wrench",
        "Cog",
        "Cpu" -> Icons.Outlined.Construction
        "HeartPulse",
        "Heart",
        "Activity" -> Icons.Outlined.MonitorHeart
        "Briefcase",
        "BriefcaseBusiness",
        "Building" -> Icons.Outlined.WorkOutline
        else -> Icons.Outlined.AccountBalance
    }

@Composable
fun InsigniaFacultad(facultad: Registro, modifier: Modifier = Modifier) {
    val color = colorFacultad(facultad)
    Surface(
        modifier.size(40.dp),
        shape = MaterialTheme.shapes.small,
        color = color.copy(alpha = .1f),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(iconoFacultad(facultad.texto("icono")), null, Modifier.size(22.dp), tint = color)
        }
    }
}

@Composable
fun FacultadIdentidad(facultad: Registro, modifier: Modifier = Modifier) {
    Row(
        modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        InsigniaFacultad(facultad)
        Text(nombreFacultad(facultad), style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
fun EncabezadoNivelAcademico(nivel: String) {
    Text(
        nivel,
        Modifier.padding(top = 16.dp, bottom = 4.dp).semantics { heading() },
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
fun FilaCatalogoAcademico(registro: Registro, facultad: Boolean) {
    var abierto by rememberSaveable(registro.id) { mutableStateOf(false) }
    val identidad = if (facultad) registro else registro.objeto("facultades")
    val detalles =
        registro
            .filterKeys {
                it in
                    setOf(
                        "descripcion",
                        "tipo_ciclo_default",
                        "ciclos_default",
                        "semanas_por_ciclo_default",
                    )
            }
            .filterValues { it != JsonNull && renderValor(it).isNotBlank() }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            Modifier.fillMaxWidth()
                .then(
                    if (detalles.isNotEmpty())
                        Modifier.clickable(
                            role = Role.Button,
                            onClickLabel = if (abierto) "Ocultar detalles" else "Mostrar detalles",
                        ) {
                            abierto = !abierto
                        }
                    else Modifier
                )
                .padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            InsigniaFacultad(identidad)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    if (facultad) nombreFacultad(registro) else registro.nombre,
                    style = MaterialTheme.typography.titleMedium,
                )
                if (!facultad && identidad.id.isNotBlank())
                    Text(
                        nombreFacultad(identidad),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                if (registro.texto("clave_sep").isNotBlank())
                    Text(
                        registro.texto("clave_sep"),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
            }
            if (detalles.isNotEmpty())
                Icon(if (abierto) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore, null)
        }
        if (abierto)
            detalles.forEach { (clave, valor) ->
                TextoAcademico(
                    when (clave) {
                        "tipo_ciclo_default" -> "Periodicidad"
                        "ciclos_default" -> "Número de ciclos"
                        "semanas_por_ciclo_default" -> "Semanas por ciclo"
                        else -> etiquetaCampo(clave)
                    },
                    renderValor(valor),
                )
            }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .5f))
    }
}

@Composable
fun SelectorFacultad(
    facultades: List<Registro>,
    valor: String,
    habilitado: Boolean = true,
    seleccionar: (String) -> Unit,
) {
    var abierto by rememberSaveable { mutableStateOf(false) }
    val seleccionada = facultades.find { it.id == valor }
    CampoSeleccionAcademica(
        "Facultad",
        seleccionada?.let(::nombreFacultad) ?: "Selecciona la facultad",
        habilitado && facultades.isNotEmpty(),
        seleccionada,
    ) {
        abierto = true
    }
    if (abierto) {
        HojaSeleccionAcademica("Facultad", { abierto = false }) { busqueda ->
            val visibles = facultades.filter {
                normalizarBusqueda(nombreFacultad(it)).contains(busqueda)
            }
            LazyColumn(Modifier.fillMaxWidth(), contentPadding = PaddingValues(bottom = 24.dp)) {
                items(visibles, key = { it.id }) { facultad ->
                    OpcionAcademica(nombreFacultad(facultad), facultad, facultad.id == valor) {
                        seleccionar(facultad.id)
                        abierto = false
                    }
                }
                if (visibles.isEmpty()) item { Text("Sin coincidencias", Modifier.padding(24.dp)) }
            }
        }
    }
}

@Composable
fun SelectorCarrera(
    carreras: List<Registro>,
    facultad: Registro?,
    valor: String,
    habilitado: Boolean = true,
    seleccionar: (String) -> Unit,
) {
    var abierto by rememberSaveable { mutableStateOf(false) }
    val seleccionada = carreras.find { it.id == valor }
    CampoSeleccionAcademica(
        "Carrera",
        seleccionada?.let(::nombreCarrera)
            ?: if (facultad == null) "Selecciona primero la facultad" else "Selecciona la carrera",
        habilitado && facultad != null && carreras.isNotEmpty(),
        facultad,
    ) {
        abierto = true
    }
    if (abierto) {
        HojaSeleccionAcademica("Carrera", { abierto = false }) { busqueda ->
            val grupos =
                carrerasPorNivel(
                    carreras.filter { normalizarBusqueda(nombreCarrera(it)).contains(busqueda) }
                )
            LazyColumn(Modifier.fillMaxWidth(), contentPadding = PaddingValues(bottom = 24.dp)) {
                grupos.forEach { (nivel, opciones) ->
                    item(key = "nivel-$nivel") {
                        Text(
                            nivel,
                            Modifier.padding(horizontal = 24.dp, vertical = 12.dp).semantics {
                                heading()
                            },
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    items(opciones, key = { it.id }) { carrera ->
                        OpcionAcademica(carrera.nombre, facultad, carrera.id == valor) {
                            seleccionar(carrera.id)
                            abierto = false
                        }
                    }
                }
                if (grupos.isEmpty()) item { Text("Sin coincidencias", Modifier.padding(24.dp)) }
            }
        }
    }
}

@Composable
private fun CampoSeleccionAcademica(
    etiqueta: String,
    valor: String,
    habilitado: Boolean,
    facultad: Registro?,
    abrir: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(etiqueta, style = MaterialTheme.typography.labelLarge)
        OutlinedCard(onClick = abrir, enabled = habilitado, modifier = Modifier.fillMaxWidth()) {
            Row(
                Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (facultad != null) InsigniaFacultad(facultad)
                else
                    Icon(
                        Icons.Outlined.AccountBalance,
                        null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                Text(valor, Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
                Icon(Icons.Outlined.ExpandMore, null)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HojaSeleccionAcademica(
    titulo: String,
    cerrar: () -> Unit,
    contenido: @Composable (String) -> Unit,
) {
    var busqueda by rememberSaveable { mutableStateOf("") }
    ModalBottomSheet(
        onDismissRequest = cerrar,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    ) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(.85f)) {
            Row(
                Modifier.padding(horizontal = 24.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    titulo,
                    Modifier.weight(1f).semantics { heading() },
                    style = MaterialTheme.typography.titleLarge,
                )
                AccionIcono("Cerrar selector", Icons.Outlined.Close, accion = cerrar)
            }
            OutlinedTextField(
                busqueda,
                { busqueda = it },
                label = { Text("Buscar ${titulo.lowercase()}") },
                leadingIcon = { Icon(Icons.Outlined.Search, null) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 16.dp),
            )
            contenido(normalizarBusqueda(busqueda))
        }
    }
}

@Composable
private fun OpcionAcademica(
    texto: String,
    facultad: Registro?,
    seleccionada: Boolean,
    elegir: () -> Unit,
) {
    Surface(
        onClick = elegir,
        color =
            if (seleccionada) MaterialTheme.colorScheme.secondaryContainer else Color.Transparent,
        modifier = Modifier.fillMaxWidth(),
        selected = seleccionada,
    ) {
        Row(
            Modifier.padding(horizontal = 24.dp, vertical = 12.dp).heightIn(min = 48.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (facultad != null) InsigniaFacultad(facultad)
            Text(texto, Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
            if (seleccionada) Icon(Icons.Outlined.Check, "Seleccionada")
        }
    }
}

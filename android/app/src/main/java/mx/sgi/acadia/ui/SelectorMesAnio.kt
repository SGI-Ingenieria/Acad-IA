package mx.sgi.acadia.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

private val idiomaCalendario = Locale.forLanguageTag("es-MX")

/**
 * DatePicker chooses days, not academic periods. Native Compose controls retain month precision.
 */
@Composable
fun SelectorMesAnio(valor: String, habilitado: Boolean = true, seleccionar: (String) -> Unit) {
    val seleccionado = runCatching { YearMonth.parse(valor.take(7)) }.getOrDefault(YearMonth.now())
    var abierto by rememberSaveable { mutableStateOf(false) }
    OutlinedCard(
        onClick = { abierto = true },
        enabled = habilitado,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Icon(Icons.Outlined.CalendarMonth, null, tint = MaterialTheme.colorScheme.primary)
            Column {
                Text(
                    "Inicio de impartición",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    seleccionado
                        .format(DateTimeFormatter.ofPattern("MMMM 'de' yyyy", idiomaCalendario))
                        .replaceFirstChar { it.uppercase() },
                    style = MaterialTheme.typography.titleMedium,
                )
            }
        }
    }
    if (abierto)
        DialogoMesAnio(seleccionado, { abierto = false }) {
            seleccionar(it.atDay(1).toString())
            abierto = false
        }
}

@Composable
private fun DialogoMesAnio(inicial: YearMonth, cerrar: () -> Unit, confirmar: (YearMonth) -> Unit) {
    val minimo = YearMonth.now()
    var anio by rememberSaveable { mutableIntStateOf(inicial.year.coerceAtLeast(minimo.year)) }
    var mes by rememberSaveable { mutableIntStateOf(inicial.monthValue) }
    val seleccion = YearMonth.of(anio, mes)
    AlertDialog(
        onDismissRequest = cerrar,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Inicio de impartición", Modifier.weight(1f))
                AccionIcono("Cerrar calendario", Icons.Outlined.Close, accion = cerrar)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Selector(
                    "Año",
                    anio.toString(),
                    (minimo.year..minimo.year + 30).map { it.toString() to it.toString() },
                ) {
                    anio = it.toInt()
                }
                (1..12).chunked(3).forEach { fila ->
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        fila.forEach { numero ->
                            val periodo = YearMonth.of(anio, numero)
                            val nombre =
                                periodo.format(
                                    DateTimeFormatter.ofPattern("MMMM", idiomaCalendario)
                                )
                            val abreviado =
                                periodo
                                    .format(DateTimeFormatter.ofPattern("MMM", idiomaCalendario))
                                    .replaceFirstChar { it.uppercase() }
                            val modifier =
                                Modifier.weight(1f).heightIn(min = 48.dp).semantics {
                                    contentDescription = "$nombre de $anio"
                                    selected = mes == numero
                                }
                            if (mes == numero)
                                FilledTonalButton(
                                    onClick = { mes = numero },
                                    enabled = periodo >= minimo,
                                    modifier = modifier,
                                    contentPadding = PaddingValues(horizontal = 4.dp),
                                ) {
                                    Text(abreviado)
                                }
                            else
                                TextButton(
                                    onClick = { mes = numero },
                                    enabled = periodo >= minimo,
                                    modifier = modifier,
                                    contentPadding = PaddingValues(horizontal = 4.dp),
                                ) {
                                    Text(abreviado)
                                }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = { confirmar(seleccion) }, enabled = seleccion >= minimo) {
                Text("Elegir mes")
            }
        },
    )
}

@file:OptIn(
    androidx.compose.material3.ExperimentalMaterial3Api::class,
    com.mohamedrejeb.richeditor.annotation.ExperimentalRichTextApi::class,
)

package mx.sgi.acadia.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.ParagraphStyle
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import androidx.core.view.WindowCompat
import com.mohamedrejeb.richeditor.model.*
import com.mohamedrejeb.richeditor.ui.BasicRichTextEditor
import com.mohamedrejeb.richeditor.ui.material3.RichText
import mx.sgi.acadia.data.HtmlAcademico

@Composable
fun CampoEnriquecido(titulo: String, valor: String, cambiar: (String) -> Unit) {
    var abierto by rememberSaveable { mutableStateOf(false) }
    TextoAcademico(titulo, valor) { abierto = true }
    if (abierto)
        EditorTextoAcademico(titulo, valor, false, null, { abierto = false }) {
            cambiar(it)
            abierto = false
        }
}

@Composable
fun ContenidoEnriquecido(html: String, modifier: Modifier = Modifier) {
    val estado = remember(html) { RichTextState().setHtml(HtmlAcademico.normalizar(html)) }
    val color = MaterialTheme.colorScheme.primary
    LaunchedEffect(estado, color) { estado.config.linkColor = color }
    SelectionContainer {
        RichText(
            estado,
            modifier.fillMaxWidth(),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}

@Composable
fun EditorTextoAcademico(
    titulo: String,
    original: String,
    ocupado: Boolean,
    error: String?,
    cerrar: () -> Unit,
    guardar: (String) -> Unit,
) {
    val estado =
        rememberSaveable(saver = RichTextState.Saver) {
            RichTextState().setHtml(HtmlAcademico.normalizar(original))
        }
    val inicial = rememberSaveable { estado.toHtml() }
    // Paragraph internals are not snapshot state in rich-editor 1.2. Observe its rendered
    // document and paragraph controls so list-only edits also update the dirty indicator.
    val html =
        remember(
            estado.annotatedString,
            estado.currentParagraphStyle,
            estado.currentHeadingStyle,
            estado.isOrderedList,
            estado.isUnorderedList,
        ) {
            estado.toHtml()
        }
    val cambiado = html != inicial
    var confirmar by rememberSaveable { mutableStateOf(false) }
    var estilos by remember { mutableStateOf(false) }
    val foco = remember { FocusRequester() }
    val primary = MaterialTheme.colorScheme.primary
    LaunchedEffect(estado, primary) { estado.config.linkColor = primary }
    fun salir() {
        if (!ocupado) {
            if (estado.toHtml() != inicial) confirmar = true else cerrar()
        }
    }
    Dialog(
        onDismissRequest = ::salir,
        properties =
            DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        // A dialog owns a different Window from the activity's edge-to-edge theme.
        val vista = LocalView.current
        val ventana = (vista.parent as? DialogWindowProvider)?.window
        val barrasClaras = MaterialTheme.colorScheme.background.luminance() > .5f
        SideEffect {
            ventana?.let {
                WindowCompat.getInsetsController(it, vista).apply {
                    isAppearanceLightStatusBars = barrasClaras
                    isAppearanceLightNavigationBars = barrasClaras
                }
            }
        }
        BackHandler { salir() }
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Column(Modifier.safeDrawingPadding().imePadding()) {
                TopAppBar(
                    title = {
                        Text(titulo, maxLines = 2, style = MaterialTheme.typography.titleMedium)
                    },
                    navigationIcon = {
                        AccionIcono("Cerrar editor", Icons.Outlined.Close, !ocupado, ::salir)
                    },
                    actions = {
                        TextButton(
                            enabled = cambiado && !ocupado,
                            onClick = { guardar(HtmlAcademico.normalizar(estado.toHtml())) },
                        ) {
                            if (ocupado) CircularProgressIndicator(Modifier.size(20.dp))
                            else Text("Guardar")
                        }
                    },
                )
                Surface(color = MaterialTheme.colorScheme.surfaceContainerLow) {
                    Column {
                        Row(
                            Modifier.fillMaxWidth()
                                .horizontalScroll(rememberScrollState())
                                .padding(horizontal = 12.dp)
                        ) {
                            Box {
                                TextButton(onClick = { estilos = true }, enabled = !ocupado) {
                                    Text(
                                        if (estado.currentHeadingStyle == HeadingStyle.Normal)
                                            "Párrafo"
                                        else "H${estado.currentHeadingStyle.level}"
                                    )
                                    Icon(Icons.Outlined.ArrowDropDown, null)
                                }
                                DropdownMenu(
                                    expanded = estilos,
                                    onDismissRequest = { estilos = false },
                                ) {
                                    listOf(
                                            HeadingStyle.Normal,
                                            HeadingStyle.H1,
                                            HeadingStyle.H2,
                                            HeadingStyle.H3,
                                        )
                                        .forEach { estilo ->
                                            DropdownMenuItem(
                                                text = {
                                                    Text(
                                                        if (estilo == HeadingStyle.Normal) "Párrafo"
                                                        else "Encabezado ${estilo.level}"
                                                    )
                                                },
                                                onClick = {
                                                    estado.setHeadingStyle(estilo)
                                                    estilos = false
                                                    foco.requestFocus()
                                                },
                                            )
                                        }
                                }
                            }
                            Formato(
                                "Negrita",
                                Icons.Outlined.FormatBold,
                                estado.currentSpanStyle.fontWeight == FontWeight.Bold,
                                !ocupado,
                            ) {
                                estado.toggleSpanStyle(SpanStyle(fontWeight = FontWeight.Bold))
                                foco.requestFocus()
                            }
                            Formato(
                                "Cursiva",
                                Icons.Outlined.FormatItalic,
                                estado.currentSpanStyle.fontStyle == FontStyle.Italic,
                                !ocupado,
                            ) {
                                estado.toggleSpanStyle(SpanStyle(fontStyle = FontStyle.Italic))
                                foco.requestFocus()
                            }
                            Formato(
                                "Subrayado",
                                Icons.Outlined.FormatUnderlined,
                                estado.currentSpanStyle.textDecoration?.contains(
                                    TextDecoration.Underline
                                ) == true,
                                !ocupado,
                            ) {
                                estado.toggleSpanStyle(
                                    SpanStyle(textDecoration = TextDecoration.Underline)
                                )
                                foco.requestFocus()
                            }
                            Formato(
                                "Tachado",
                                Icons.Outlined.FormatStrikethrough,
                                estado.currentSpanStyle.textDecoration?.contains(
                                    TextDecoration.LineThrough
                                ) == true,
                                !ocupado,
                            ) {
                                estado.toggleSpanStyle(
                                    SpanStyle(textDecoration = TextDecoration.LineThrough)
                                )
                                foco.requestFocus()
                            }
                            AccionIcono(
                                "Deshacer",
                                Icons.AutoMirrored.Outlined.Undo,
                                !ocupado && estado.history.canUndo,
                            ) {
                                estado.history.undo()
                            }
                            AccionIcono(
                                "Rehacer",
                                Icons.AutoMirrored.Outlined.Redo,
                                !ocupado && estado.history.canRedo,
                            ) {
                                estado.history.redo()
                            }
                        }
                        Row(
                            Modifier.fillMaxWidth()
                                .horizontalScroll(rememberScrollState())
                                .padding(horizontal = 12.dp)
                        ) {
                            Formato(
                                "Lista con viñetas",
                                Icons.AutoMirrored.Outlined.FormatListBulleted,
                                estado.isUnorderedList,
                                !ocupado,
                            ) {
                                estado.toggleUnorderedList()
                                foco.requestFocus()
                            }
                            Formato(
                                "Lista numerada",
                                Icons.Outlined.FormatListNumbered,
                                estado.isOrderedList,
                                !ocupado,
                            ) {
                                estado.toggleOrderedList()
                                foco.requestFocus()
                            }
                            AccionIcono(
                                "Aumentar sangría",
                                Icons.AutoMirrored.Outlined.FormatIndentIncrease,
                                !ocupado && estado.canIncreaseListLevel,
                            ) {
                                estado.increaseListLevel()
                                foco.requestFocus()
                            }
                            AccionIcono(
                                "Reducir sangría",
                                Icons.AutoMirrored.Outlined.FormatIndentDecrease,
                                !ocupado && estado.canDecreaseListLevel,
                            ) {
                                estado.decreaseListLevel()
                                foco.requestFocus()
                            }
                            listOf(
                                    Triple(
                                        "Alinear a la izquierda",
                                        Icons.AutoMirrored.Outlined.FormatAlignLeft,
                                        TextAlign.Left,
                                    ),
                                    Triple(
                                        "Centrar",
                                        Icons.Outlined.FormatAlignCenter,
                                        TextAlign.Center,
                                    ),
                                    Triple(
                                        "Alinear a la derecha",
                                        Icons.AutoMirrored.Outlined.FormatAlignRight,
                                        TextAlign.Right,
                                    ),
                                )
                                .forEach { (nombre, icono, alineacion) ->
                                    Formato(
                                        nombre,
                                        icono,
                                        estado.currentParagraphStyle.textAlign == alineacion,
                                        !ocupado,
                                    ) {
                                        estado.toggleParagraphStyle(
                                            ParagraphStyle(textAlign = alineacion)
                                        )
                                        foco.requestFocus()
                                    }
                                }
                        }
                    }
                }
                if (error != null) Aviso(error)
                Box(
                    Modifier.weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(24.dp)
                ) {
                    BasicRichTextEditor(
                        estado,
                        Modifier.fillMaxWidth()
                            .heightIn(min = 280.dp)
                            .focusRequester(foco)
                            .semantics { contentDescription = "Contenido enriquecido" },
                        enabled = !ocupado,
                        textStyle =
                            MaterialTheme.typography.bodyLarge.copy(
                                color = MaterialTheme.colorScheme.onSurface
                            ),
                        cursorBrush = SolidColor(primary),
                    )
                    if (estado.annotatedString.text.isBlank())
                        Text("Escribe aquí…", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                HorizontalDivider()
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        "${estado.annotatedString.text.trim().split(Regex("\\s+")).count { it.isNotBlank() }} palabras",
                        style = MaterialTheme.typography.labelSmall,
                    )
                    Text(
                        if (ocupado) "Guardando…"
                        else if (cambiado) "Cambios sin guardar" else "Sin cambios",
                        style = MaterialTheme.typography.labelSmall,
                    )
                }
            }
        }
        if (confirmar)
            AlertDialog(
                onDismissRequest = { confirmar = false },
                title = { Text("¿Descartar cambios?") },
                text = { Text("Los cambios de este campo aún no se han guardado.") },
                confirmButton = { TextButton(onClick = cerrar) { Text("Descartar") } },
                dismissButton = {
                    TextButton(onClick = { confirmar = false }) { Text("Seguir editando") }
                },
            )
    }
}

@Composable
private fun Formato(
    titulo: String,
    icono: ImageVector,
    seleccionado: Boolean,
    habilitado: Boolean,
    accion: () -> Unit,
) {
    TooltipBox(
        positionProvider =
            TooltipDefaults.rememberTooltipPositionProvider(TooltipAnchorPosition.Above),
        tooltip = { PlainTooltip { Text(titulo) } },
        state = rememberTooltipState(),
    ) {
        IconToggleButton(
            checked = seleccionado,
            onCheckedChange = { accion() },
            enabled = habilitado,
        ) {
            Icon(icono, titulo)
        }
    }
}

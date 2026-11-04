package mx.sgi.acadia.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.graphics.toColorInt
import kotlinx.serialization.json.*
import mx.sgi.acadia.data.*

@Composable
fun EditarExpediente(
    tipo: String,
    original: Registro?,
    expediente: Expediente,
    materia: Boolean,
    ocupado: Boolean,
    error: String?,
    cerrar: () -> Unit,
    guardar: (Registro) -> Unit,
) {
    val r = expediente.registro
    val inicial = original ?: objeto()
    if (
        tipo == "campo" &&
            inicial.objeto("definicion").texto("type", "string") !in
                listOf("integer", "number", "boolean", "object", "array") &&
            inicial.objeto("definicion")["enum"] == null
    ) {
        EditorTextoAcademico(
            inicial.texto("titulo"),
            inicial.texto("valor"),
            ocupado,
            error,
            cerrar,
        ) { html ->
            guardar(objeto(inicial.texto("clave") to html))
        }
        return
    }
    if (tipo == "unidad" || tipo == "evaluacion") {
        EditorListaAcademica(tipo == "evaluacion", inicial, r, ocupado, error, cerrar, guardar)
        return
    }
    var nombre by rememberSaveable { mutableStateOf(inicial.nombre) }
    var codigo by rememberSaveable { mutableStateOf(inicial.texto("codigo")) }
    var horas by rememberSaveable {
        mutableStateOf(
            inicial
                .numero(
                    if (materia) "horas_academicas" else "semanas_por_ciclo",
                    if (materia) 0 else 16,
                )
                .toString()
        )
    }
    var independientes by rememberSaveable {
        mutableStateOf(inicial.numero("horas_independientes").toString())
    }
    var ciclo by rememberSaveable { mutableStateOf(inicial.numero("numero_ciclo", 1).toString()) }
    var tipoAsignatura by rememberSaveable { mutableStateOf(inicial.texto("tipo", "OBLIGATORIA")) }
    var texto by rememberSaveable {
        mutableStateOf(
            if (tipo == "campo") textoPlano(inicial.texto("valor")) else inicial.texto("cuerpo")
        )
    }
    var proposito by rememberSaveable { mutableStateOf(inicial.texto("proposito")) }
    var aporte by rememberSaveable { mutableStateOf(inicial.texto("aporte_perfil_egreso")) }
    var alcance by rememberSaveable { mutableStateOf(inicial.texto("alcance_formativo")) }
    var color by rememberSaveable {
        mutableStateOf(
            colorBloqueCurricular(
                inicial,
                expediente.bloques.indexOfFirst { it.id == inicial.id }.takeIf { it >= 0 }
                    ?: expediente.bloques.size,
            )
        )
    }
    var validacion by remember { mutableStateOf<String?>(null) }
    val tituloDialogo =
        when (tipo) {
            "generales" -> "Datos generales"
            "campo" -> inicial.texto("titulo")
            "bloque" -> "Bloque formativo"
            "unidad" -> "Unidad temática"
            "evaluacion" -> "Criterios de evaluación"
            "comentario" -> "Nueva observación"
            else -> "Editar contenido"
        }
    var descartarComentario by rememberSaveable { mutableStateOf(false) }
    val cerrarSeguro = {
        if (tipo == "comentario" && texto.isNotBlank() && !ocupado) descartarComentario = true
        else if (!ocupado) cerrar()
    }
    if (descartarComentario)
        AlertDialog(
            onDismissRequest = { descartarComentario = false },
            title = { Text("¿Descartar comentario?") },
            text = { Text("El comentario aún no se ha publicado.") },
            confirmButton = { TextButton(onClick = cerrar) { Text("Descartar") } },
            dismissButton = {
                TextButton(onClick = { descartarComentario = false }) { Text("Seguir escribiendo") }
            },
        )
    DialogoFormulario(
        tituloDialogo,
        ocupado,
        validacion ?: error,
        cerrarSeguro,
        etiquetaGuardar = if (tipo == "comentario") "Publicar comentario" else "Guardar",
        guardar = {
            validacion = null
            val cambios: Registro? =
                when (tipo) {
                    "generales" -> {
                        validacion =
                            Validacion.nombre(nombre)
                                ?: if (materia)
                                    Validacion.horas(horas)
                                        ?: Validacion.horas(independientes)
                                        ?: if (
                                            ciclo.toIntOrNull()?.let {
                                                it in
                                                    1..r.objeto("planes_estudio")
                                                            .numero("numero_ciclos", 30)
                                            } == true
                                        )
                                            null
                                        else "Selecciona un ciclo válido."
                                else null
                        if (materia)
                            objeto(
                                "nombre" to nombre.trim(),
                                "codigo" to codigo.trim(),
                                "horas_academicas" to horas.toIntOrNull(),
                                "horas_independientes" to independientes.toIntOrNull(),
                                "numero_ciclo" to ciclo.toIntOrNull(),
                                "tipo" to tipoAsignatura,
                            )
                        else if (r.objeto("estructuras_plan").texto("tipo") == "CURRICULAR") {
                            if (horas.toIntOrNull()?.let { it in 1..52 } != true)
                                validacion = "Usa entre 1 y 52 semanas."
                            objeto("semanas_por_ciclo" to horas.toIntOrNull())
                        } else
                            objeto("nombre" to nombre.trim(), "nombre_propuesto" to nombre.trim())
                    }
                    "campo" -> {
                        val schema = inicial.objeto("definicion")
                        val tipoCampo = schema.texto("type", "string")
                        val valor: JsonElement =
                            when (tipoCampo) {
                                "integer" -> {
                                    val numero = texto.toIntOrNull()
                                    if (numero == null) validacion = "Escribe un número entero."
                                    numero?.let { JsonPrimitive(it) } ?: JsonNull
                                }
                                "number" -> {
                                    val numero = texto.toDoubleOrNull()
                                    if (numero == null || !numero.isFinite())
                                        validacion = "Escribe un número válido."
                                    numero?.let { JsonPrimitive(it) } ?: JsonNull
                                }
                                "boolean" -> JsonPrimitive(texto == "true")
                                else ->
                                    JsonPrimitive(
                                        if (texto == textoPlano(inicial.texto("valor")))
                                            inicial.texto("valor")
                                        else if (inicial.texto("valor").contains(Regex("<[^>]+>")))
                                            "<p>${android.text.Html.escapeHtml(texto).replace("\n","<br>")}</p>"
                                        else texto
                                    )
                            }
                        val opciones = schema["enum"] as? JsonArray
                        if (opciones != null && valor !in opciones)
                            validacion = "Selecciona un valor del catálogo."
                        objeto(inicial.texto("clave") to valor)
                    }
                    "bloque" -> {
                        validacion = Validacion.nombre(nombre)
                        objeto(
                            "nombre" to nombre.trim(),
                            "proposito" to proposito,
                            "aporte_perfil_egreso" to aporte,
                            "alcance_formativo" to alcance,
                            "color" to color,
                            "orden" to inicial.numero("orden", expediente.bloques.size),
                        )
                    }
                    "comentario" -> {
                        if (texto.isBlank()) validacion = "Escribe tu observación."
                        objeto("cuerpo" to texto)
                    }
                    else -> null
                }
            if (validacion == null && cambios != null) guardar(cambios)
        },
    ) {
        when (tipo) {
            "generales" -> {
                if (materia || r.objeto("estructuras_plan").texto("tipo") != "CURRICULAR")
                    CampoTexto("Nombre", nombre, { nombre = it })
                else {
                    CampoTexto("Semanas por ciclo", horas, { horas = it }, true)
                }
                if (materia) {
                    CampoTexto("Código", codigo, { codigo = it })
                    Selector(
                        "Tipo",
                        tipoAsignatura,
                        listOf("OBLIGATORIA", "OPTATIVA", "TRONCAL", "OTRA").map {
                            it to etiquetaCampo(it.lowercase())
                        },
                    ) {
                        tipoAsignatura = it
                    }
                    CampoTexto("Ciclo", ciclo, { ciclo = it }, true)
                    CampoTexto("Horas académicas", horas, { horas = it }, true)
                    CampoTexto(
                        "Horas independientes",
                        independientes,
                        { independientes = it },
                        true,
                    )
                }
            }
            "campo" -> {
                val schema = inicial.objeto("definicion")
                val opciones = schema["enum"] as? JsonArray
                when {
                    opciones != null ->
                        Selector(
                            "Valor",
                            texto,
                            opciones.map { it.jsonPrimitive.content to it.jsonPrimitive.content },
                        ) {
                            texto = it
                        }
                    schema.texto("type") == "boolean" ->
                        Selector("Valor", texto, listOf("true" to "Sí", "false" to "No")) {
                            texto = it
                        }
                    else ->
                        CampoTexto(
                            "Contenido",
                            texto,
                            { texto = it },
                            numerico = schema.texto("type") in listOf("integer", "number"),
                            multilinea = schema.texto("type") !in listOf("integer", "number"),
                        )
                }
            }
            "comentario" ->
                CampoTexto(
                    "Comentario",
                    texto,
                    { texto = it },
                    multilinea = true,
                    habilitado = !ocupado,
                )
            "bloque" -> {
                CampoTexto("Nombre", nombre, { nombre = it })
                Text("Color del bloque", style = MaterialTheme.typography.labelLarge)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    (listOf(color) + paletaBloques).distinct().forEachIndexed { indice, tono ->
                        val tinta = runCatching {
                            Color(tono.toColorInt())
                        }
                            .getOrDefault(MaterialTheme.colorScheme.primary)
                        OutlinedIconToggleButton(
                            checked = color == tono,
                            onCheckedChange = { color = tono },
                            shape = CircleShape,
                            border = BorderStroke(if (color == tono) 2.dp else 1.dp, tinta),
                            colors =
                                IconButtonDefaults.outlinedIconToggleButtonColors(
                                    containerColor = tinta.copy(alpha = .18f),
                                    checkedContainerColor = tinta,
                                ),
                        ) {
                            Icon(
                                if (color == tono) Icons.Outlined.Check else Icons.Outlined.Circle,
                                "Color de bloque ${indice + 1}: $tono",
                                tint =
                                    if (color == tono)
                                        (if (tinta.luminance() > .5f) Color.Black else Color.White)
                                    else tinta,
                            )
                        }
                    }
                }
                CampoEnriquecido("Propósito", proposito) { proposito = it }
                CampoEnriquecido("Aporte al perfil de egreso", aporte) { aporte = it }
                CampoEnriquecido("Alcance formativo", alcance) { alcance = it }
            }
        }
    }
}

@Composable
fun CampoTexto(
    etiqueta: String,
    valor: String,
    cambiar: (String) -> Unit,
    numerico: Boolean = false,
    multilinea: Boolean = false,
    habilitado: Boolean = true,
) {
    OutlinedTextField(
        valor,
        cambiar,
        enabled = habilitado,
        label = { Text(etiqueta) },
        modifier = Modifier.fillMaxWidth(),
        minLines = if (multilinea) 4 else 1,
        singleLine = !multilinea,
        keyboardOptions =
            KeyboardOptions(
                keyboardType = if (numerico) KeyboardType.Number else KeyboardType.Text
            ),
    )
}

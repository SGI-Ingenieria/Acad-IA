package mx.sgi.acadia.ui

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import mx.sgi.acadia.data.*

data class EstadoChat(
    val conversacionId: String? = null,
    val conversacion: Registro? = null,
    val mensajes: List<Registro> = emptyList(),
    val recientes: List<Registro> = emptyList(),
    val expediente: Expediente? = null,
    val cargando: Boolean = false,
    val ocupado: Boolean = false,
    val consultaPendiente: String? = null,
    val error: String? = null,
) {
    val archivada
        get() =
            conversacion?.texto("estado") == "ARCHIVADA" ||
                recientes.any { it.id == conversacionId && it.texto("estado") == "ARCHIVADA" }

    val comprobandoConversacion
        get() = conversacionId != null && conversacion?.id != conversacionId

    val generando
        get() = mensajes.any { chatEnProceso(it) }
}

@OptIn(FlowPreview::class)
class ChatViewModel(
    private val repo: RepositorioAcad,
    private val entidadId: String,
    private val asignatura: Boolean,
    conversacionInicial: String?,
    private val guardado: SavedStateHandle,
) : ViewModel() {
    private val inicialId: String? =
        if (guardado.contains("chat_activo")) guardado["chat_activo"] else conversacionInicial
    private val consultas =
        BorradoresConsultaChat(
            leer = { guardado.get<String>(it) },
            guardar = { clave, valor -> guardado[clave] = valor },
        )
    val estado: MutableStateFlow<EstadoChat> =
        MutableStateFlow(EstadoChat(conversacionId = inicialId))
    private val borrador =
        BorradorChat(inicialId) {
            consultas.vincularConversacionCreada(
                it,
                guardado.get<String>("consulta_borrador").orEmpty(),
            )
            guardado["chat_activo"] = it
            estado.update { actual -> actual.copy(conversacionId = it) }
        }
    val texto = guardado.getStateFlow("consulta_borrador", "")
    val aviso = MutableStateFlow<String?>(null)
    private var carga: Job? = null

    init {
        escribir(consultas.restaurar(inicialId, texto.value))
        actualizar()
        viewModelScope.launch {
            repo
                .cambios(
                    listOf(
                        if (asignatura) "asignatura_mensajes_ia" else "plan_mensajes_ia",
                        if (asignatura) "conversaciones_asignatura" else "conversaciones_plan",
                        if (asignatura) "asignaturas" else "planes_estudio",
                    )
                )
                .debounce(150)
                .collect { actualizar() }
        }
    }

    fun escribir(valor: String) {
        consultas.escribir(borrador.conversacionId, valor)
        guardado["consulta_borrador"] = valor
    }

    fun actualizar() {
        if (estado.value.ocupado) return
        carga?.cancel()
        val id = borrador.conversacionId
        carga = viewModelScope.launch {
            estado.update { it.copy(cargando = true, error = null) }
            try {
                val resultado = coroutineScope {
                    val mensajes = async { id?.let { repo.mensajes(it, asignatura) }.orEmpty() }
                    val recientes = async { repo.conversaciones(entidadId, asignatura) }
                    val conversacion = async {
                        id?.let {
                            repo.uno(
                                if (asignatura) "conversaciones_asignatura"
                                else "conversaciones_plan",
                                it,
                            )
                        }
                    }
                    val expediente = async {
                        if (asignatura) repo.asignatura(entidadId) else repo.plan(entidadId)
                    }
                    estado.value.copy(
                        mensajes = mensajes.await(),
                        recientes = recientes.await(),
                        expediente = expediente.await(),
                        conversacion = conversacion.await(),
                        cargando = false,
                    )
                }
                if (id == borrador.conversacionId) estado.value = resultado
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                estado.update {
                    it.copy(cargando = false, error = e.message ?: "No se pudo cargar el chat.")
                }
            }
        }
    }

    fun abrir(id: String?) {
        if (estado.value.ocupado || borrador.conversacionId == id) return
        carga?.cancel()
        val textoDestino = consultas.cambiar(borrador.conversacionId, id, texto.value)
        borrador.conversacionId = id
        guardado["chat_activo"] = id
        escribir(textoDestino)
        estado.update {
            it.copy(conversacionId = id, conversacion = null, mensajes = emptyList(), error = null)
        }
        actualizar()
    }

    fun enviar(reintento: Registro? = null) {
        val consulta = reintento?.texto("mensaje") ?: texto.value.trim()
        if (
            consulta.isBlank() ||
                estado.value.ocupado ||
                estado.value.archivada ||
                estado.value.generando ||
                estado.value.comprobandoConversacion
        )
            return
        carga?.cancel()
        estado.update { it.copy(ocupado = true, consultaPendiente = consulta, error = null) }
        viewModelScope.launch {
            try {
                val enviado =
                    borrador.enviar(
                        consulta,
                        crear = { contenido ->
                            repo
                                .crearConversacion(entidadId, asignatura, contenido)
                                .objeto(
                                    if (asignatura) "conversation_asignatura"
                                    else "conversation_plan"
                                )
                                .id
                        },
                        enviar = { id, contenido ->
                            repo.enviarMensaje(id, asignatura, contenido, reintento?.id)
                        },
                    )
                if (enviado && reintento == null && texto.value.trim() == consulta) escribir("")
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // A network timeout can occur after the server accepted the turn. Reconcile first;
                // never automatically replay a non-idempotent AI request.
                val encontrados = runCatching {
                    borrador.conversacionId?.let { repo.mensajes(it, asignatura) }.orEmpty()
                }
                    .getOrDefault(emptyList())
                if (
                    encontrados.any {
                        it.texto("mensaje") == consulta &&
                            it.id !in estado.value.mensajes.map(Registro::id)
                    }
                ) {
                    if (reintento == null && texto.value.trim() == consulta) escribir("")
                } else aviso.value = e.message ?: "No se pudo enviar. Tu consulta sigue disponible."
            } finally {
                estado.update { it.copy(ocupado = false, consultaPendiente = null) }
                actualizar()
            }
        }
    }

    fun archivar(id: String, valor: Boolean) = operar {
        repo.archivarConversacion(id, asignatura, valor)
        aviso.value = if (valor) "Chat archivado" else "Chat restaurado"
    }

    fun aplicar(mensajeId: String, recomendacion: RecomendacionChat, revision: String) = operar {
        repo.aplicarRecomendacionChat(entidadId, asignatura, mensajeId, recomendacion, revision)
        aviso.value = "Recomendación aplicada"
    }

    private fun operar(accion: suspend () -> Unit) {
        if (estado.value.ocupado) return
        carga?.cancel()
        estado.update { it.copy(ocupado = true) }
        viewModelScope.launch {
            try {
                accion()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                aviso.value = e.message ?: "No se pudo completar la acción."
            } finally {
                estado.update { it.copy(ocupado = false) }
                actualizar()
            }
        }
    }
}

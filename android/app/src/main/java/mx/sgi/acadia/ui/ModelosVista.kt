package mx.sgi.acadia.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import mx.sgi.acadia.data.*

class SesionViewModel(val repo: RepositorioAcad) : ViewModel() {
    val sesion = MutableStateFlow<Sesion?>(null)
    val iniciando = MutableStateFlow(repo.configurado)
    val ocupado = MutableStateFlow(false)
    val error =
        MutableStateFlow<String?>(
            if (repo.configurado) null
            else "Ejecuta bun run android:configurar y vuelve a compilar."
        )

    init {
        if (repo.configurado)
            viewModelScope.launch {
                repo.cambiosSesion.collect { estado ->
                    sesion.value = repo.sesionActual()
                    iniciando.value = estado is SessionStatus.Initializing
                }
            }
    }

    fun entrar(correo: String, password: String, institucional: Boolean) {
        if (ocupado.value) return
        viewModelScope.launch {
            ocupado.value = true
            error.value = null
            try {
                repo.entrar(correo, password, institucional)
                sesion.value = repo.sesionActual()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error.value = e.message
            } finally {
                ocupado.value = false
            }
        }
    }

    fun recuperar(correo: String) {
        viewModelScope.launch {
            ocupado.value = true
            try {
                repo.recuperar(correo)
                error.value = "Revisa tu correo. En el preview local, abre http://localhost:54324."
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error.value = e.message
            } finally {
                ocupado.value = false
            }
        }
    }

    fun salir() {
        if (ocupado.value) return
        ocupado.value = true
        error.value = null
        viewModelScope.launch {
            try {
                repo.salir()
                sesion.value = null
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error.value = e.message ?: "No se pudo cerrar la sesión. Inténtalo de nuevo."
            } finally {
                ocupado.value = false
            }
        }
    }
}

data class EstadoCarga<T>(
    val datos: T? = null,
    val cargando: Boolean = true,
    val error: String? = null,
)

class ContenidoViewModel<T>(
    private val cargar: suspend () -> T,
    repo: RepositorioAcad? = null,
    tablas: List<String> = emptyList(),
) : ViewModel() {
    val estado = MutableStateFlow(EstadoCarga<T>())
    val guardando = MutableStateFlow(false)
    val mensaje = MutableStateFlow<String?>(null)
    val vivo = MutableStateFlow(true)
    private var carga: Job? = null

    init {
        actualizar()
        if (repo != null && tablas.isNotEmpty())
            viewModelScope.launch {
                repo
                    .cambios(tablas)
                    .catch { e ->
                        if (e is CancellationException) throw e
                        vivo.value = false
                    }
                    .collect { if (!guardando.value) actualizar() }
            }
    }

    fun actualizar() {
        if (guardando.value) return
        carga?.cancel()
        carga = viewModelScope.launch {
            estado.value = estado.value.copy(cargando = true, error = null)
            try {
                estado.value = EstadoCarga(cargar(), false)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                estado.value =
                    estado.value.copy(cargando = false, error = e.message ?: "No se pudo cargar.")
            }
        }
    }

    fun guardarOptimista(transformar: (T) -> T, accion: suspend () -> Unit) {
        if (guardando.value) return
        val anterior = estado.value.datos ?: return
        carga?.cancel()
        guardando.value = true
        mensaje.value = null
        estado.value = EstadoCarga(transformar(anterior), false)
        viewModelScope.launch {
            try {
                accion()
                mensaje.value = "Cambios guardados"
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                estado.value = EstadoCarga(anterior, false)
                mensaje.value =
                    e.message ?: "No se pudo guardar el movimiento. Se restauró el mapa."
            } finally {
                guardando.value = false
                actualizar()
            }
        }
    }

    fun guardar(accion: suspend () -> Unit, alCompletar: () -> Unit = {}) {
        if (guardando.value) return
        guardando.value = true
        mensaje.value = null
        viewModelScope.launch {
            try {
                accion()
                mensaje.value = "Cambios guardados"
                alCompletar()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                mensaje.value = e.message ?: "No se pudo guardar."
            } finally {
                guardando.value = false
                actualizar()
            }
        }
    }
}

fun <T : ViewModel> fabrica(crear: () -> T): ViewModelProvider.Factory =
    object : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <V : ViewModel> create(modelClass: Class<V>): V = crear() as V
    }

package mx.sgi.acadia.ui

import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.net.toUri
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import mx.sgi.acadia.BuildConfig

/**
 * API 37 requires runtime consent even for the emulator host alias. Release never requests LAN
 * access.
 */
@Composable
fun PermisoRedLocal(content: @Composable () -> Unit) {
    if (!BuildConfig.LOCAL_PREVIEW || Build.VERSION.SDK_INT < 37) {
        content()
        return
    }
    val context = LocalContext.current
    val permiso = "android.permission.ACCESS_LOCAL_NETWORK"
    fun concedido() =
        ContextCompat.checkSelfPermission(context, permiso) == PackageManager.PERMISSION_GRANTED
    var autorizado by remember { mutableStateOf(concedido()) }
    var denegado by remember { mutableStateOf(false) }
    val solicitar =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
            autorizado = it
            denegado = !it
        }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { autorizado = concedido() }
    if (autorizado) content()
    else
        TemaAcad {
            Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                Box(
                    Modifier.fillMaxSize().safeDrawingPadding().padding(32.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(
                        Modifier.widthIn(max = 480.dp),
                        verticalArrangement = Arrangement.spacedBy(24.dp),
                    ) {
                        Text("Conexión local", style = MaterialTheme.typography.displaySmall)
                        Text(
                            "Android necesita tu permiso para conectar este preview con el servidor de tu computadora. Solo se usará la dirección local configurada.",
                            style = MaterialTheme.typography.bodyLarge,
                        )
                        Button(
                            onClick = { solicitar.launch(permiso) },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text("Permitir conexión local")
                        }
                        if (denegado) {
                            Aviso("La conexión local está desactivada.")
                            TextButton(
                                onClick = {
                                    context.startActivity(
                                        Intent(
                                            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                            "package:${context.packageName}".toUri(),
                                        )
                                    )
                                }
                            ) {
                                Text("Abrir permisos de la aplicación")
                            }
                        }
                    }
                }
            }
        }
}

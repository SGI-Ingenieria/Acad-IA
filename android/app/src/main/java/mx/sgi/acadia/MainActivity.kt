package mx.sgi.acadia

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import mx.sgi.acadia.ui.AcadApp
import mx.sgi.acadia.ui.PermisoRedLocal

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { PermisoRedLocal { AcadApp((application as AcadIAApplication).repositorio) } }
    }
}

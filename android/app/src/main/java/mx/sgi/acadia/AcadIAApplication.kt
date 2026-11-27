package mx.sgi.acadia

import android.app.Application
import mx.sgi.acadia.data.RepositorioAcad

class AcadIAApplication : Application() {
    val repositorio by lazy { RepositorioAcad() }
}

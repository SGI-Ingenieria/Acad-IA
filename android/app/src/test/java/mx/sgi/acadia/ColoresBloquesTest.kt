package mx.sgi.acadia

import mx.sgi.acadia.data.colorBloqueCurricular
import mx.sgi.acadia.data.objeto
import org.junit.Assert.assertEquals
import org.junit.Test

class ColoresBloquesTest {
    @Test
    fun conservaElColorPersistidoAlCambiarDeVista() {
        val bloque = objeto("id" to "bloque", "color" to " #123456 ")
        assertEquals("#123456", colorBloqueCurricular(bloque, 0))
        assertEquals("#123456", colorBloqueCurricular(bloque, 8))
    }

    @Test
    fun bloquesAntiguosUsanLaMismaPaletaQueLaWeb() {
        val bloque = objeto("id" to "bloque")
        assertEquals("#4F46E5", colorBloqueCurricular(bloque, 0))
        assertEquals("#7C3AED", colorBloqueCurricular(bloque, 1))
        assertEquals("#2563EB", colorBloqueCurricular(bloque, 16))
        assertEquals("#4F46E5", colorBloqueCurricular(bloque, 17))
    }
}

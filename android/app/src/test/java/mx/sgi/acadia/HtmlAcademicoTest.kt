package mx.sgi.acadia

import mx.sgi.acadia.data.HtmlAcademico
import org.jsoup.Jsoup
import org.junit.Assert.*
import org.junit.Test

class HtmlAcademicoTest {
    @Test
    fun convierteMarcasCssEnEtiquetasCompatiblesConTiptap() {
        val html =
            HtmlAcademico.normalizar(
                "<p style='text-align: center; color:red'><span style='font-weight:700;font-style:italic;text-decoration:underline line-through'>Académico</span></p>"
            )
        val doc = Jsoup.parseBodyFragment(html)
        listOf("strong", "em", "u", "s").forEach {
            assertEquals("Académico", doc.select(it).text())
        }
        assertEquals("text-align: center", doc.selectFirst("p")!!.attr("style"))
        assertTrue(doc.select("span").isEmpty())
        assertFalse(html.contains("color:"))
        assertEquals(html, HtmlAcademico.normalizar(html))
    }

    @Test
    fun conservaEncabezadosListasAnidadasYEnlaces() {
        val html =
            "<h1>Plan</h1><h2>Perfil</h2><h3>Evidencia</h3><ol><li>Uno<ul><li><em>Dos</em></li></ul></li></ol><p><a href=\"https://example.org\">Fuente</a></p>"
        val doc = Jsoup.parseBodyFragment(HtmlAcademico.normalizar(html))
        assertEquals(3, doc.select("h1,h2,h3").size)
        assertEquals("Dos", doc.select("ol > li > ul > li > em").text())
        assertEquals("https://example.org", doc.selectFirst("a")!!.attr("href"))
    }

    @Test
    fun eliminaScriptsEventosImagenesYProtocolosActivos() {
        val html =
            HtmlAcademico.normalizar(
                "<script>alert(1)</script><p onclick='alert(2)' style='background:url(https://example.org/track)'>Texto<img src='https://example.org/track'><a href='javascript:alert(3)'>Enlace</a></p><iframe src='https://example.org'></iframe>"
            )
        val doc = Jsoup.parseBodyFragment(html)
        assertEquals("TextoEnlace", doc.body().text())
        assertTrue(doc.select("script,img,iframe,[onclick],[style]").isEmpty())
        assertFalse(doc.selectFirst("a")!!.hasAttr("href"))
    }

    @Test
    fun textoPlanoMantieneParrafosSaltosYCaracteresReservados() {
        val doc =
            Jsoup.parseBodyFragment(
                HtmlAcademico.normalizar("A & B < 5\nSegunda línea\n\nOtro párrafo")
            )
        assertEquals(2, doc.select("p").size)
        assertEquals(1, doc.select("br").size)
        assertTrue(doc.body().text().contains("A & B < 5"))
    }
}

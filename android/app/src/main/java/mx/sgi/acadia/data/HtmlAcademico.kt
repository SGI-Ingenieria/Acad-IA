package mx.sgi.acadia.data

import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.jsoup.nodes.Element
import org.jsoup.safety.Safelist

/** Same HTML vocabulary as the web editor; no WebView, scripts, images or remote embeds. */
object HtmlAcademico {
    private val permitido =
        Safelist.none()
            .addTags(
                "p",
                "br",
                "strong",
                "b",
                "em",
                "i",
                "u",
                "s",
                "del",
                "code",
                "pre",
                "h1",
                "h2",
                "h3",
                "ul",
                "ol",
                "li",
                "a",
                "blockquote",
                "span",
            )
            .addAttributes(":all", "style")
            .addAttributes("a", "href")
            .addProtocols("a", "href", "https", "http", "mailto")

    fun normalizar(valor: String): String {
        val entrada =
            if (Regex("</?[a-z][\\s\\S]*>", RegexOption.IGNORE_CASE).containsMatchIn(valor)) valor
            else
                valor.split(Regex("\\n{2,}")).joinToString("") { bloque ->
                    "<p>${org.jsoup.nodes.Entities.escape(bloque, Document.OutputSettings().prettyPrint(false)).replace("\n", "<br>")}</p>"
                }
        val limpio =
            Jsoup.clean(entrada, "", permitido, Document.OutputSettings().prettyPrint(false))
        val doc = Jsoup.parseBodyFragment(limpio)
        doc.outputSettings().prettyPrint(false)
        // Compose exports CSS spans; Tiptap's sanitizer intentionally discards span tags.
        // Convert marks to semantic tags so Android -> web -> Android retains formatting.
        doc.select("[style]").toList().forEach { elemento ->
            val css =
                elemento
                    .attr("style")
                    .split(';')
                    .mapNotNull {
                        val par = it.split(':', limit = 2)
                        if (par.size == 2) par[0].trim().lowercase() to par[1].trim().lowercase()
                        else null
                    }
                    .toMap()
            val etiquetas = buildList {
                if (css["font-weight"] in listOf("bold", "bolder", "600", "700", "800", "900"))
                    add("strong")
                if (css["font-style"] in listOf("italic", "oblique")) add("em")
                if (css["text-decoration"]?.contains("underline") == true) add("u")
                if (css["text-decoration"]?.contains("line-through") == true) add("s")
            }
            etiquetas.forEach { etiqueta ->
                if (elemento.tagName() != etiqueta) {
                    val marca = Element(etiqueta)
                    elemento.childNodes().toList().forEach { marca.appendChild(it) }
                    elemento.appendChild(marca)
                }
            }
            elemento.removeAttr("style")
            css["text-align"]
                ?.takeIf { it in listOf("left", "right", "center", "justify", "start", "end") }
                ?.let { elemento.attr("style", "text-align: $it") }
        }
        doc.select("span").toList().forEach { it.unwrap() }
        doc.select("b").forEach { it.tagName("strong") }
        doc.select("i").forEach { it.tagName("em") }
        return doc.body().html()
    }
}

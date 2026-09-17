package mx.sgi.acadia.ui

import androidx.activity.ComponentActivity
import androidx.activity.compose.LocalActivity
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.*
import androidx.compose.ui.unit.sp
import kotlin.math.*
import mx.sgi.acadia.R

val Indivisa =
    FontFamily(
        Font(R.font.indivisa_sans_regular),
        Font(R.font.indivisa_sans_bold, FontWeight.Bold),
        Font(R.font.indivisa_sans_black, FontWeight.Black),
    )
val IndivisaSerif = FontFamily(Font(R.font.indivisa_serif_regular))

// Source tokens: src/styles.css. OKLCH conversion keeps the Android palette in the same color
// space.
internal fun oklch(l: Double, c: Double, h: Double): Color {
    val a = c * cos(h * PI / 180)
    val b = c * sin(h * PI / 180)
    val ll = (l + .3963377774 * a + .2158037573 * b).pow(3)
    val mm = (l - .1055613458 * a - .0638541728 * b).pow(3)
    val ss = (l - .0894841775 * a - 1.2914855480 * b).pow(3)
    fun srgb(x: Double): Float =
        (if (x <= .0031308) 12.92 * x else 1.055 * x.pow(1.0 / 2.4) - .055)
            .coerceIn(0.0, 1.0)
            .toFloat()
    return Color(
        srgb(4.0767416621 * ll - 3.3077115913 * mm + .2309699292 * ss),
        srgb(-1.2684380046 * ll + 2.6097574011 * mm - .3413193965 * ss),
        srgb(-.0041960863 * ll - .7034186147 * mm + 1.7076147010 * ss),
    )
}

private val Claro =
    lightColorScheme(
        primary = oklch(.5332, .2596, 262.6358),
        onPrimary = Color.White,
        primaryContainer = oklch(.94, .014, 263.0),
        onPrimaryContainer = oklch(.235, .062, 263.0),
        secondary = oklch(.468, .198, 263.0),
        secondaryContainer = oklch(.918, .048, 22.0),
        onSecondaryContainer = oklch(.235, .062, 263.0),
        background = oklch(.97, .009, 263.0),
        onBackground = oklch(.235, .062, 263.0),
        surface = oklch(.995, .003, 263.0),
        onSurface = oklch(.235, .062, 263.0),
        surfaceContainer = oklch(.958, .011, 263.0),
        surfaceContainerLow = oklch(.97, .009, 263.0),
        surfaceContainerHigh = oklch(.94, .014, 263.0),
        surfaceVariant = oklch(.95, .011, 263.0),
        onSurfaceVariant = oklch(.415, .025, 263.0),
        outline = oklch(.65, .025, 263.0),
        outlineVariant = oklch(.875, .018, 263.0),
        error = oklch(.55, .1902, 23.0704),
        onError = Color.White,
    )
private val Oscuro =
    darkColorScheme(
        primary = oklch(.638, .196, 264.0),
        onPrimary = oklch(.118, .032, 263.0),
        primaryContainer = oklch(.228, .028, 265.0),
        onPrimaryContainer = oklch(.945, .008, 248.0),
        secondary = oklch(.82, .148, 32.0),
        secondaryContainer = oklch(.242, .068, 32.0),
        onSecondaryContainer = oklch(.945, .008, 248.0),
        background = oklch(.118, .032, 263.0),
        onBackground = oklch(.945, .008, 248.0),
        surface = oklch(.158, .042, 262.0),
        onSurface = oklch(.945, .008, 248.0),
        surfaceContainer = oklch(.195, .038, 264.0),
        surfaceContainerLow = oklch(.142, .038, 262.0),
        surfaceContainerHigh = oklch(.228, .028, 265.0),
        surfaceVariant = oklch(.215, .022, 263.0),
        onSurfaceVariant = oklch(.75, .018, 258.0),
        outline = oklch(.55, .028, 264.0),
        outlineVariant = oklch(.295, .028, 264.0),
        error = oklch(.758, .16, 22.0),
        onError = oklch(.118, .032, 263.0),
    )

private fun texto(size: Int, line: Int, weight: FontWeight = FontWeight.Normal) =
    TextStyle(
        fontFamily = Indivisa,
        fontSize = size.sp,
        lineHeight = line.sp,
        fontWeight = weight,
        letterSpacing = (-.2).sp,
    )

private val Tipografia =
    Typography(
        displayLarge = texto(52, 56, FontWeight.Black),
        displayMedium = texto(42, 46, FontWeight.Black),
        displaySmall = texto(36, 40, FontWeight.Black),
        headlineLarge = texto(32, 36, FontWeight.Black),
        headlineMedium = texto(28, 32, FontWeight.Black),
        headlineSmall = texto(24, 30, FontWeight.Bold),
        titleLarge = texto(22, 28, FontWeight.Bold),
        titleMedium = texto(18, 24, FontWeight.Bold),
        titleSmall = texto(16, 22, FontWeight.Bold),
        bodyLarge = texto(17, 25),
        bodyMedium = texto(15, 22),
        bodySmall = texto(13, 18),
        labelLarge = texto(15, 20, FontWeight.Bold),
        labelMedium = texto(13, 18, FontWeight.Bold),
        labelSmall = texto(11, 16, FontWeight.Bold),
    )

@Composable
fun TemaAcad(modo: String = "sistema", content: @Composable () -> Unit) {
    val oscuro = if (modo == "sistema") isSystemInDarkTheme() else modo == "oscuro"
    val activity = LocalActivity.current as? ComponentActivity
    SideEffect {
        val style =
            if (oscuro) SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
            else
                SystemBarStyle.light(
                    android.graphics.Color.TRANSPARENT,
                    android.graphics.Color.TRANSPARENT,
                )
        activity?.enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
    }
    MaterialTheme(
        colorScheme = if (oscuro) Oscuro else Claro,
        typography = Tipografia,
        content = content,
    )
}

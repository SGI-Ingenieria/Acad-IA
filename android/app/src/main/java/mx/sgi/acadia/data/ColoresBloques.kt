package mx.sgi.acadia.data

// Same fallback order as src/lib/linea-curricular-colors.ts for legacy blocks without a color.
val paletaBloques =
    listOf(
        "#4F46E5",
        "#7C3AED",
        "#9333EA",
        "#C026D3",
        "#DB2777",
        "#E11D48",
        "#059669",
        "#16A34A",
        "#65A30D",
        "#CA8A04",
        "#D97706",
        "#EA580C",
        "#DC2626",
        "#0D9488",
        "#0891B2",
        "#0284C7",
        "#2563EB",
    )

fun colorBloqueCurricular(bloque: Registro, indice: Int): String =
    bloque.texto("color").trim().ifBlank {
        paletaBloques[Math.floorMod(indice, paletaBloques.size)]
    }

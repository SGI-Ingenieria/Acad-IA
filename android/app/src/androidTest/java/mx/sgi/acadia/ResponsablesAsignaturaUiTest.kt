package mx.sgi.acadia

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createComposeRule
import mx.sgi.acadia.data.*
import mx.sgi.acadia.ui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class ResponsablesAsignaturaUiTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun seleccionarProfesorExistenteNoEnviaInvitaciones() {
        var seleccionado = ""
        var invitaciones = 0
        compose.setContent {
            TemaAcad("claro") {
                SelectorProfesorResponsable(
                    DatosResponsables(
                        emptyList(),
                        listOf(
                            objeto(
                                "id" to "maria",
                                "nombre_completo" to "María Silva",
                                "email" to "maria@example.edu",
                            )
                        ),
                        true,
                        true,
                    ),
                    false,
                    null,
                    null,
                    {},
                    {},
                    { seleccionado = it },
                    { _, _ -> invitaciones++ },
                )
            }
        }
        compose.onNodeWithText("Asignar profesor").assertIsNotEnabled()
        compose.onNodeWithTag("profesor-maria").performClick()
        compose.onNodeWithText("Asignar profesor").performScrollTo().performClick()
        compose.runOnIdle {
            assertEquals("maria", seleccionado)
            assertEquals(0, invitaciones)
        }
    }

    @Test
    fun invitacionSeValidaAntesDeEnviar() {
        var correoEnviado = ""
        compose.setContent {
            TemaAcad("claro") {
                SelectorProfesorResponsable(
                    DatosResponsables(emptyList(), emptyList(), true, true),
                    false,
                    null,
                    null,
                    {},
                    {},
                    {},
                    { _, correo -> correoEnviado = correo },
                )
            }
        }
        compose.onNodeWithText("Invitar por correo").performScrollTo().performClick()
        compose.onNodeWithText("Invitar y asignar").assertIsNotEnabled()
        compose.onNodeWithText("Nombre completo").performTextInput("María Silva")
        compose.onNodeWithText("Correo electrónico").performTextInput("maria@example.edu")
        compose.runOnIdle { assertEquals("", correoEnviado) }
        compose.onNodeWithText("Invitar y asignar").performScrollTo().performClick()
        compose.runOnIdle { assertEquals("maria@example.edu", correoEnviado) }
    }

    @Test
    fun sinPermisoDeInvitarSoloOfreceUsuariosExistentes() {
        compose.setContent {
            TemaAcad("claro") {
                SelectorProfesorResponsable(
                    DatosResponsables(emptyList(), emptyList(), true, false),
                    false,
                    null,
                    null,
                    {},
                    {},
                    {},
                    { _, _ -> },
                )
            }
        }
        compose.onNodeWithText("Invitar por correo").assertDoesNotExist()
    }
}

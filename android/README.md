# Acad-IA · Android nativo

Preview **Kotlin + Jetpack Compose**, sin React Native ni WebView. Es una primera plataforma Android ejecutable, **no una versión con paridad completa ni una entrega de producción**. Reutiliza los contratos de la web; las migraciones de sincronización y permisos se validan primero en Supabase local.

## Abrir y probar en esta computadora

### Primera instalación o reparación desde PowerShell

Ejecuta **en tu propia consola**, desde la raíz del repositorio:

```powershell
bun run android:instalar
bun run android:preview
```

El primer comando instala los paquetes estables actuales de Google en el SDK indicado por `ANDROID_HOME` / `ANDROID_SDK_ROOT` (por defecto `%LOCALAPPDATA%\Android\Sdk`), verifica el checksum del instalador y crea `Acad_IA_API_37_2` si no existe. Descarga varios GB y solicita aceptar las licencias en la misma consola. No borra emuladores existentes, no necesita abrir Android Studio y no cambia Supabase. Requiere el JDK de Android Studio; si falta, muestra el comando de instalación correspondiente. La versión de plataforma e imagen sigue la del proyecto; las herramientas se resuelven desde el canal estable de Google.

Si aparece `ENOENT`, `Test-Path` devuelve `False` o falta `adb.exe`, **no basta con definir variables de entorno**: ejecuta `bun run android:instalar` en esa terminal. El preview ahora detecta esos archivos antes de compilar. La existencia de herramientas en otra sesión no garantiza que tu consola tenga acceso a ellas.

En Windows, MSIX puede redirigir una instalación realizada desde Codex a `%LOCALAPPDATA%\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\Android\Sdk`. Si tu SDK normal no existe, el instalador recupera esa copia desde **tu consola** sin volver a descargarla. Nunca sobrescribe un SDK existente. Ver [redirección de archivos de aplicaciones empaquetadas](https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-behind-the-scenes).

Compatibilidad Windows: el instalador invoca el SDK Manager Java **incluido en Command-line Tools 23**, porque su nuevo wrapper nativo terminó con `0xc0000409` durante la verificación. No instala versiones antiguas. Usa el AVD Manager Java del mismo paquete porque [Android CLI documenta limitaciones de emulación en Windows](https://developer.android.com/tools/agents/android-cli#known-issues).

### Uso habitual

1. Mantén Docker Desktop y el Supabase local de Acad-IA encendidos. No ejecutes `db reset`.
2. Desde la raíz del repositorio:

   ```powershell
   bun run android:preview
   ```

   Este comando obtiene **solo la clave pública anónima local**, compila, inicia el emulador `Acad_IA_API_37_2` si hace falta, instala `Acad-IA · Local` y abre la aplicación. No despliega servicios ni utiliza el backend alojado.

3. En una instalación nueva, pulsa **Permitir conexión local** y acepta el permiso de Android 17. Se necesita para conectar con Supabase en `10.0.2.2:54321`, la dirección del host desde el emulador. La aplicación de producción no declara este permiso.
4. Usa **Externo** con una cuenta del seed local. En el seed actual, `roberto.silva@lasalle.mx` tiene como contraseña de prueba el mismo correo. Esto es exclusivamente un fixture local; nunca uses esa credencial en un entorno real.
5. Abre **Planes → un plan → Mapa curricular → una asignatura**. Prueba sus pestañas y edita un registro de prueba. Los cambios son reales y aparecen también en Supabase local.
6. En **Cuenta → Apariencia**, prueba Claro, Oscuro y Seguir el sistema. Gira el emulador y prueba un tamaño de fuente mayor desde los ajustes de Android.

También puedes abrir **Android Studio → Open → la carpeta `android/`**, esperar Gradle Sync, seleccionar **app**, elegir **Acad_IA_API_37_2** y pulsar **Run ▶**. Antes del primer build ejecuta `bun run android:configurar`. El proyecto usa el JDK incluido con Android Studio; selecciona ese JDK en _Settings → Build Tools → Gradle_ si Studio pide uno.

El script utiliza un JDK con `javac`, no un JRE. `ANDROID_JAVA_HOME` permite indicar otro JDK compatible. `ANDROID_AVD` permite elegir otro emulador ya creado. Si hay varios dispositivos, selecciona uno con `ANDROID_SERIAL`.

### Teléfono conectado por USB

Activa la depuración USB y autoriza la computadora en el teléfono. Con Docker y Supabase local activos:

```powershell
# Consulta el número de serie con adb devices; si solo hay uno, omite ANDROID_SERIAL.
$env:ANDROID_SERIAL = 'numero-de-serie-del-telefono'
bun run android:preview
```

El comando detecta el teléfono, configura `127.0.0.1`, establece `adb reverse` hacia el puerto local de Supabase y reinstala/abre la app conservando sus datos. En un emulador utiliza `10.0.2.2`. Mantén el cable conectado para esta prueba; no expone Supabase a la red. No ejecutes `android:test:ui` en tu teléfono de uso habitual: navega y cambia de sesión automáticamente. Usa el emulador para esa suite.

En Windows, el preview inicia con **SwiftShader y arranque en frío**, sin borrar datos: el renderizado Intel UHD 770 produjo superficies vacías con esta imagen. `ANDROID_EMULATOR_GPU=host` o `auto` permite probar aceleración en otro equipo. Si ya había un emulador abierto con gráficos defectuosos, ciérralo y ejecuta de nuevo el preview. [Modos gráficos oficiales](https://developer.android.com/studio/run/emulator-acceleration).

### Probar el mapa y la edición enriquecida

- **Mapa curricular:** mantén pulsado el agarre junto a la clave de una asignatura y arrástrala a otro ciclo/bloque. El destino se resalta; acercarte al borde desplaza el mapa. También puedes usar **⋯ → Ciclo de destino / Bloque formativo → Guardar**, o cambiar a **Vista lista**.
- Los movimientos aparecen inmediatamente, muestran su guardado y revierten si falla. Se vuelve a consultar el servidor antes de escribir; una revisión obsoleta se rechaza. Un movimiento que rompería seriaciones exige ajustarlas primero, sin aceptar su eliminación silenciosa.
- **Resumen → lápiz de un campo académico:** selecciona texto para aplicar negrita, cursiva, subrayado o tachado. Usa **Párrafo / H1 / H2 / H3**, viñetas, numeración, sangría, alineación y deshacer/rehacer. Las barras de herramientas se desplazan horizontalmente en pantallas estrechas.
- Guarda, vuelve a abrir y comprueba el mismo campo en la web conectada a Supabase local. La lectura y edición usan HTML semántico compatible con su sanitizador. Los borradores sobreviven a la recreación del editor; salir con cambios pide confirmación. Un fallo al guardar conserva el borrador.
- Los textos extensos de bloques formativos usan el mismo editor. Sus cambios se incorporan al formulario del bloque; hay que guardar también ese formulario.

### Pulido de experiencia académica

- **Nuevo plan:** elige la facultad por su insignia y color; las carreras se agrupan por nivel y respetan el ámbito de tus roles. El inicio de impartición usa un selector de mes/año. Los ciclos propuestos proceden del catálogo de la carrera; las semanas sin configurar se solicitan explícitamente.
- **Inicio y catálogos:** cuatro destinos: Inicio, Planes, Asignaturas y Cuenta. Inicio permanece vacío, reservado para el próximo diseño. No hay botones de refrescar. Los catálogos se reconcilian tras escrituras, eventos Realtime, reconexión y al retomar la pantalla, conservando el contenido visible y las páginas ya cargadas.
- **Cuenta → Facultades y carreras:** cada facultad despliega sus carreras por nivel. La insignia y el color pertenecen a la facultad; no se repiten iconos en cada carrera ni en su selector.
- **Guardado:** un snackbar nativo temporal y descartable confirma el resultado sin desplazar el contenido. Los errores de formulario conservan el borrador. No se muestran banners de infraestructura o disponibilidad interna de IA/Realtime. Los errores reales y los permisos sí se explican.
- **Duración del ciclo:** campo ordinario del resumen y del editor de datos generales; nombre/fecha curriculares conservan las restricciones del servidor.
- **Temas y evaluación:** editores nativos de pantalla completa con composición inferior, alta desde el teclado, reordenación, eliminación y confirmación al salir con cambios. La evaluación muestra total y porcentaje pendiente; guarda el contrato web `{criterio, porcentaje}` con porcentajes enteros y suma 100, sin truncarlos silenciosamente.
- **Lista de asignaturas:** el nombre de la asignatura encabeza la fila; debajo aparecen el plan y un icono de facultad de 18 dp sin fondo. En planes curriculares se muestra nivel + carrera (sin «Otro»); los demás conservan su nombre propio. Clave, créditos y ciclo explícito —por ejemplo, «Semestre 4»— completan la fila, sin estado ni número aislado. Se reutiliza el contrato del catálogo y la semántica [clickable de Compose](https://developer.android.com/develop/ui/compose/accessibility/semantics): una acción por fila, facultad accesible y texto que puede ocupar varias líneas.
- **Mapa curricular:** un selector nativo ofrece **Mapa / Lista / Bloques**. Los bloques definidos van primero; «Sin bloque» y luego «Sin ciclo» quedan al final del mapa. En lista, mantén pulsada una asignatura y elige **Mover asignatura**; los destinos conservan sus colores. TalkBack ofrece la misma acción contextual. Un único **+** superior crea una asignatura en Mapa/Lista y un bloque en Bloques, según permisos.
- **Revisión:** la acción principal nombra el destino académico autorizado. Puedes añadir un comentario antes de confirmar. Una asignatura aprobada conserva sus observaciones en consulta, sin escribir ni resolver; el botón contextual permite reabrirla con advertencia y motivo si el servidor autoriza la transición.
- **Historial:** disponible únicamente desde la barra superior de Revisión. Busca por autor, campo o contenido y despliega un evento para comparar antes/después. No se elimina ni descarta auditoría: el contrato actual del servidor sólo admite resolver observaciones. Resolver/reabrir se hace desde el icono a la derecha de cada comentario, con avatares compactos.
- **Bibliografía:** **+** ofrece captura manual, Biblioteca La Salle o búsqueda en línea mediante las Edge Functions de la web. Los resultados consultados conservan metadatos de solo lectura y procedencia; previsualiza la cita generada y pulsa **Aceptar referencia**. La captura manual sigue editable. El formateador nativo cubre libros en APA/IEEE/Vancouver/Chicago, contrastados con fixtures del CSL web: no es un motor CSL general. Otros tipos documentales requieren captura manual; no se inventan autores ni fechas ausentes ni se reemplazan silenciosamente citas previas.
- **Asistente IA:** abre directamente un borrador con escritura, envío y dictado del sistema Android. El dictado coloca texto para revisarlo antes de enviar; requiere un reconocedor instalado, no es una conversación de audio en tiempo real. **Chats recientes** permite abrir, archivar y restaurar. Las recomendaciones se resumen en un bloque y se revisan en una hoja antes de aplicar cada cambio; se comprueban permisos y revisiones vigentes. Entrar y salir sin enviar no crea una conversación.
- **Responsables:** pestaña propia de la asignatura, separada del resumen. Elige un profesor existente o invita por nombre/correo según tus permisos. Si se crea la invitación pero falla la asignación, el flujo permite completar esa asignación sin repetir el correo mientras se conserva la sesión del editor.
- **Estructuras:** toca una estructura en Cuenta para consultar sus campos, tipos, obligatoriedad y reglas; en un plan se incluye la estructura vinculada de sus asignaturas. El botón de compartir se retiró del expediente.

La migración `20260918175036_android_sincronizacion_academica.sql` publica las relaciones académicas observadas en `supabase_realtime`, sin ampliar grants ni cambiar RLS. Los trabajos internos de IA no se publican: se observan sus mensajes. Se agrupan ráfagas de eventos durante 150 ms antes de reconciliar por HTTP; las invalidaciones locales siguen funcionando independientemente del WebSocket. Se usan [efectos de ciclo de vida](https://developer.android.com/topic/libraries/architecture/lifecycle), [canales de Supabase Kotlin](https://supabase.com/docs/reference/kotlin/subscribe), [snackbars](https://developer.android.com/develop/ui/compose/components/snackbar) y [selectores segmentados](https://developer.android.com/develop/ui/compose/components/segmented-button), sin sondeo periódico ni dependencias nuevas. La publicación fue aplicada y probada en el backend local; el despliegue alojado de la migración queda sujeto al flujo habitual de revisión.

Las migraciones `20260918212148_cerrar_observaciones_asignaturas_aprobadas.sql` y `20260918213649_permiso_gestion_responsables_asignatura.sql` añaden políticas restrictivas sobre las políticas de ámbito existentes. La primera cierra escrituras de observaciones de asignaturas aprobadas, incluidas las heredadas de `comentarios_plan`; la segunda exige el permiso canónico de gestión de responsables. No amplían lectura ni cambian las operaciones internas autorizadas de `service_role`. Ambas se aplicaron únicamente al backend local y pasaron **34 verificaciones pgTAP**. No se ejecutó un reset ni se aplicaron migraciones pendientes ajenas al cambio.

`20260918221742_android_realtime_responsables.sql` incorpora `responsables_asignatura` a la publicación existente sin cambiar RLS. El canal se validó con la confirmación `system: ok` del servidor, no solo con el estado de conexión del WebSocket. Las tres suites enfocadas (incluida publicación/seguridad) pasan **38 verificaciones pgTAP** en Supabase local.

La validación local de estas tres migraciones se aplicó con `psql` transaccional, sin modificar el historial de migraciones. `migration list --local` aún las muestra pendientes; no ejecutes un `migration up` local indiscriminado porque también hay migraciones anteriores ajenas pendientes. El despliegue alojado debe seguir el flujo de revisión habitual.

APK local: `app/build/outputs/apk/debug/app-debug.apk`. Identificador: `mx.sgi.acadia.preview`. Puede coexistir con una futura versión de producción.

## Alcance del preview

| Área               | Disponible en Android                                                                                                                                                                       | Pendiente para paridad                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Identidad y diseño | Indivisa Sans/Serif del proyecto, colores derivados de `src/styles.css`, tema persistente, edge-to-edge, navegación inferior/rail, formularios desplazables, tooltips y semántica accesible | Auditoría completa con TalkBack y dispositivos físicos                                                                                      |
| Sesión             | Acceso externo GoTrue solo en debug local, restauración de sesión, cierre local, solicitud de recuperación                                                                                  | Verificación end-to-end del gateway institucional, session gate de release y recuperación completa                                          |
| Planes             | Catálogo paginado/búsqueda, expediente, alta manual, fundamentos escalares, ciclos, mapa, bloques, comentarios, historial y consulta de registros oficiales                                 | Versionado curricular, recomendación automática de estructuras, restauración histórica, aprobación con documentos y administración avanzada |
| Asignaturas        | Consulta/alta/edición, horas/créditos, contenido temático, evaluación, bibliografía con previsualización, responsables, observaciones e historial                                           | Reordenamiento avanzado, prerrequisitos, recursos didácticos y editor enriquecido completo                                                  |
| Revisión           | Permisos consultados al servidor; transiciones mediante las Edge Functions existentes; resolución de comentarios                                                                            | Validación end-to-end de todas las combinaciones de roles y estados                                                                         |
| IA                 | Borrador directo, dictado, recientes/archivados, mensajes Realtime y revisión/aplicación explícita de recomendaciones                                                                       | Validación con proveedor real, referencias adjuntas, audio conversacional y paridad integral de herramientas de la web                      |
| Institución        | Consulta de facultades, carreras, estructuras, registros y notificaciones                                                                                                                   | Administración de usuarios/roles, catálogos editables, importación, archivos, biblioteca, evaluaciones y analítica avanzada                 |
| Documentos         | Consulta de los datos académicos; sin botón de compartir                                                                                                                                    | Exportación oficial PDF/Excel/Word y documentos firmados                                                                                    |

Las funcionalidades de IA necesitan las credenciales del proveedor **en el servidor**, nunca en el APK. No se simulan respuestas ni se aplican propuestas automáticamente: el botón Enviar inicia la consulta y aplicar una recomendación requiere otra acción explícita. La creación de conversación y el primer mensaje son operaciones separadas del backend: un fallo entre ambas puede dejar una fila vacía (oculta de recientes y reutilizada al reintentar si se recibió su ID). Un timeout antes de recibir el ID no tiene recuperación idempotente garantizada por el contrato actual. No se borran filas con una comprobación susceptible a carreras ni se reenvían automáticamente consultas pagadas. El health endpoint local respondió durante la preparación; eso no valida cada función ni las credenciales externas.

Los campos académicos enriquecidos conservan párrafos, marcas, encabezados H1–H3, listas anidadas, alineación y enlaces existentes, sin WebView. Se eliminan scripts, eventos, imágenes y recursos remotos. El editor no ofrece todavía inserción de enlaces, tablas ni adjuntos. Los objetos y listas del esquema se muestran en consulta. El mapa carga todas sus asignaturas mediante paginación; algunas consultas secundarias muestran hasta 300 filas. Quedan pendientes el reordenamiento dentro de una celda, la edición de seriaciones y las excepciones administrativas avanzadas del mapa web.

## Seguridad y datos

- Un único `RepositorioAcad` usa el cliente [Supabase Kotlin](https://supabase.com/docs/reference/kotlin), Auth, PostgREST, Functions y Realtime. Compose no invoca Supabase directamente.
- RLS/RPCs siguen siendo la autoridad. Los permisos del JWT solo controlan la presentación. Un plan visible por metadatos no se abre si el RPC no concede acceso al expediente.
- Actualizaciones de expedientes con comparación de `actualizado_en`: un formulario obsoleto no sobrescribe cambios de otra persona. Hay progreso, errores recuperables y conservación de datos durante recargas.
- `preview.properties` y `local.properties` están ignorados. Solo se copia la clave **anon**, jamás service-role, contraseñas o claves de proveedores. No publiques APKs debug configurados para datos sensibles.
- El tráfico HTTP está limitado a los hosts locales en la variante debug. Release requiere HTTPS y sus propias variables `ANDROID_SUPABASE_URL` / `ANDROID_SUPABASE_ANON_KEY`; no hereda el backend local. Release no está firmado ni validado para distribución.
- Las sesiones no se incluyen en copias de seguridad ni transferencias entre dispositivos. No hay almacenamiento offline de expedientes ni cola de escrituras offline.
- No se ejecutan migraciones, despliegues ni resets del backend desde estos scripts.

## Herramientas

Versiones estables consultadas al iniciar este preview (17 de septiembre de 2026); están fijadas para que el build sea reproducible:

- Android Studio Quail 4, 2026.1.4.7; JDK incorporado 25.0.3.
- Android SDK 37.2 / Android 17; target SDK 37, min SDK 26; Build Tools 37.0.0.
- Gradle 9.7.1 (wrapper con checksum), AGP 9.4.0 y Kotlin 2.4.20.
- Compose BOM 2026.09.00, Activity 1.13.0, Lifecycle 2.11.0, Navigation Compose 2.10.1.
- Supabase Kotlin BOM 3.8.0 y Ktor 3.6.0.
- Compose Rich Editor 1.2.0 y jsoup 1.23.2. El HTML se normaliza a las etiquetas permitidas por `src/components/editor/sanitize.ts`; los spans CSS se convierten en marcas semánticas. Se incluyen Indivisa Sans Italic y Bold Italic del proyecto.
- Espresso 3.7.0 y AndroidX Test 1.7.0 explícitos: la dependencia transitiva anterior no funciona con las restricciones de Android 17.

AGP 9 usa Kotlin integrado: no se añade `org.jetbrains.kotlin.android`. Las fuentes son las mismas que ya existen en `public/fonts/indivisa/`; se empaquetan localmente, sin descargarlas durante el uso.

Referencias: [Supabase Kotlin](https://supabase.com/docs/reference/kotlin), [arquitectura Android](https://developer.android.com/topic/architecture), [Compose](https://developer.android.com/develop/ui/compose), [permiso de red local](https://developer.android.com/privacy-and-security/local-network-permission), [red del emulador](https://developer.android.com/studio/run/emulator-networking-address), [AGP 9.4](https://developer.android.com/build/releases/agp-9-4-0-release-notes).

## Verificación

```powershell
bun run android:configurar
bun run android:build
bun run android:verificar

# Solo una cuenta de pruebas del Supabase local:
$env:ANDROID_TEST_EMAIL = 'correo-de-prueba-local'
$env:ANDROID_TEST_PASSWORD = 'contraseña-de-prueba-local'
bun run android:test:api
bun run android:test:realtime
bun run android:test:ui

# Opcional: ejecutar solo el recorrido real, sin repetir las pruebas aisladas.
$env:ANDROID_TEST_CLASS = 'mx.sgi.acadia.PreviewLocalTest'
bun run android:test:ui
Remove-Item Env:ANDROID_TEST_CLASS
```

- **84 tests JVM aprobados:** validación de horas/evaluación, búsqueda, permisos, restricciones del host local, normalización/sanitización HTML, seriaciones y movimiento inmutable del mapa; ámbito de facultad/carrera, mes/año, colores de bloques, transiciones contextuales, fechas del historial y metadatos/enlaces de bibliografía. Incluyen nombres curriculares/no curriculares, ciclos explícitos, créditos, autocitas y procedencia persistida, cierre de revisión, invitación/asignación parcial, estructura académica, borradores conservados por conversación, plazo de solicitudes sin publicar y recomendaciones de bloque que no sobrescriben el ciclo.
- Contratos API: login, catálogos, joins, permisos, historial, alta/edición de una asignatura, bibliografía y comentarios. Crea y elimina únicamente sus fixtures UUID.
- **38 pruebas Compose y 5 capturas instrumentadas aprobadas:** arrastre nativo, movimiento contextual, reversión optimista, selección/formato, listas y descarte con texto grande; revisión contextual y aprobada, observaciones pendientes/resueltas, comparación del historial, cita bibliográfica readonly, selector de responsables y chat/recomendaciones. Las cinco capturas se inspeccionaron visualmente. La lista de asignaturas se comprueba con icono compacto, ciclo explícito y nombres largos con texto al 160 %.
- **Recorrido real `PreviewLocalTest` aprobado** (362 segundos; 44 pruebas instrumentadas distintas en total con las anteriores): acceso, navegación, facultades/carreras agrupadas y mes/año, pestaña de responsables fuera del resumen, IA sin crear conversaciones al abrir/volver, alta de plan con reconciliación automática, guardado de horas/criterios/texto enriquecido/temas, rechazo de edición obsoleta y tema persistente. El runner selecciona un plan editable mediante el RPC de autorización y limpia solo sus dos fixtures UUID —asignatura y plan— incluso si falla. No envía consultas a proveedores de IA ni invitaciones por correo.
- **Sincronización y editores:** la prueba Android crea una observación desde otro cliente REST y espera verla en Revisión, sin invalidación local, recarga ni navegación. También comprueba edición persistida de semanas, facultades con carreras, guardado canónico de criterios, conservación del borrador ante error, reordenación de temas y snackbars que expiran o se cierran manualmente. `android:test:realtime` valida el WebSocket autenticado; 4 pruebas pgTAP verifican publicación y preservación de RLS. La migración solo se aplicó localmente.
- **Búsquedas HTTP desde Supabase local, verificación anterior:** `buscar-bibliografia` respondió **200 con 40 resultados** y `biblioteca` respondió **200 con 10 resultados**. Se consultaron los servicios bibliográficos, sin IA. Esto verifica el contrato HTTP local, **no una búsqueda completa end-to-end desde la interfaz Android**. La previsualización y el formateador nativo se cubren por separado con fixtures y pruebas de interfaz.
- Android Lint y compilación en CI sin credenciales del backend. La prueba end-to-end se ejecuta localmente; no se debe interpretar el build de CI como validación de Supabase.
- **Comprobación adicional del backend local:** `plan_stage_permissions.test.sql` pasó sus 37 verificaciones. `authz_contracts.test.sql` pasó 28/31; fallan las expectativas de `planes.crear` para SECRETARIO_ACADEMICO y de ausencia de `catalogos.gestionar` para JEFE_CARRERA y SECRETARIO_ACADEMICO. Estos cambios no modifican las asignaciones de roles/permisos y no se alteraron para hacer pasar la suite.

Para probar manualmente sin tocar contenido previo, crea un plan/asignatura de prueba. Si Docker se detiene, la interfaz conserva los datos y muestra el error; vuelve a iniciar los servicios y regresa a la pantalla o usa **Reintentar** en el error. Este preview está listo para recoger feedback de uso, no para sustituir todas las operaciones de la versión web.

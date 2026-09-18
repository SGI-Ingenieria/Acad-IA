# Acad-IA · Android nativo

Preview **Kotlin + Jetpack Compose**, sin React Native ni WebView. Es una primera plataforma Android ejecutable, **no una versión con paridad completa ni una entrega de producción**. La aplicación web y el esquema de Supabase no se modifican.

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

El script utiliza un JDK con `javac`, no un JRE. `ANDROID_JAVA_HOME` permite indicar otro JDK compatible. `ANDROID_AVD` permite elegir otro emulador ya creado. Conecta solo un dispositivo durante el uso del script.

En Windows, el preview inicia con **SwiftShader y arranque en frío**, sin borrar datos: el renderizado Intel UHD 770 produjo superficies vacías con esta imagen. `ANDROID_EMULATOR_GPU=host` o `auto` permite probar aceleración en otro equipo. Si ya había un emulador abierto con gráficos defectuosos, ciérralo y ejecuta de nuevo el preview. [Modos gráficos oficiales](https://developer.android.com/studio/run/emulator-acceleration).

### Probar el mapa y la edición enriquecida

- **Mapa curricular:** mantén pulsado el agarre junto a la clave de una asignatura y arrástrala a otro ciclo/bloque. El destino se resalta; acercarte al borde desplaza el mapa. También puedes usar **⋯ → Ciclo de destino / Bloque formativo → Guardar**, o cambiar a **Vista lista**.
- Los movimientos aparecen inmediatamente, muestran su guardado y revierten si falla. Se vuelve a consultar el servidor antes de escribir; una revisión obsoleta se rechaza. Un movimiento que rompería seriaciones exige ajustarlas primero, sin aceptar su eliminación silenciosa.
- **Resumen → lápiz de un campo académico:** selecciona texto para aplicar negrita, cursiva, subrayado o tachado. Usa **Párrafo / H1 / H2 / H3**, viñetas, numeración, sangría, alineación y deshacer/rehacer. Las barras de herramientas se desplazan horizontalmente en pantallas estrechas.
- Guarda, vuelve a abrir y comprueba el mismo campo en la web conectada a Supabase local. La lectura y edición usan HTML semántico compatible con su sanitizador. Los borradores sobreviven a la recreación del editor; salir con cambios pide confirmación. Un fallo al guardar conserva el borrador.
- Los textos extensos de bloques formativos usan el mismo editor. Sus cambios se incorporan al formulario del bloque; hay que guardar también ese formulario.

### Pulido de experiencia académica

- **Nuevo plan:** elige la facultad por su insignia y color; las carreras se agrupan por nivel y respetan el ámbito de tus roles. El inicio de impartición usa un selector de mes/año. Los ciclos propuestos proceden del catálogo de la carrera; las semanas sin configurar se solicitan explícitamente.
- **Inicio y catálogos:** no hay botones de refrescar. Se reconcilian al volver a la pantalla o retomar la app, después de escrituras locales y al reconectar Realtime, conservando el contenido visible. Las páginas ya cargadas del catálogo se mantienen al revalidar.
- **Mapa curricular:** los bloques forman parte del mapa, sin pestaña duplicada. Toca su nombre o chip coloreado para consultar propósito/aporte/alcance y editar. En lista, mantén pulsada una asignatura y elige **Mover asignatura**; los destinos conservan sus colores. TalkBack ofrece la misma acción contextual. El **+** superior crea una asignatura.
- **Revisión:** la acción principal nombra el destino académico autorizado. Puedes añadir un comentario antes de confirmar. El botón circular de escritura abre una observación; **Pendientes / Resueltos / Todos** conserva la conversación y permite resolver/reabrir según permisos.
- **Historial:** abre el icono de historial de la barra superior. Busca por autor, campo o contenido y despliega un evento para comparar antes/después. No se elimina ni descarta auditoría: el contrato actual del servidor sólo admite resolver observaciones.
- **Bibliografía:** **+** ofrece captura manual, búsqueda en Biblioteca La Salle o búsqueda en línea a través de las mismas Edge Functions de la web. Se conservan autores, año, editorial, ISBN e identificadores de procedencia. La cita completa se captura/revisa manualmente: seleccionar APA/IEEE/Vancouver/Chicago no genera ni reformatea automáticamente una cita. La generación CSL del asistente web sigue pendiente.

Las suscripciones remotas sólo notifican tablas publicadas en Supabase. En el backend local algunas tablas secundarias no lo están; se revalidan tras escrituras locales, al volver y al abrir revisión/historial. Esto no promete colaboración remota instantánea para esas tablas y no modifica publicaciones del servidor. Se usan los [efectos de ciclo de vida de Android](https://developer.android.com/topic/libraries/architecture/lifecycle) y [canales de Supabase Kotlin](https://supabase.com/docs/reference/kotlin/subscribe), sin sondeo periódico ni nuevas dependencias de interfaz.

APK local: `app/build/outputs/apk/debug/app-debug.apk`. Identificador: `mx.sgi.acadia.preview`. Puede coexistir con una futura versión de producción.

## Alcance del preview

| Área               | Disponible en Android                                                                                                                                                                       | Pendiente para paridad                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identidad y diseño | Indivisa Sans/Serif del proyecto, colores derivados de `src/styles.css`, tema persistente, edge-to-edge, navegación inferior/rail, formularios desplazables, tooltips y semántica accesible | Auditoría completa con TalkBack y dispositivos físicos                                                                                              |
| Sesión             | Acceso externo GoTrue solo en debug local, restauración de sesión, cierre local, solicitud de recuperación                                                                                  | Verificación end-to-end del gateway institucional, session gate de release y recuperación completa                                                  |
| Planes             | Catálogo paginado/búsqueda, expediente, alta manual, fundamentos escalares, ciclos, mapa, bloques, comentarios, historial y consulta de registros oficiales                                 | Versionado curricular, recomendación automática de estructuras, restauración histórica, aprobación con documentos y administración avanzada         |
| Asignaturas        | Consulta/alta/edición, horas/créditos, contenido temático, criterios de evaluación, bibliografía, observaciones e historial                                                                 | Reordenamiento avanzado, prerrequisitos, responsables, recursos didácticos y editor enriquecido completo                                            |
| Revisión           | Permisos consultados al servidor; transiciones mediante las Edge Functions existentes; resolución de comentarios                                                                            | Validación end-to-end de todas las combinaciones de roles y estados                                                                                 |
| IA                 | Historial, creación de conversaciones, envío con confirmación y refresco Realtime del historial persistido                                                                                  | Validación de generaciones reales, referencias adjuntas, herramientas, propuestas/aplicación de cambios y generación integral de planes/asignaturas |
| Institución        | Consulta de facultades, carreras, estructuras, registros y notificaciones                                                                                                                   | Administración de usuarios/roles, catálogos editables, importación, archivos, biblioteca, evaluaciones y analítica avanzada                         |
| Documentos         | Compartir un resumen mediante el selector nativo de Android                                                                                                                                 | Exportación oficial PDF/Excel/Word y documentos firmados                                                                                            |

Las funcionalidades de IA necesitan las credenciales del proveedor **en el servidor**, nunca en el APK. No se simulan respuestas ni se aplican propuestas automáticamente. El envío se confirma porque puede transmitir contexto académico y generar consumo. El health endpoint local respondió durante la preparación; eso no valida cada función ni las credenciales externas.

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
bun run android:test:ui
```

- **38 tests JVM aprobados:** validación de horas/evaluación, búsqueda, permisos, restricciones del host local, normalización/sanitización HTML, seriaciones y movimiento inmutable del mapa; ámbito de facultad/carrera, mes/año, colores de bloques, transiciones contextuales, fechas del historial y metadatos/enlaces de bibliografía.
- Contratos API: login, catálogos, joins, permisos, historial, alta/edición de una asignatura, bibliografía y comentarios. Crea y elimina únicamente sus fixtures UUID.
- **15 tests UI aprobados:** acceso, navegación, alta con facultad/carreras agrupadas y mes/año, actualización automática tras crear un plan, mapa integrado con bloques, contenido, evaluación/bibliografía, edición real de horas, criterios y texto enriquecido, persistencia de un movimiento, rechazo de escritura obsoleta, tema y recreación de actividad. Las pruebas aisladas cubren arrastre nativo, movimiento contextual, reversión optimista, selección/formato, restauración del borrador, listas y descarte con texto grande; revisión contextual con comentario, observaciones pendientes/resueltas, comparación del historial y edición/métodos de bibliografía. El runner limpia los dos fixtures UUID temporales —asignatura y plan— incluso si falla la prueba. No envía consultas a proveedores de IA.
- **Búsquedas HTTP desde Supabase local:** `buscar-bibliografia` respondió **200 con 40 resultados** y `biblioteca` respondió **200 con 10 resultados**. Se consultaron los servicios bibliográficos, sin IA. Esto verifica el contrato HTTP local, **no una búsqueda completa end-to-end desde la interfaz Android**; la cita continúa siendo de captura/revisión manual, sin generación CSL nativa.
- Android Lint y compilación en CI sin credenciales del backend. La prueba end-to-end se ejecuta localmente; no se debe interpretar el build de CI como validación de Supabase.

Para probar manualmente sin tocar contenido previo, crea un plan/asignatura de prueba. Si Docker se detiene, la interfaz conserva los datos y muestra el error; vuelve a iniciar los servicios y regresa a la pantalla o usa **Reintentar** en el error. Este preview está listo para recoger feedback de uso, no para sustituir todas las operaciones de la versión web.

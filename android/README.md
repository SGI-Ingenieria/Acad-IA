# Acad-IA · Android nativo

Preview **Kotlin + Jetpack Compose**, sin React Native ni WebView. Es una primera plataforma Android ejecutable, **no una versión con paridad completa ni una entrega de producción**. La aplicación web y el esquema de Supabase no se modifican.

## Abrir y probar en esta computadora

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

Los campos enriquecidos se muestran como texto. Si se editan desde este preview se informa que se conservará el contenido, no el formato original. Los objetos y listas del esquema se muestran en consulta. Los catálogos académicos principales tienen paginación; algunas consultas secundarias muestran hasta 300 filas.

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

- Unit tests: validación de horas/evaluación, búsqueda, permisos y restricciones del host local.
- Contratos API: login, catálogos, joins, permisos, historial, alta/edición de una asignatura, bibliografía y comentarios. Crea y elimina únicamente sus fixtures UUID.
- Compose instrumentado: acceso, navegación, mapa, contenido, evaluación/bibliografía, edición real de horas y criterios, rechazo de escritura obsoleta, tema y recreación de actividad. El runner provisiona una asignatura temporal y la elimina incluso si falla la prueba. No envía consultas a proveedores de IA.
- Android Lint y compilación en CI sin credenciales del backend. La prueba end-to-end se ejecuta localmente; no se debe interpretar el build de CI como validación de Supabase.

Para probar manualmente sin tocar contenido previo, crea un plan/asignatura de prueba. Si Docker se detiene, la interfaz muestra el error y permite reintentar; vuelve a iniciar los servicios y usa **Actualizar**. Este preview está listo para recoger feedback de uso, no para sustituir todas las operaciones de la versión web.

# Área curricular común básica

El rol `AREA_COMUN` tiene un alcance institucional propio (`area_comun`), sin
conceder edición sobre carreras. Su inicio abre el catálogo institucional. Los
usuarios con este rol se asignan mediante la administración habitual; la carga
inicial no asigna usuarios y deja el catálogo sin publicar.

## Publicación e incorporación

Las asignaturas originales pertenecen al plan institucional, sin una carrera
ficticia. Se editan con el editor, temario y bibliografía habituales. Las
distribuciones son la autoridad para los ciclos de los planes receptores:
permiten variantes por duración y tipo de ciclo, y variantes específicas por
carrera que prevalecen sobre la distribución general. Cada espacio tiene una
clave estable y contiene una materia fija o varias opciones de electiva.

Publicar conserva una instantánea del catálogo y bibliografía. Cada receptor
mantiene una incorporación y registros de asignatura que proyectan la publicación
vigente. Esos registros tienen origen e incorporación explícitos, conservan su
identidad al sustituir una materia del mismo espacio y no admiten escrituras
ordinarias, ni siquiera administrativas o desde funciones con clave de servicio.
La sincronización autorizada se delimita mediante un marcador privado de
transacción; nunca mediante un ajuste que pueda falsificar el cliente.

Se eligieron proyecciones físicas porque el mapa, la tabla, los totales, los
documentos SEP, las exportaciones y el contexto de IA ya leen `asignaturas`.
Mantener esa lectura evita un segundo modelo de materias y preserva las relaciones
con asignaturas propias. Publicar actualiza las incorporaciones en una sola
transacción: electivas inválidas, distribuciones incompatibles y prerrequisitos
sin resolver abortan todos los cambios. Los borradores no llegan al receptor.

Retirar una línea elimina únicamente su incorporación y proyecciones. Las
relaciones externas deben resolverse antes. Las materias originales con
publicaciones se conservan para trazabilidad. Los antecedentes permanecen
inmutables: un plan vinculado debe retirar el vínculo antes de convertirse en
antecedente. La clonación de planes reconstruye la incorporación y conserva las
elecciones; el clonado individual de una proyección está bloqueado.

## Contratos y recuperación

- `area_comun_contexto`: publicación, distribución compatible y elección actual;
  sólo los gestores reciben el borrador y la identificación de planes usuarios.
- `area_comun_guardar_configuracion` y `area_comun_publicar`: revisión esperada
  para evitar sobrescribir una configuración que cambió en otra sesión.
- `area_comun_incorporar`: selección de electivas y publicación previsualizada;
  rechaza una previsualización obsoleta y es idempotente por plan.
- `area_comun_retirar`: retiro íntegro con comprobación de dependencias.

Los formularios conservan la revisión/publicación con la que se abrieron. Los
hooks muestran estado pendiente y reconcilian las familias de claves `qk`.
Realtime informa publicaciones y cambios de incorporación, y la reconexión
refresca las lecturas. El agente comprueba la procedencia en la base y no acepta
movimientos ni seriaciones que modifiquen materias comunes.

## Referencia inicial y verificación

La referencia de 2013 proporciona once materias fijas y nueve opciones para dos
espacios electivos. Al incorporar la distribución inicial se obtienen trece
materias y 576 horas académicas. El catálogo de veinte entradas también incluye
las opciones no seleccionadas; sus totales no representan la carga de un alumno.
Los créditos usan la fórmula existente. El contenido y las horas independientes
quedan pendientes; las notas sobre Filosofía y salud requieren configuración
explícita, sin inferir carreras por nombre.

Se consultaron las capacidades oficiales de
[TanStack Query](https://tanstack.com/query/v5/docs/framework/react/guides/invalidations-from-mutations),
[TanStack Router](https://tanstack.com/router/latest/docs/framework/react/guide/navigation)
mediante el CLI y la
[seguridad de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security),
además de los hooks, permisos y clonador existentes del proyecto.

Verificación realizada: 57 comprobaciones pgTAP específicas, 172 pruebas de
frontend, 186 pruebas de funciones, TypeScript, compilación, lint y espaciado.
Se comprobaron en Edge el mapa, distribuciones e inicio con un usuario local
temporal del nuevo rol, sin publicar ni guardar contenido. Las migraciones se
aplicaron localmente y en el proyecto alojado; se desplegó `ai-agente-accion`.

La suite SQL global ejecuta 620 comprobaciones y conserva 22 fallos de expectativas
de permisos en biblioteca, documentos, intentos/publicación de IA y crash reports.
La suite de Área común y los contratos de autorización existentes pasan. No se
modificaron los privilegios de esos otros subsistemas para resolver sus fallos.
La comprobación visual no sustituye una prueba completa de exportación documental
ni una prueba de carga con múltiples sesiones.

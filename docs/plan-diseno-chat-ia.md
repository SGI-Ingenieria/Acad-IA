## 1. Propósito del Chat

El chat no es un conversador genérico. Es una **herramienta de edición asistida** para:

- **Planes de estudio** (nivel plan/curriculum).
- **Asignaturas** (nivel materia).

La IA propone mejoras textualmente y, cuando es posible, ofrece acciones concretas para aplicar esas mejoras directamente sobre los campos del plan o de la asignatura. El usuario puede aceptar, rechazar o ignorar cada propuesta.

---

## 2. Identidad Visual Base

### 2.1 Paleta y Superficies

- **Color institucional:** Azul La Salle (OKLCH, profundidad moderada, ni pastel ni neón).
- **Contraste cálido intencional:** Peach/naranja suave como acento contra las superficies frías. No decorativo; funcional (destaca estados activos y acciones principales).
- **Fondo:** Migración en curso a **Aurora Mesh Gradient** en todo el fondo de pantalla. Tres blobs radiales (azul primario, cian/teal, peach) que respiran lentamente con opacidad muy contenida (no compite con texto).
- **Superficies:** El sistema usa "Organic Surfaces" — capas con múltiples brillos radiales sutiles y bordes degradados animados que dan la sensación de que los componentes están vivos pero sin ser estridentes.

### 2.2 Tipografía

- **Familia principal:** Indivisa Sans (geometría institucional).
- **Énfasis:** Bold a 900 con tracking ajustado (-0.025em) para titulares y nombres de campo.
- **Tamaños:** La jerarquía es contenida. El chat no grita; guía.

### 2.3 Filosofía de Interacción

- **Micro-interacciones orgánicas:** Todo elemento interactivo tiene una duración corta (~180 ms) y un desplazamiento vertical sutil en hover (lift de -1 px), como si flotara levemente.
- **Respiración:** Los estados de espera y carga no deben ser estáticos. Deben "respirar" (opacity, scale, blur) para indicar que algo está ocurriendo sin fatigar.

---

## 3. Estructura General del Workspace de Chat

La interfaz se divide en tres zonas principales (desktop); en móvil se colapsan en drawers.

| Zona                        | Función                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Barra lateral izquierda** | Historial de conversaciones (Activas / Archivadas). Renombrable in-place. Indicador de estado por chat. |
| **Área de mensajes**        | Hilo de conversación. Mensajes del usuario (derecha) vs. mensajes de la IA (izquierda).                 |
| **Composer inferior**       | Input de texto, selector de campos, gestor de referencias y controles de envío.                         |

---

## 4. Área de Mensajes

### 4.1 Mensajes del Usuario

- **Apariencia:** Burbuja con esquinas muy redondeadas excepto la esquina interna (trailing edge), que es recta. Esto crea una "cola" visual sutil.
- **Superficie:** Degradado lineal muy suave de superficie muted hacia transparente, con un borde sutil y un ringInterno blanco translúcido (efecto de vidrio esmerilado microscópico).
- **Entrada:** Animación coordinada (GSAP): deslizamiento desde abajo, fade-in, y blur que se disipa en escalada (stagger suave si hay varios mensajes seguidos).

### 4.2 Mensajes del Asistente (IA)

- **Apariencia:** Sin burbuja. Texto plano alineado a la izquierda con una línea de acento vertical sutil a la izquierda del contenido. Esto diferencia claramente la voz de la IA de la del usuario.
- **Estados especiales del mensaje:**
  - **Error:** Caja de alerta con borde rojo suave, icono triangular y tipografía clara.
  - **Refusal/Rechazo de seguridad:** Mismo estilo de alerta pero con tono de aviso, no de error del sistema.
  - **Cancelado por usuario:** Pill gris con icono de cancelación. Menos prominente que un error; es una interrupción opcional, no un fallo.

### 4.3 Estado "La IA está escribiendo / analizando"

- **Skeleton pulsante:** No es un spinner genérico. Es un bloque de contenido fantasma con tres líneas de placeholder que pulsan con opacidad variable.
- **Avatar:** Redondo, color primario, con un icono de "chispas" que también tiene una animación de pulso sutil.
- **Label de estado:** Texto en cursiva muy pequeño debajo del skeleton: _"La IA está analizando tu solicitud…"_ (el texto exacto es configurable por contexto).

---

## 5. Composer (Zona de Escritura)

El composer es la pieza central de la experiencia. Debe sentirse como una superficie viva, no como un `<textarea>` plano.

### 5.1 Contenedor del Composer

- **Forma:** Rectángulo con bordes extremadamente redondeados (aspecto de píldora/orgánico, no cuadrado).
- **Superficie:** "Organic Surface" + "Gradient Border" (borde animado con degradado de primario → teal → acento → cyan) + "Organic Glow" (sombra difuminada en tono primario) + "Breathing Aura" (brillo radial difuso detrás del contenedor que cambia de opacidad y escala sutilmente con GSAP según el estado de la conversación).
- **Estado activo:** Cuando la búsqueda web está activada, el contenedor recibe un anillo de 2 px en color primario para hacer visible que el contexto ha cambiado.

### 5.2 Chips de Contexto (arriba del input)

Son las etiquetas que aparecen antes de que el usuario escriba, indicando qué está pidiendo modificar.

- **Campos seleccionados:** Chips pill con prefijo "Campo:" y el nombre del campo. Ejemplo: `Campo: Objetivos de aprendizaje`. Color primario, ícono de cierre (X) pequeño circular.
- **Referencias adjuntas:** Chips pill con ícono de clip (`Paperclip`) y nombre del archivo o del repositorio vectorial. Debe diferenciarse visualmente del chip de campo (quizás con fondo neutro en lugar de primario, o con un tono secundario).
- **Comportamiento:** Si el usuario escribe `/`, los chips pueden completarse automáticamente; si borra todo el texto y sigue presionando retroceso, el último chip desaparece (comportamiento de "backspace para quitar").

### 5.3 Selector de Campos Embebido (Autocompletar con "/")

- **Disparador:** El usuario escribe `/` y aparece un panel flotante justo encima del composer.
- **Apariencia del panel:** Superficie popover con borde degradado animado, esquinas redondeadas generosas, y sombra profunda.
- **Contenido:** Lista de campos disponibles para editar/mejorar. El primer resultado va pre-resaltado. Cada fila muestra el nombre del campo y la accesibilidad visual del hover.
- **Tipografía del campo seleccionado:** Al insertarse, el campo no se convierte en texto plano; se convierte en un chip semántico (visualmente distincto) dentro del input.

### 5.4 Barra de Herramientas del Composer (izquierda/derecha del input)

Debe sentirse como una barra de control flotante, integrada, no como un toolbar tradicional.

| Control                                             | Descripción visual e interacción                                                                                                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Selector de razonamiento**                        | Pill redondo compacto con icono de cerebro. Al abrirse, muestra opciones de esfuerzo cognitivo (Auto / Ninguno / Bajo / Medio / Alto). Debe tener estados de activación claros sin ser intrusivos.   |
| **Adjuntos / Referencias**                          | Botón circular con icono de clip. Cuando hay archivos o repositorios seleccionados, cambia de estado visual (fondo primario sutil, borde primario). Hover: lift.                                     |
| **Búsqueda Web**                                    | Pill con icono de globo y label "Web". En reposo: neutro. Activo: fondo primario sólido, texto blanco, borde primario. La transición entre estados debe ser fluida (GSAP o CSS transition orgánica). |
| **Botón principal (Enviar / Cancelar / Generando)** | Ver sección 6.                                                                                                                                                                                       |

### 5.5 Teclas de Acceso Rápido (debajo del composer)

Píldoras informativas muy pequeñas: `Enter para enviar`, `Shift + Enter para salto de línea`, `Web activada/apagada`. Son hints, no botones; deben desvanecerse suavemente cuando el usuario está concentrado en escribir.

---

## 6. El Botón Principal: Enviar, Generando y Cancelar

Este es un punto crítico de la interacción. Actualmente está sub-diseñado. Se requiere una máquina de estados visual clara.

### 6.1 Estado 1: Enviar (disponible)

- **Apariencia:** Botón circular sólido, color primario, icono de avión de papel (`Send`).
- **Feedback hover:** Escala leve hacia arriba (1.05) y sombra se intensifica. Lift de -0.5 px.
- **Feedback active/click:** Contrae a 0.95 rápidamente para dar sensación de tacto.

### 6.2 Estado 2: Generando / Analizando (ocupado)

- **Apariencia:** El mismo botón circular ahora muestra un icono de carga (`Loader2`) en animación de giro continuo.
- **Color:** Debe permanecer en la familia del primario, pero con una variante de "ocupado". No rojo, no grisáceo; debe seguir siendo el botón principal, ahora en modo espera.
- **Entorno:** Todo el composer debe sentirse "inhalado" — la aura detrás del contenedor puede aumentar levemente su opacidad/pulso para indicar que el sistema está consumiendo energía/ciclos.
- **Skeleton del mensaje:** Aparece simultáneamente en el área de mensajes (ver 4.3).

### 6.3 Estado 3: Cancelar (hover sobre Generando)

- **Comportamiento:** Cuando el botón está en estado "Generando" y el usuario hace **hover** (o toque largo en móvil), el botón debe transformarse visualmente para revelar la acción de **Cancelar**.
- **Transición:** El icono de carga realiza un crossfade rápido (200-300 ms) hacia un icono de X o un icono de "stop/hand". Opcionalmente, el fondo del botón puede hacer un crossfade a un tono más cálido (acento peach) o a un rojo suave para indicar interrupción.
- **Tooltip:** Si el usuario deja el cursor quieto sobre el botón en estado de generación, debe aparecer un tooltip claro: _"Generando respuesta. Haz clic para cancelar."_
- **Al hacer clic:** La generación se interrumpe. El skeleton en el área de mensajes se convierte en el mensaje "Cancelado" (ver 4.2). El botón regresa al estado Enviar con una transición de "exhale" suave.

### 6.4 Indicador de Cancelabilidad (mejora UX adicional)

- Opcional pero recomendado: junto al label de estado _"La IA está analizando…"_ del skeleton, añadir un hint textual o un iconito que sugiera que se puede cancelar. Ejemplo: _"Analizando… (puedes cancelar)"_ con una línea punteada o un icono de "esc".
- Esto es importante porque, si solo el hover transforma el botón, los usuarios móviles o usuarios con miedo a tocar no sabrán que la cancelación existe.

---

## 7. Tarjetas de Sugerencia y Mejora (Improvement Cards)

Cuando la IA responde con propuestas concretas de cambio, no debe ser solo texto. Debe presentarse como una **tarjeta de acción**.

### 7.1 Estructura de cada Tarjeta

- **Header:**
  - Nombre del campo afectado (ej. "Contenido Temático", "Objetivos de Aprendizaje").
  - Etiqueta de estado: un pequeño pill que diga el estado del campo (si aplica).
- **Cuerpo:**
  - El texto propuesto por la IA. Debe tener una presentación que respete el tipo de dato:
    - _Texto libre:_ Bloque de párrafo bien espaciado, líneas no super largas (max-width legible).
    - _Contenido temático estructurado (unidades/temas):_ Sub-tarjetas internas con encabezado "Unidad X: Título", lista de temas, y badge de horas estimadas.
    - _Criterios de evaluación:_ Filas con nombre del criterio y badge de porcentaje alineado a la derecha, más una fila sumatoria.
- **Footer / Acción:**
  - Botón principal: **"Aplicar mejora"**.
  - Al aplicarse: el botón cambia a **"Aplicado"** con icono de check, el fondo de la tarjeta se vuelve más tenue (opacidad reducida), y aparece un acento visual sutil a la izquierda (línea primaria) indicando que ya fue integrado al documento.

### 7.2 Estados de la Tarjeta

| Estado        | Apariencia                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Pendiente** | Fondo neutro, borde sutil. Botón visible y activo. Hover de la tarjeta: lift suave (-1 px).                                   |
| **Aplicando** | Botón muestra spinner y texto "Aplicando…". Tarjeta entra en modo semi-bloqueado.                                             |
| **Aplicado**  | Opacidad general baja (~80%). Borde primario sutil. Botón desactivado con check. Texto interior con fondo primario muy tenue. |

### 7.3 Agrupación

Si una respuesta de la IA contiene múltiples sugerencias, las tarjetas deben apilarse verticalmente con separación consistente. GSAP puede hacer un stagger de entrada para que no aparezcan todas de golpe (más natural, menos abrumador).

---

## 8. Gestor de Referencias (Drawers)

Cuando se activa la gestión de archivos/repositorios, aparece un drawer desde abajo (mobile) o un panel flotante (desktop).

- **Título:** "Referencias para la IA".
- **Contenido:** Lista de archivos existentes (checkbox para seleccionar), repositorios vectoriales disponibles, y zona de arrastrar y soltar (dropzone) para subir nuevos archivos.
- **Estado de archivo seleccionado:** Debe tener un check visual claro y el chip correspondiente debe aparecer inmediatamente en el composer al cerrar el drawer.
- **Animación de entrada:** Slide-up suave con backdrop blur creciente.

---

## 9. Nombres de Chat y Contexto

### 9.1 Título Editable

- En la parte superior del área de chat hay un título editable (contentEditable). Debe tener un borde inferior transparente que se vuelva visible en hover/focus para indicar que es editable.
- Al guardar, debe haber un feedback sutil (el texto parpadea en éxito o el borde hace un flash primario) sin interrumpir la conversación.

### 9.2 Generación Automática de Título

- Cuando el usuario envía su primer mensaje, el sistema genera automáticamente un nombre breve (máx. 5-6 palabras) que sintetiza el tema. No debe copiar textual la pregunta.
- **Interacción:** El título aparece en la lista lateral. Si el sistema no puede inferir, cae en nombres heurísticos temáticos: "Perfil académico", "Evaluación académica", "Bibliografía", "Mapa curricular", etc.
- **Diseño:** La lista lateral debe mostrar el título con un fade-out gradiente si es muy largo, y un tooltip al hover con el texto completo.

---

## 10. Animaciones y Motion Design (GSAP)

> **Nota para el estudio de diseño:** El sistema usa GSAP para todas las animaciones significativas. Las animaciones puramente de UI (hover, active) son CSS transitions de ~180 ms. GSAP se reserva para entradas, salidas y comportamientos atmosféricos.

### 10.1 Entrada de Mensajes (Stagger)

- Cada mensaje nuevo entra con:
  - `y: 12 px` → `0`
  - `opacity: 0` → `1`
  - `filter: blur(8 px)` → `blur(0)`
- Si varios mensajes aparecen juntos (ej. un mensaje de usuario y el skeleton de respuesta de la IA), deben stagger con un offset de ~80 ms para crear ritmo.

### 10.2 Entrada del Composer

- Al montarse la vista de chat, el composer entra desde abajo:
  - `y: 20 px` → `0`
  - `opacity: 0` → `1`
  - Easing orgánico (no lineal; aceleración suave, desaceleración pronunciada).

### 10.3 Respiración de la Aura

- El elemento `.breathing-aura` detrás del composer varía su `opacity` y `scale` en bucle cuando hay actividad (web search activada, archivos adjuntos, o generación en proceso).
- Parámetros sugeridos: duración 3-4 s, ease `sine.inOut`, escala 0.98 ↔ 1.02, opacidad 0.5 ↔ 0.7.

### 10.4 Transición del Botón Principal (Enviar ↔ Cancelar)

- El icono dentro del botón debe hacer un **crossfade** o una **rotación escalonada**.
- El borde degradado del composer puede acelerar levemente su animación durante "Generando" para dar sensación de latido.

### 10.5 Estrategia de Reduced Motion

- Todo movimiento debe respetar `prefers-reduced-motion`. En ese modo:
  - Las auras se detienen y se quedan en un estado estático de baja opacidad.
  - Los blobs de Aurora Mesh desaparecen o se congelan.
  - Las transiciones de entrada se convierten en simples fade-in sin desplazamiento ni blur.

---

## 11. Responsive y Móvil

- **Lista de chats:** En móvil no es sidebar fija. Se accede mediante un drawer que sube desde abajo.
- **Composer:** Mantiene la forma redondeada y los controles, pero los chips de contexto se apilan verticalmente si no hay ancho suficiente.
- **Botón principal:** En móvil, el "hover para cancelar" no existe. Debe implementarse como:
  - Toque simple sobre el botón en estado "Generando" → muestra un pequeño sheet o tooltip de confirmación: "¿Cancelar generación?" con botón confirmar.
  - O, alternativamente, un toque largo transforma directamente a cancelar.

---

## 12. Accesibilidad (A11y)

- Los estados de la IA no deben depender solo de color.
- El skeleton de "Generando" debe tener `aria-busy="true"` en el contenedor del mensaje.
- Las tarjetas de mejora deben tener `aria-label` que describa la acción: "Sugerencia para [Campo]: [Texto breve]".
- El selector de campos con `/` debe ser navegable con teclado (flechas arriba/abajo, Tab/Enter para seleccionar, Escape para cerrar).
- El botón de cancelar, en hover o en confirmación, debe ser anunciado por lectores de pantalla.

---

## 13. Checklist para Entregables del Estudio de Diseño

| #   | Entregable                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Frames de los 3 estados del botón principal (Enviar / Generando / Cancelar-hover) con especificaciones de transición.                               |
| 2   | Variantes del composer: vacío, con chips de campo, con chips de referencia, con búsqueda web activa, con generación en curso (aura intensificada).  |
| 3   | Componente de tarjeta de sugerencia en 3 estados (Pendiente / Aplicando / Aplicado) para texto libre, contenido temático y criterios de evaluación. |
| 4   | Panel flotante del selector de campos (autocompletar "/") con lista de resultados y estado de selección.                                            |
| 5   | Drawer de gestión de referencias (desktop y mobile).                                                                                                |
| 6   | Especificación del Aurora Mesh Gradient aplicado al fondo del chat.                                                                                 |
| 7   | Especificación de tokens de motion: duraciones, easing, stagger para GSAP.                                                                          |
| 8   | Estados vacíos y de error del área de mensajes.                                                                                                     |
| 9   | Especificaciones responsive: composer en móvil, drawer de historial, touch-targets mínimos.                                                         |

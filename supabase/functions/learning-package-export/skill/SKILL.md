# acad-ia-powerpoint-skill

Skill interno de Acad-IA para generar presentaciones PPTX institucionales a
partir de `learning_objects` de tipo `outline_presentacion`. No depende de la
plataforma de Skills de OpenAI: es un bundle versionado (tema + reglas +
builder) que ejecuta el worker de exportación (`learning-package-export`).

## Contenido

| Archivo          | Propósito                                                   |
| ---------------- | ----------------------------------------------------------- |
| `SKILL.md`       | Este documento: convenciones y contrato del deck.           |
| `theme.ts`       | Tokens del tema institucional (colores, fuentes, layout).   |
| `slide_rules.md` | Reglas editoriales de las diapositivas.                     |
| `../pptx.ts`     | Builder (`buildDeckPptx`) que aplica el tema con pptxgenjs. |

## Contrato del deck

1. **Portada**: título de la presentación, asignatura, unidad/tema y la línea
   institucional (`theme.institucion`).
2. **Agenda**: una diapositiva con los títulos de las secciones si el outline
   tiene más de 4 diapositivas.
3. **Desarrollo**: una diapositiva por entrada de `diapositivas[]` del outline
   (título + bullets `puntos[]`); las `notas_docente` van como notas del
   orador, nunca en el cuerpo.
4. **Fuentes**: diapositiva final con las `source_refs` del recurso
   (autor, título, licencia). Solo se listan fuentes con licencia declarada o
   de tipo `bibliografia`; nada se inventa.
5. **Cierre**: diapositiva con el mensaje de cierre institucional.

## Reglas duras

- 8–14 diapositivas de desarrollo por tema; el builder trunca bullets a
  `theme.layout.maxBulletsPorSlide` y reparte el resto en diapositivas
  "(cont.)".
- Tipografías y colores salen exclusivamente de `theme.ts`; el builder no
  acepta overrides por request.
- Sin imágenes externas en esta versión: solo se permiten assets con licencia
  verificada, y la verificación de licencias de imágenes aún no existe en el
  pipeline.
- El texto proviene de `contenido_json` ya revisado (estado `reviewed` o
  `published`); el builder no llama a ningún modelo.

## Versionado

Cambios de tema o de reglas se hacen aquí y en `theme.ts`, y se reflejan en
`manifest_json.skill_version` de cada `learning_package` generado.

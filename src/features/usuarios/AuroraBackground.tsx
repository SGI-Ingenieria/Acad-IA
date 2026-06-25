/**
 * Capa de fondo "aurora mesh": tres blobs radiales difusos que respiran en
 * bucle bajo la interfaz. Se monta como capa fija detrás del contenido
 * (`-z-10`). Todo el movimiento vive en CSS (ver `.aurora-blob` en styles.css)
 * y respeta `prefers-reduced-motion`.
 */
export function AuroraBackground() {
  return (
    <div aria-hidden className="aurora-mesh -z-10">
      <span className="aurora-blob aurora-blob--primary" />
      <span className="aurora-blob aurora-blob--cool" />
      <span className="aurora-blob aurora-blob--warm" />
    </div>
  )
}

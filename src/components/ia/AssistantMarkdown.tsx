import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import '@/components/editor/richtext-editor.css'

import { cn } from '@/lib/utils'

/**
 * Renderiza el contenido conversacional de la IA (no estructurado) que llega en
 * Markdown. Reutiliza la hoja `.richtext-content` para que tipografía, listas,
 * citas y enlaces compartan los mismos tokens que el resto del producto.
 *
 * `react-markdown` no interpreta HTML embebido por defecto, así que el texto es
 * seguro frente a inyección sin necesitar un saneador adicional.
 */
export function AssistantMarkdown({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  return (
    <div className={cn('richtext-content', className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, children, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}

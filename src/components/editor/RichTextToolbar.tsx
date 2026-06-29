import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import type { Editor } from '@tiptap/react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

function normalizeHref(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function ToolbarButton({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  label: string
  icon: LucideIcon
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          className={cn(active && 'bg-primary/10 text-primary')}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function ToolbarGroup({ children }: { children: ReactNode }) {
  return (
    <div className="border-border flex items-center gap-0.5 border-r pr-1 last:border-r-0 last:pr-0">
      {children}
    </div>
  )
}

function LinkPopover({ editor }: { editor: Editor }) {
  const [href, setHref] = useState('')

  useEffect(() => {
    setHref(editor.getAttributes('link').href ?? '')
  }, [editor])

  const applyLink = () => {
    const normalized = normalizeHref(href)
    if (!normalized) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({
        href: normalized,
        target: '_blank',
        rel: 'noopener noreferrer',
      })
      .run()
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Enlace"
              aria-pressed={editor.isActive('link')}
              className={cn(
                editor.isActive('link') && 'bg-primary/10 text-primary',
              )}
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Enlace</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-80 space-y-3">
        <Input
          value={href}
          onChange={(event) => setHref(event.target.value)}
          placeholder="https://..."
          onKeyDown={(event) => {
            if (event.key === 'Enter') applyLink()
          }}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              editor.chain().focus().extendMarkRange('link').unsetLink().run()
              setHref('')
            }}
          >
            Quitar
          </Button>
          <Button type="button" size="sm" onClick={applyLink}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function RichTextToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) {
    return <div className="richtext-editor__toolbar h-11" />
  }

  return (
    <div className="richtext-editor__toolbar flex flex-wrap items-center gap-1 p-2">
      <ToolbarGroup>
        <ToolbarButton
          label="Parrafo"
          icon={Pilcrow}
          active={editor.isActive('paragraph')}
          onClick={() => editor.chain().focus().setParagraph().run()}
        />
        <ToolbarButton
          label="Encabezado 1"
          icon={Heading1}
          active={editor.isActive('heading', { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        />
        <ToolbarButton
          label="Encabezado 2"
          icon={Heading2}
          active={editor.isActive('heading', { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <ToolbarButton
          label="Encabezado 3"
          icon={Heading3}
          active={editor.isActive('heading', { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />
      </ToolbarGroup>

      <ToolbarGroup>
        <ToolbarButton
          label="Negrita"
          icon={Bold}
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="Italica"
          icon={Italic}
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="Subrayado"
          icon={UnderlineIcon}
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          label="Tachado"
          icon={Strikethrough}
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <ToolbarButton
          label="Codigo"
          icon={Code}
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />
      </ToolbarGroup>

      <ToolbarGroup>
        <ToolbarButton
          label="Lista"
          icon={List}
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="Lista numerada"
          icon={ListOrdered}
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
      </ToolbarGroup>

      <ToolbarGroup>
        <ToolbarButton
          label="Alinear izquierda"
          icon={AlignLeft}
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        />
        <ToolbarButton
          label="Centrar"
          icon={AlignCenter}
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        />
        <ToolbarButton
          label="Alinear derecha"
          icon={AlignRight}
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        />
      </ToolbarGroup>

      <ToolbarGroup>
        <LinkPopover editor={editor} />
        <ToolbarButton
          label="Deshacer"
          icon={Undo2}
          disabled={!editor.can().chain().focus().undo().run()}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolbarButton
          label="Rehacer"
          icon={Redo2}
          disabled={!editor.can().chain().focus().redo().run()}
          onClick={() => editor.chain().focus().redo().run()}
        />
        <ToolbarButton
          label="Limpiar formato"
          icon={Eraser}
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
        />
      </ToolbarGroup>
    </div>
  )
}

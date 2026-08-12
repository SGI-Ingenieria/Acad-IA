import CharacterCount from '@tiptap/extension-character-count'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import './richtext-editor.css'

import { getRichTextStats } from './RichTextStats'
import { RichTextToolbar } from './RichTextToolbar'

import type { Editor } from '@tiptap/react'

export const richTextExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  Underline,
  Link.configure({
    autolink: true,
    defaultProtocol: 'https',
    openOnClick: false,
    HTMLAttributes: {
      rel: 'noopener noreferrer',
      target: '_blank',
    },
  }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  CharacterCount,
]

export function RichTextEditor({ editor }: { editor: Editor | null }) {
  const stats = getRichTextStats(editor)

  return (
    <div className="richtext-editor">
      <RichTextToolbar editor={editor} />
      <div className="richtext-editor__content">
        <EditorContent editor={editor} />
      </div>
      <div className="richtext-editor__footer text-muted-foreground gap-relacionado px-control py-relacionado flex flex-wrap items-center justify-between text-xs">
        <span>{stats.chars} caracteres</span>
        <span>{stats.words} palabras</span>
      </div>
    </div>
  )
}

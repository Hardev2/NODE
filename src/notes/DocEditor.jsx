import { Color } from '@tiptap/extension-color'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextAlign } from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { NoteCodeBlock, applyCodeBlock } from './noteCode'

const COLORS = [
  { name: 'Bone', value: '#f4efe9' },
  { name: 'Ink', value: '#020617' },
  { name: 'Blue', value: '#0369A1' },
  { name: 'Green', value: '#166534' },
  { name: 'Amber', value: '#B45309' },
  { name: 'Rose', value: '#9F1239' },
]

function ToolButton({ active, label, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`cursor-pointer rounded-md px-1.5 py-0.5 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta ${active ? 'bg-[var(--button,#0f172a)] text-[var(--button-ink,#ffffff)]' : 'text-slate-ink hover:bg-paper hover:text-ink'}`}
    >
      {children}
    </button>
  )
}

function ListIcon({ ordered }) {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" fill="currentColor">
      {ordered ? (
        <g fontSize="5" fontFamily="Poppins, sans-serif">
          <text x="0" y="5.2">1</text>
          <text x="0" y="10.2">2</text>
          <text x="0" y="15.2">3</text>
        </g>
      ) : (
        <>
          <circle cx="1.6" cy="3.2" r="1.1" />
          <circle cx="1.6" cy="8" r="1.1" />
          <circle cx="1.6" cy="12.8" r="1.1" />
        </>
      )}
      <rect x="5" y="2.4" width="10" height="1.5" rx="0.4" />
      <rect x="5" y="7.2" width="10" height="1.5" rx="0.4" />
      <rect x="5" y="12" width="8" height="1.5" rx="0.4" />
    </svg>
  )
}

function AlignIcon({ align }) {
  const y = [5, 10, 15]
  const widths = align === 'center' ? [10, 16, 8] : align === 'right' ? [12, 16, 8] : [16, 12, 8]
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="currentColor">
      {y.map((top, index) => {
        const width = widths[index]
        const x = align === 'right' ? 20 - width : align === 'center' ? 12 - width / 2 : 4
        return <rect key={top} x={x} y={top} width={width} height="2" rx="0.5" />
      })}
    </svg>
  )
}

export default function DocEditor({ initialHtml, onChange, label = 'Note', autoFocus = false }) {
  const editor = useEditor({
    immediatelyRender: true,
    autofocus: autoFocus ? 'end' : false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }),
      NoteCodeBlock,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Write the note…' }),
    ],
    content: initialHtml || '<p></p>',
    editorProps: {
      attributes: {
        class: 'note-doc',
        'aria-label': label,
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  })

  if (!editor) return null

  const currentColor = editor.getAttributes('textStyle').color

  return (
    <div className="group bg-transparent">
      <div className="note-tools flex-wrap items-center gap-0.5 border-b border-line px-3 py-1.5" role="toolbar" aria-label="Note formatting">
        {[1, 2, 3].map((level) => (
          <ToolButton
            key={level}
            label={`Heading ${level}`}
            active={editor.isActive('heading', { level })}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          >
            H{level}
          </ToolButton>
        ))}
        <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
        <ToolButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <span className="font-bold">B</span>
        </ToolButton>
        <ToolButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <span className="italic">I</span>
        </ToolButton>
        <ToolButton label="Code block" active={editor.isActive('codeBlock')} onClick={() => applyCodeBlock(editor)}>
          <span className="font-mono text-[11px] leading-none">{'</>'}</span>
        </ToolButton>
        <ToolButton label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <ListIcon />
        </ToolButton>
        <ToolButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListIcon ordered />
        </ToolButton>
        <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
        {COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            aria-label={color.name}
            aria-pressed={currentColor === color.value}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (currentColor === color.value) editor.chain().focus().unsetColor().run()
              else editor.chain().focus().setColor(color.value).run()
            }}
            className={`size-4 cursor-pointer rounded-full border border-[var(--line,#e2e8f0)] ring-offset-2 ring-offset-[var(--card,#ffffff)] transition-shadow duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta ${currentColor === color.value ? 'ring-2 ring-[var(--button,#0f172a)]' : ''}`}
            style={{ backgroundColor: color.value }}
          />
        ))}
        <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
        {['left', 'center', 'right'].map((align) => (
          <ToolButton
            key={align}
            label={`Align ${align}`}
            active={editor.isActive({ textAlign: align })}
            onClick={() => editor.chain().focus().setTextAlign(align).run()}
          >
            <AlignIcon align={align} />
          </ToolButton>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

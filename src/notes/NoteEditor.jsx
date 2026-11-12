import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { php } from '@codemirror/lang-php'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { EditorView } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { useMemo } from 'react'
import { extensionOf } from '../lib/notes'

const deskTheme = EditorView.theme({
  '&': {
    backgroundColor: '#ffffff',
    color: '#020617',
    fontSize: '14px',
  },
  '.cm-scroller': {
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
    lineHeight: '1.6',
  },
  '.cm-content': {
    padding: '12px 0',
    caretColor: '#0369a1',
  },
  '.cm-gutters': {
    backgroundColor: '#f8fafc',
    color: '#334155',
    borderRight: '1px solid #cbd5e1',
  },
  '.cm-activeLine': { backgroundColor: '#f8fafc' },
  '.cm-activeLineGutter': { backgroundColor: '#f1f5f9' },
  '&.cm-focused': { outline: 'none' },
})

function languageFor(filename) {
  const ext = extensionOf(filename)
  if (ext === 'php' || ext === 'phtml') return php()
  if (ext === 'py') return python()
  if (ext === 'sql') return sql()
  if (ext === 'css' || ext === 'scss') return css()
  if (ext === 'html' || ext === 'htm' || ext === 'vue' || ext === 'svelte') return html()
  if (['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'json'].includes(ext)) {
    return javascript({ jsx: true, typescript: ext === 'ts' || ext === 'tsx' })
  }
  if (ext === 'md') return markdown()
  return null
}

export default function NoteEditor({ value, onChange, filename, label, height = '62vh' }) {
  const extensions = useMemo(() => {
    const language = filename ? languageFor(filename) : markdown()
    return language ? [deskTheme, language] : [deskTheme]
  }, [filename])

  return (
    <div className="note-editor overflow-hidden border border-line bg-white focus-within:ring-2 focus-within:ring-cta">
      <CodeMirror
        value={value}
        height={height}
        theme="none"
        extensions={extensions}
        onChange={onChange}
        basicSetup={{ lineNumbers: true, foldGutter: false, autocompletion: false }}
        placeholder={filename ? '' : 'Start writing…'}
        aria-label={label}
      />
    </div>
  )
}

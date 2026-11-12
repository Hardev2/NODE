import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { php } from '@codemirror/lang-php'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { EditorView } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { useMemo } from 'react'
import { extensionOf } from '../lib/notes'

const lightSyntax = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.self, t.processingInstruction, t.meta, t.tagName], color: '#7c3aed' },
  { tag: [t.string, t.special(t.string), t.regexp, t.attributeValue], color: '#15803d' },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: '#64748b', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName)), t.standard(t.variableName)], color: '#b45309' },
  { tag: [t.number, t.integer, t.float, t.bool, t.null, t.atom], color: '#c2410c' },
  { tag: [t.className, t.typeName, t.namespace, t.definition(t.className)], color: '#0f172a' },
  { tag: [t.variableName, t.propertyName, t.attributeName], color: '#020617' },
])

const darkSyntax = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.self, t.processingInstruction, t.meta, t.tagName], color: '#c792ea' },
  { tag: [t.string, t.special(t.string), t.regexp, t.attributeValue], color: '#8fdb7a' },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: '#9a938c', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName)), t.standard(t.variableName)], color: '#e6c07b' },
  { tag: [t.number, t.integer, t.float], color: '#f0a070' },
  { tag: [t.bool, t.null, t.atom], color: '#82aaff' },
  { tag: [t.className, t.typeName, t.namespace, t.definition(t.className)], color: '#f4efe9' },
  { tag: [t.variableName, t.propertyName, t.attributeName, t.operator, t.punctuation], color: '#e8e4df' },
])

const lightDeskTheme = EditorView.theme({
  '&': {
    backgroundColor: '#ffffff',
    color: '#020617',
    fontSize: '14px',
  },
  '.cm-scroller': {
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
    lineHeight: '1.65',
  },
  '.cm-content': {
    padding: '12px 0',
    caretColor: '#0369a1',
  },
  '.cm-gutters': {
    backgroundColor: '#f8fafc',
    color: '#64748b',
    borderRight: '1px solid #e2e8f0',
  },
  '.cm-activeLine': { backgroundColor: '#f8fafc' },
  '.cm-activeLineGutter': { backgroundColor: '#f1f5f9' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: '#dbeafe' },
  '&.cm-focused': { outline: 'none' },
})

const darkDeskTheme = EditorView.theme({
  '&': {
    backgroundColor: '#0B0909',
    color: '#e8e4df',
    fontSize: '14px',
  },
  '.cm-scroller': {
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
    lineHeight: '1.65',
  },
  '.cm-content': {
    padding: '12px 0',
    caretColor: '#f3ece4',
  },
  '.cm-gutters': {
    backgroundColor: '#0B0909',
    color: '#8a8178',
    borderRight: '1px solid #2c2624',
  },
  '.cm-activeLine': { backgroundColor: '#161210' },
  '.cm-activeLineGutter': { backgroundColor: '#161210', color: '#d9d3cc' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(199, 146, 234, 0.28)' },
  '&.cm-focused': { outline: 'none' },
}, { dark: true })

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

export default function NoteEditor({ value, onChange, filename, label, height = '62vh', dark = false }) {
  const extensions = useMemo(() => {
    const language = filename ? languageFor(filename) : markdown()
    const theme = dark ? darkDeskTheme : lightDeskTheme
    const syntax = syntaxHighlighting(dark ? darkSyntax : lightSyntax)
    return language ? [theme, syntax, language] : [theme, syntax]
  }, [filename, dark])

  return (
    <div className="note-editor overflow-hidden bg-transparent focus-within:ring-2 focus-within:ring-cta">
      <CodeMirror
        value={value}
        height={height}
        theme="none"
        extensions={extensions}
        onChange={onChange}
        basicSetup={{ lineNumbers: true, foldGutter: false, autocompletion: false, syntaxHighlighting: false }}
        placeholder={filename ? '' : 'Start writing…'}
        aria-label={label}
      />
    </div>
  )
}

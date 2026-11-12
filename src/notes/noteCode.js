import { textblockTypeInputRule } from '@tiptap/core'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import CodeBlockView from './CodeBlockView'
import { canonicalLanguage, detectLanguage, fenceParts, looksLikeCode } from './codeDetect'
import { lowlight } from './lowlight'

const fenceRule = /^```([\w#+.-]*)[\s\n]$/
const tildeRule = /^~~~([\w#+.-]*)[\s\n]$/

function languageFromFence(match) {
  return { language: canonicalLanguage(match[1]) }
}

function insertCode(view, code, language) {
  const text = String(code ?? '').replace(/\r\n/g, '\n').replace(/\n+$/, '')
  if (!text) return false
  const lang = canonicalLanguage(language) || detectLanguage(text)
  const { schema, selection } = view.state
  const node = schema.nodes.codeBlock.create(
    { language: lang },
    schema.text(text),
  )
  let tr = view.state.tr
  const { $from } = selection
  if (selection.empty && $from.parent.type.name === 'paragraph' && $from.parent.textContent === '') {
    tr = tr.replaceWith($from.before(), $from.after(), node)
  } else {
    tr = tr.replaceSelectionWith(node)
  }
  view.dispatch(tr.setMeta('paste', true).scrollIntoView())
  return true
}

function promoteCodeParagraph(editor) {
  const { state } = editor
  const { selection } = state
  const { $from, empty } = selection
  if (!empty || $from.parent.type.name !== 'paragraph') return false
  const text = $from.parent.textContent
  if (!looksLikeCode(text)) return false
  const language = detectLanguage(text)
  return editor.commands.command(({ tr }) => {
    const start = $from.before()
    const node = state.schema.nodes.codeBlock.create(
      { language },
      state.schema.text(`${text}\n`),
    )
    tr.replaceWith(start, $from.after(), node)
    const cursor = start + text.length + 2
    const $cursor = tr.doc.resolve(Math.min(cursor, tr.doc.content.size))
    if ($cursor.parent.type.name === 'codeBlock') tr.setSelection(TextSelection.create(tr.doc, $cursor.pos))
    else {
      const inside = TextSelection.findFrom(tr.doc.resolve(start + 1), 1, true)
      if (inside) tr.setSelection(inside)
    }
    return true
  })
}

export const NoteCodeBlock = CodeBlockLowlight.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      lowlight,
      defaultLanguage: null,
      enableTabIndentation: true,
      tabSize: 4,
      HTMLAttributes: { class: 'note-code-block' },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView, {
      stopEvent: ({ event }) => {
        const target = event.target
        if (!(target instanceof Element)) return false
        return Boolean(target.closest('select, button, .note-code-bar'))
      },
    })
  },
  addInputRules() {
    return [
      textblockTypeInputRule({ find: fenceRule, type: this.type, getAttributes: languageFromFence }),
      textblockTypeInputRule({ find: tildeRule, type: this.type, getAttributes: languageFromFence }),
    ]
  },
  addKeyboardShortcuts() {
    const parent = this.parent?.() ?? {}
    return {
      ...parent,
      Enter: ({ editor }) => {
        if (parent.Enter?.({ editor })) return true
        return promoteCodeParagraph(editor)
      },
    }
  },
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        key: new PluginKey('noteCodeDetect'),
        props: {
          handlePaste(view, event) {
            if (!event.clipboardData) return false
            if (view.state.selection.$from.parent.type.name === 'codeBlock') return false
            const text = event.clipboardData.getData('text/plain')
            if (!text.trim()) return false
            const fence = fenceParts(text)
            if (fence?.code) return insertCode(view, fence.code, fence.language)
            let mode = null
            const vscode = event.clipboardData.getData('vscode-editor-data')
            if (vscode) {
              try {
                mode = canonicalLanguage(JSON.parse(vscode)?.mode)
              } catch {
                mode = null
              }
            }
            if (mode || looksLikeCode(text)) return insertCode(view, text, mode)
            return false
          },
        },
      }),
    ]
  },
})

export function applyCodeBlock(editor) {
  if (!editor) return
  if (editor.isActive('codeBlock')) {
    editor.chain().focus().toggleCodeBlock().run()
    return
  }
  const { from, to, empty, $from } = editor.state.selection
  const text = empty ? $from.parent.textContent : editor.state.doc.textBetween(from, to, '\n')
  const language = detectLanguage(text)
  editor.chain().focus().toggleCodeBlock(language ? { language } : {}).run()
}

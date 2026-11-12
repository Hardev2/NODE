import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CODE_LANGUAGES, canonicalLanguage, languageLabel } from './codeDetect'
import { lowlight } from './lowlight'

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="5.2" y="5.2" width="8" height="8" rx="1.2" />
      <path d="M10.8 5.2V3.6A1.2 1.2 0 0 0 9.6 2.4H3.6A1.2 1.2 0 0 0 2.4 3.6v6A1.2 1.2 0 0 0 3.6 10.8H5.2" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function CodeBlockView({ node, updateAttributes, selected }) {
  const language = node.attrs.language || null
  const timer = useRef(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (!language) return
    const next = canonicalLanguage(language)
    if (next !== language) updateAttributes({ language: next })
  }, [language, updateAttributes])

  const detected = useMemo(() => {
    if (language) return languageLabel(language)
    const text = node.textContent
    if (!text.trim()) return 'Code'
    try {
      const result = lowlight.highlightAuto(text)
      const found = result.data?.language
      if (!found || found === 'plaintext' || (result.data?.relevance ?? 0) < 2) return 'Code'
      return languageLabel(found)
    } catch {
      return 'Code'
    }
  }, [language, node.textContent])

  function copyCode(event) {
    event.preventDefault()
    const text = node.textContent
    const done = () => {
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1400)
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => setCopied(false))
      return
    }
    setCopied(false)
  }

  return (
    <NodeViewWrapper className={`note-code${selected ? ' is-selected' : ''}`} data-language={language || detected} translate="no">
      <div className="note-code-bar" contentEditable={false}>
        <label className="note-code-lang">
          <span className="note-code-mark" aria-hidden="true">{'</>'}</span>
          <select
            value={language || 'auto'}
            aria-label="Code language"
            onChange={(event) => {
              const value = event.target.value
              updateAttributes({ language: value === 'auto' ? null : value })
            }}
          >
            <option value="auto">{language ? 'Auto' : detected}</option>
            {CODE_LANGUAGES.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
          <svg viewBox="0 0 12 12" className="note-code-caret" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 4.5 6 7.5 9 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </label>
        <button
          type="button"
          className="note-code-copy"
          aria-label={copied ? 'Copied' : 'Copy code'}
          onMouseDown={(event) => event.preventDefault()}
          onClick={copyCode}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
      <pre className="note-code-body">
        <NodeViewContent as="code" spellCheck={false} />
      </pre>
    </NodeViewWrapper>
  )
}

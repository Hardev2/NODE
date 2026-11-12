import { useRef, useState } from 'react'
import { safeFileName } from '../lib/localFile'

const FILE_DRAG = 'application/x-northline-file'

function Chevron({ open }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 3.5 10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FolderMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2 4.5h4l1.2 1.4H14V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5z" strokeLinejoin="round" />
    </svg>
  )
}

const ACTION_TONES = {
  file: 'bg-[#e0f2fe] text-[#0369A1] hover:bg-[#bae6fd]',
  folder: 'bg-[#fef3c7] text-[#b45309] hover:bg-[#fde68a]',
  rename: 'bg-[#f1f5f9] text-[#334155] hover:bg-[#e2e8f0]',
  delete: 'bg-[#ffe4e6] text-[#9f1239] hover:bg-[#fecdd3]',
  save: 'bg-[#dcfce7] text-[#166534] hover:bg-[#bbf7d0]',
}

function ActionIcon({ name }) {
  const common = { viewBox: '0 0 16 16', className: 'size-3.5', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 }
  if (name === 'file') {
    return (
      <svg {...common}>
        <path d="M4 2.5h5L12 5.5V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z" strokeLinejoin="round" />
        <path d="M8 7.5v4M6 9.5h4" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'folder') {
    return (
      <svg {...common}>
        <path d="M1.8 5h3.4l1.1 1.3H14V12a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1V5z" strokeLinejoin="round" />
        <path d="M8 7.2v3.6M6.2 9h3.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'rename') {
    return (
      <svg {...common}>
        <path d="M9.2 2.8 13.2 6.8 5.8 14.2H1.8v-4z" strokeLinejoin="round" />
        <path d="M8 4 12 8" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'save') {
    return (
      <svg {...common}>
        <path d="M8 2.5v7" strokeLinecap="round" />
        <path d="M5.2 7.2 8 10l2.8-2.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 12.5h10" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M3.2 4.5h9.6M6.2 4.5V3h3.6v1.5M4.6 4.5l.5 8.2h5.8l.5-8.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FolderAction({ label, onClick, tone, disabled = false }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={`grid size-7 shrink-0 cursor-pointer place-items-center rounded-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta disabled:cursor-wait disabled:opacity-60 ${ACTION_TONES[tone]}`}
    >
      <ActionIcon name={tone} />
    </button>
  )
}

function quietButton(extra = '') {
  return `cursor-pointer rounded px-2 py-1 text-xs font-semibold text-slate-ink transition-colors duration-200 hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta disabled:cursor-wait disabled:opacity-60 ${extra}`
}

function dropTypes(event) {
  return [...event.dataTransfer.types]
}

function canAcceptDrop(event, internalId) {
  if (internalId) return true
  return dropTypes(event).includes('Files')
}

function allowDrop(event, internalId) {
  if (!canAcceptDrop(event, internalId)) return false
  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
  return true
}

export default function FolderPane({
  folders,
  files,
  openFolders,
  selectedFolderId,
  activeFileId,
  activeFileText,
  working,
  onSelectFolder,
  onOpenFile,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onAddFiles,
  onUploadFiles,
  onMoveFile,
  onSaveFile,
  onDeleteFile,
}) {
  const [draft, setDraft] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [notice, setNotice] = useState('')
  const draggedRef = useRef(false)
  const dragIdRef = useRef(null)
  const dragUrlRef = useRef('')

  const roots = folders.filter((folder) => !folder.parent_id)
  const loose = files.filter((file) => !file.folder_id)

  function childrenOf(parentId) {
    return folders.filter((folder) => folder.parent_id === parentId)
  }

  function filesIn(folderId) {
    return files.filter((file) => file.folder_id === folderId)
  }

  function startCreate(parentId) {
    setRenamingId(null)
    setPendingDelete(null)
    setDraft({ parentId, name: '' })
  }

  function commitCreate() {
    const name = draft?.name.trim() ?? ''
    if (!name) return
    onCreateFolder(draft.parentId, name)
    setDraft(null)
  }

  function commitRename() {
    const name = renameValue.trim()
    if (!name || !renamingId) return
    onRenameFolder(renamingId, name)
    setRenamingId(null)
  }

  function placeDropped(event, folderId) {
    event.preventDefault()
    event.stopPropagation()
    setDropTarget(null)
    const movingId = dragIdRef.current || event.dataTransfer.getData(FILE_DRAG)
    if (dragIdRef.current || event.dataTransfer.getData(FILE_DRAG)) {
      const file = files.find((item) => item.id === movingId)
      if (file) onMoveFile(file, folderId)
      return
    }
    const fromComputer = [...event.dataTransfer.files]
    if (fromComputer.length) onUploadFiles(fromComputer, folderId)
  }

  function beginDrag(event, file) {
    draggedRef.current = true
    dragIdRef.current = file.id
    const payload = file.id === activeFileId ? (activeFileText ?? '') : (file.content ?? '')
    const name = safeFileName(file.name)
    const outgoing = new File([payload], name, { type: 'application/octet-stream' })
    event.dataTransfer.effectAllowed = 'all'
    let hasFile = false
    try {
      event.dataTransfer.items.add(outgoing)
      hasFile = [...event.dataTransfer.items].some((item) => item.kind === 'file')
    } catch {
      hasFile = false
    }
    if (!hasFile) {
      event.dataTransfer.setData(FILE_DRAG, file.id)
      event.dataTransfer.setData('text/plain', payload)
      const url = URL.createObjectURL(outgoing)
      dragUrlRef.current = url
      try {
        event.dataTransfer.setData('DownloadURL', `application/octet-stream:${name}:${url}`)
      } catch {
        // The file can still move between folders in this page.
      }
    }
    event.dataTransfer.effectAllowed = 'all'
  }

  function endDrag() {
    dragIdRef.current = null
    if (dragUrlRef.current) {
      const url = dragUrlRef.current
      dragUrlRef.current = ''
      window.setTimeout(() => URL.revokeObjectURL(url), 30000)
    }
    setDropTarget(null)
    window.setTimeout(() => {
      draggedRef.current = false
    }, 0)
  }

  function renderFile(file, pad) {
    const active = file.id === activeFileId
    return (
      <li key={file.id} className="flex items-center" style={{ paddingLeft: pad }}>
        <div
          role="button"
          tabIndex={0}
          draggable
          onDragStart={(event) => beginDrag(event, file)}
          onDragEnd={endDrag}
          onClick={() => {
            if (draggedRef.current) return
            onOpenFile(file)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onOpenFile(file)
            }
          }}
          className={`min-w-0 flex-1 cursor-grab truncate py-1.5 text-left font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta active:cursor-grabbing ${active ? 'bg-navy text-white' : 'text-slate-ink hover:bg-paper hover:text-ink'}`}
        >
          {file.name}
        </div>
        <div className="flex shrink-0 gap-1">
          <FolderAction
            tone="save"
            label={`Save ${file.name} to a folder on this computer`}
            onClick={() => {
              void Promise.resolve(onSaveFile(file)).then((text) => {
                if (text) setNotice(text)
              })
            }}
          />
          <FolderAction tone="delete" label={`Remove ${file.name}`} onClick={() => onDeleteFile(file)} />
        </div>
      </li>
    )
  }

  function renderFolder(folder, depth) {
    const open = Boolean(openFolders[folder.id])
    const isSelected = folder.id === selectedFolderId
    const nested = childrenOf(folder.id)
    const innerFiles = filesIn(folder.id)
    const targeted = dropTarget === folder.id

    return (
      <li
        key={folder.id}
        data-drop-folder={folder.id}
        onDragOver={(event) => {
          if (!allowDrop(event, dragIdRef.current)) return
          event.stopPropagation()
          setDropTarget(folder.id)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDropTarget((current) => (current === folder.id ? null : current))
        }}
        onDrop={(event) => {
          event.stopPropagation()
          placeDropped(event, folder.id)
        }}
        className={targeted ? 'rounded bg-[#e0f2fe]' : ''}
      >
        <div className={`flex items-center gap-0.5 rounded-md pr-0.5 ${isSelected && !targeted ? 'bg-paper' : ''}`} style={{ paddingLeft: `${depth * 12 + 2}px` }}>
          {renamingId === folder.id ? (
            <form
              className="flex min-w-0 flex-1 gap-1 py-1"
              onSubmit={(event) => {
                event.preventDefault()
                commitRename()
              }}
            >
              <input
                value={renameValue}
                autoFocus
                aria-label="Folder name"
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setRenamingId(null)
                }}
                className="min-w-0 flex-1 rounded-md border border-line bg-white px-2 py-1 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta"
              />
              <button type="submit" className="cursor-pointer rounded-md bg-navy px-2 py-1 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta">
                Save
              </button>
            </form>
          ) : (
            <>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => onSelectFolder(folder.id)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 py-1 text-left text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta"
              >
                <Chevron open={open} />
                <FolderMark />
                <span className="truncate">{folder.name}</span>
              </button>
            </>
          )}
        </div>
        {pendingDelete === folder.id ? (
          <div className="py-1 pr-1 text-xs" style={{ paddingLeft: `${depth * 12 + 22}px` }}>
            <p>Delete this folder and everything inside it?</p>
            <div className="mt-1 flex gap-1">
              <button type="button" onClick={() => { onDeleteFolder(folder.id); setPendingDelete(null) }} className="cursor-pointer rounded-md bg-alert px-2 py-1 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy">
                Delete
              </button>
              <button type="button" onClick={() => setPendingDelete(null)} className={quietButton()}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {open ? (
          <div style={{ paddingLeft: `${depth * 12 + 22}px` }}>
            <div className="flex gap-1 py-1">
              <FolderAction tone="file" label={`Add a file in ${folder.name}`} onClick={() => onAddFiles(folder.id)} />
              <FolderAction tone="folder" label={`New folder inside ${folder.name}`} onClick={() => startCreate(folder.id)} />
              <FolderAction
                tone="rename"
                label={`Rename ${folder.name}`}
                onClick={() => {
                  setRenameValue(folder.name)
                  setRenamingId(folder.id)
                  setDraft(null)
                  setPendingDelete(null)
                }}
              />
              <FolderAction tone="delete" label={`Delete ${folder.name}`} onClick={() => { setDraft(null); setPendingDelete(folder.id) }} />
            </div>
            {draft?.parentId === folder.id ? (
              <form
                className="flex gap-1 py-1 pr-1"
                onSubmit={(event) => {
                  event.preventDefault()
                  commitCreate()
                }}
              >
                <input
                  value={draft.name}
                  autoFocus
                  aria-label={`New folder inside ${folder.name}`}
                  placeholder="Folder name"
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  className="min-w-0 flex-1 rounded-md border border-line bg-white px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta"
                />
                <button type="submit" className="cursor-pointer rounded-md bg-navy px-2 py-1 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta">
                  Add
                </button>
              </form>
            ) : null}
            <ul>
              {nested.map((child) => renderFolder(child, depth + 1))}
              {innerFiles.map((file) => renderFile(file, '8px'))}
              {nested.length === 0 && innerFiles.length === 0 ? (
                <li className="py-1 text-xs text-slate-ink/70">Empty</li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </li>
    )
  }

  const outsideHot = dropTarget === 'outside'

  return (
    <div className="flex min-h-dvh flex-col bg-white lg:h-dvh lg:max-h-dvh lg:min-h-0">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
        <h2 className="font-display text-sm font-semibold">Folders</h2>
        <FolderAction tone="folder" label="New folder" onClick={() => startCreate(null)} />
      </div>

      {draft && !draft.parentId ? (
        <form
          className="flex gap-1.5 border-b border-line px-3 py-2"
          onSubmit={(event) => {
            event.preventDefault()
            commitCreate()
          }}
        >
          <input
            value={draft.name}
            autoFocus
            aria-label="New folder"
            placeholder="Folder name"
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            className="min-w-0 flex-1 rounded-md border border-line px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta"
          />
          <button type="submit" className="cursor-pointer rounded-md bg-navy px-2 py-1 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta">
            Add
          </button>
        </form>
      ) : null}

      {notice ? <p className="border-b border-line px-3 py-2 text-xs leading-relaxed text-slate-ink" role="status">{notice}</p> : null}

      <div
        className={`mx-2 mt-2 rounded-lg border border-dashed px-2.5 py-2 transition-colors duration-200 ${outsideHot ? 'border-cta bg-[#e0f2fe]' : 'border-line'}`}
        onDragOver={(event) => {
          if (!allowDrop(event, dragIdRef.current)) return
          setDropTarget('outside')
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDropTarget((current) => (current === 'outside' ? null : current))
        }}
        onDrop={(event) => placeDropped(event, null)}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-ink">Outside</p>
          <FolderAction tone="file" label="Add a file outside the folders" disabled={working} onClick={() => onAddFiles(null)} />
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-ink">Files here sit outside every folder.</p>
        <ul className="mt-1">
          {loose.map((file) => renderFile(file, '0px'))}
        </ul>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {roots.length === 0 ? (
          <p className="px-2 py-4 text-sm leading-relaxed text-slate-ink">Drag a file onto a folder to put it inside.</p>
        ) : (
          <ul aria-label="Folders">{roots.map((folder) => renderFolder(folder, 0))}</ul>
        )}
      </div>
    </div>
  )
}

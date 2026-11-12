import { useEffect, useRef, useState } from 'react'
import {
  createFile,
  createFolder,
  createNote,
  deleteFolder,
  deleteNote,
  deleteNoteFile,
  fileKindError,
  getNote,
  isSetupError,
  listFiles,
  listFolders,
  listNotes,
  moveFile,
  notePlainText,
  parseNotePages,
  readFileAsText,
  renameFolder,
  saveFile,
  saveNote,
  serializeNotePages,
  sqlEditorUrl,
} from '../lib/notes'
import { downloadTextFile, writeTextToFolder } from '../lib/localFile'
import DocEditor from './DocEditor'
import FolderPane from './FolderPane'
import NoteEditor from './NoteEditor'

function formatWhen(iso) {
  if (!iso) return ''
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(iso))
}

function displayTitle(title) {
  const trimmed = title.trim()
  return trimmed || 'Untitled'
}

function plainHtml(html) {
  return String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function snippetAround(text, needle) {
  const haystack = text.replace(/\s+/g, ' ').trim()
  const at = haystack.toLowerCase().indexOf(needle)
  if (at < 0) return ''
  const start = Math.max(0, at - 18)
  const excerpt = haystack.slice(start, at + needle.length + 28).trim()
  return start > 0 ? `…${excerpt}` : excerpt
}

function StackMap({ pages, activeId, stackNeedle, onJump, layout = 'rail' }) {
  if (!pages.length) return null
  const rail = layout === 'rail'
  return (
    <nav aria-label="Stack map" className={rail ? 'flex flex-col gap-1.5' : 'mb-3 flex gap-1.5 overflow-x-auto lg:hidden'}>
      {pages.map((page, index) => {
        const text = plainHtml(page.html)
        const hit = Boolean(stackNeedle) && text.toLowerCase().includes(stackNeedle)
        const active = page.id === activeId
        const lines = Math.min(6, Math.max(2, Math.ceil(text.length / 42)))
        return (
          <button
            key={page.id}
            type="button"
            onClick={() => onJump(page.id)}
            aria-current={active ? 'true' : undefined}
            aria-label={`Show note ${index + 1}`}
            className={`${rail ? 'w-full' : 'w-16 shrink-0'} cursor-pointer overflow-hidden rounded-md border bg-white px-1.5 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta ${active ? 'border-navy shadow-[0_0_0_1px_#0f172a]' : hit ? 'border-cta' : 'border-line'}`}
          >
            <span className={`block text-[10px] font-semibold ${active ? 'text-navy' : 'text-slate-ink'}`}>{index + 1}</span>
            <span
              className="mt-0.5 block overflow-hidden text-[9px] leading-[1.15] text-[#475569]"
              style={{ display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical' }}
            >
              {text || 'Empty'}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

function cleanName(value) {
  const name = value.trim()
  if (!name) return { error: 'Enter a name.' }
  if (/[\\/]/.test(name)) return { error: 'Keep slashes out of the name.' }
  return { name }
}

function nameTaken(folders, files, parentId, name, ignoreId) {
  const key = name.toLowerCase()
  const folderHit = folders.some((folder) => (folder.parent_id ?? null) === (parentId ?? null) && folder.name.toLowerCase() === key && folder.id !== ignoreId)
  const fileHit = files.some((file) => (file.folder_id ?? null) === (parentId ?? null) && file.name.toLowerCase() === key && file.id !== ignoreId)
  return folderHit || fileHit
}

function ancestorMap(folderId, folders) {
  const open = {}
  let current = folderId
  const seen = new Set()
  while (current && !seen.has(current)) {
    seen.add(current)
    open[current] = true
    current = folders.find((folder) => folder.id === current)?.parent_id ?? null
  }
  return open
}

export default function NotesDesk({ userId, email, onSignOut, signingOut }) {
  const fileInputRef = useRef(null)
  const uploadTargetRef = useRef(null)
  const localFolderRef = useRef(null)
  const draftRef = useRef({})
  const savedRef = useRef({ noteId: null, title: '', body: '', fileId: null, fileText: '' })
  const canSaveRef = useRef(false)
  const pageDragRef = useRef(null)

  const [notes, setNotes] = useState([])
  const [folders, setFolders] = useState([])
  const [files, setFiles] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [title, setTitle] = useState('')
  const [pages, setPages] = useState([])
  const [focusPageId, setFocusPageId] = useState(null)
  const [pageDropId, setPageDropId] = useState(null)
  const [search, setSearch] = useState('')
  const [stackSearch, setStackSearch] = useState('')
  const [activeMapId, setActiveMapId] = useState(null)
  const [activeFileId, setActiveFileId] = useState(null)
  const [fileText, setFileText] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState(null)
  const [openFolders, setOpenFolders] = useState({})
  const [panel, setPanel] = useState('list')
  const [loading, setLoading] = useState(true)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [message, setMessage] = useState('')
  const [saveState, setSaveState] = useState('saved')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [working, setWorking] = useState(false)

  draftRef.current = { selectedId, title, body: serializeNotePages(pages), activeFileId, fileText }

  useEffect(() => {
    document.title = 'NODE — Notes'
    let active = true
    listNotes()
      .then((rows) => {
        if (!active) return
        setNotes(rows)
        setLoading(false)
      })
      .catch((error) => {
        if (!active) return
        setSetupNeeded(isSetupError(error))
        if (isSetupError(error)) setPanel('note')
        setMessage(isSetupError(error) ? '' : (error.message ?? 'The notes could not be loaded.'))
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return undefined
    const handle = window.setTimeout(() => {
      void persist()
    }, 700)
    return () => window.clearTimeout(handle)
  }, [title, pages, fileText, selectedId, activeFileId])

  useEffect(() => {
    if (!selectedId || activeFileId) return undefined
    const nodes = pages
      .map((page) => document.getElementById(`note-page-${page.id}`))
      .filter(Boolean)
    if (!nodes.length) return undefined
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      const id = visible?.target?.id?.replace('note-page-', '')
      if (id) setActiveMapId(id)
    }, { rootMargin: '-15% 0px -50% 0px', threshold: [0.2, 0.5, 0.8] })
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [selectedId, activeFileId, pages, stackSearch])

  function jumpToPage(id) {
    const node = document.getElementById(`note-page-${id}`)
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveMapId(id)
      return
    }
    setStackSearch('')
    window.setTimeout(() => {
      document.getElementById(`note-page-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveMapId(id)
    }, 0)
  }

  function markSetup(error) {
    if (!isSetupError(error)) return false
    setSetupNeeded(true)
    setPanel('note')
    setMessage('')
    return true
  }

  async function persist() {
    if (!canSaveRef.current) return
    const draft = draftRef.current
    const saved = savedRef.current
    try {
      if (draft.activeFileId) {
        if (saved.fileId !== draft.activeFileId || saved.fileText === draft.fileText) return
        setSaveState('saving')
        await saveFile(draft.activeFileId, draft.fileText)
        savedRef.current = { ...saved, fileId: draft.activeFileId, fileText: draft.fileText }
        setFiles((current) => current.map((file) => (
          file.id === draft.activeFileId ? { ...file, content: draft.fileText } : file
        )))
        setSaveState('saved')
        return
      }
      if (saved.noteId !== draft.selectedId) return
      const nextTitle = displayTitle(draft.title)
      if (saved.title === nextTitle && saved.body === draft.body) return
      setSaveState('saving')
      await saveNote(draft.selectedId, { title: nextTitle, body: draft.body })
      savedRef.current = { ...saved, noteId: draft.selectedId, title: nextTitle, body: draft.body }
      const updatedAt = new Date().toISOString()
      setNotes((current) => current
        .map((note) => (note.id === draft.selectedId ? { ...note, title: nextTitle, body: draft.body, updated_at: updatedAt } : note))
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)))
      setSaveState('saved')
    } catch (error) {
      if (markSetup(error)) return
      setSaveState('error')
      setMessage(error.message ?? 'The last edit could not be saved.')
    }
  }

  function resetNoteView(note, nextFolders, nextFiles) {
    const nextTitle = note.title || 'Untitled'
    const nextPages = parseNotePages(note.body)
    savedRef.current = { noteId: note.id, title: nextTitle, body: serializeNotePages(nextPages), fileId: null, fileText: '' }
    setSelectedId(note.id)
    setTitle(nextTitle)
    setPages(nextPages)
    setFocusPageId(null)
    setActiveMapId(nextPages[0]?.id ?? null)
    setFolders(nextFolders)
    setFiles(nextFiles)
    setActiveFileId(null)
    setFileText('')
    setSelectedFolderId(null)
    setOpenFolders({})
    setPanel('note')
    setSaveState('saved')
    setConfirmDelete(false)
    canSaveRef.current = true
  }

  async function openNote(id) {
    setMessage('')
    await persist()
    canSaveRef.current = false
    try {
      const [note, nextFiles, nextFolders] = await Promise.all([getNote(id), listFiles(id), listFolders(id)])
      resetNoteView(note, nextFolders, nextFiles)
    } catch (error) {
      canSaveRef.current = true
      if (markSetup(error)) return
      setMessage(error.message ?? 'That note could not be opened.')
    }
  }

  async function addNote() {
    setMessage('')
    setWorking(true)
    try {
      await persist()
      canSaveRef.current = false
      const note = await createNote(userId)
      setNotes((current) => [note, ...current])
      resetNoteView(note, [], [])
    } catch (error) {
      canSaveRef.current = true
      if (markSetup(error)) return
      setMessage(error.message ?? 'The note could not be created.')
    } finally {
      setWorking(false)
    }
  }

  async function removeNote() {
    if (!selectedId) return
    setWorking(true)
    canSaveRef.current = false
    try {
      await deleteNote(selectedId)
      setNotes((current) => current.filter((note) => note.id !== selectedId))
      setSelectedId(null)
      setPages([])
      setFolders([])
      setFiles([])
      setActiveFileId(null)
      setSelectedFolderId(null)
      setConfirmDelete(false)
      setPanel('list')
      savedRef.current = { noteId: null, title: '', body: '', fileId: null, fileText: '' }
    } catch (error) {
      setMessage(error.message ?? 'The note could not be deleted.')
      canSaveRef.current = true
    } finally {
      setWorking(false)
    }
  }

  function changePage(id, html) {
    setPages((current) => current.map((page) => (page.id === id ? { ...page, html } : page)))
  }

  function addPage() {
    const id = crypto.randomUUID()
    setFocusPageId(id)
    setPages((current) => [...current, { id, html: '<p></p>' }])
  }

  function removePage(id) {
    setPages((current) => current.filter((page) => page.id !== id))
  }

  function movePage(id, direction) {
    setPages((current) => {
      const index = current.findIndex((page) => page.id === id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  function dropPage(targetId, event) {
    event.preventDefault()
    setPageDropId(null)
    const id = pageDragRef.current || event.dataTransfer.getData('application/x-northline-page')
    pageDragRef.current = null
    if (!id || id === targetId) return
    setPages((current) => {
      const from = current.findIndex((page) => page.id === id)
      const to = current.findIndex((page) => page.id === targetId)
      if (from < 0 || to < 0) return current
      const next = [...current]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  function showNoteText() {
    void persist().then(() => {
      savedRef.current = { ...savedRef.current, fileId: null, fileText: '' }
      setActiveFileId(null)
      setFileText('')
      setPanel('note')
    })
  }

  function showFile(file) {
    void persist().then(() => {
      savedRef.current = { ...savedRef.current, fileId: file.id, fileText: file.content ?? '' }
      setActiveFileId(file.id)
      setFileText(file.content ?? '')
      if (file.folder_id) {
        setSelectedFolderId(file.folder_id)
        setOpenFolders((current) => ({ ...current, ...ancestorMap(file.folder_id, folders) }))
      }
      setPanel('note')
    })
  }

  async function addFolder(parentId, rawName) {
    const parsed = cleanName(rawName)
    if (parsed.error) {
      setMessage(parsed.error)
      return
    }
    if (nameTaken(folders, files, parentId, parsed.name)) {
      setMessage('That name is already in this folder.')
      return
    }
    setWorking(true)
    setMessage('')
    try {
      const folder = await createFolder(userId, selectedId, parsed.name, parentId)
      setFolders((current) => [...current, folder].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedFolderId(folder.id)
      setOpenFolders((current) => ({ ...current, ...ancestorMap(folder.id, [...folders, folder]) }))
    } catch (error) {
      if (markSetup(error)) return
      const detail = error.message ?? 'The folder could not be created.'
      const needsRules = /recursion|row-level security|permission denied/i.test(detail)
      setMessage(needsRules ? `${detail} Run supabase/schema.sql again, then create the folder once more.` : detail)
    } finally {
      setWorking(false)
    }
  }

  async function renameSelectedFolder(id, rawName) {
    const parsed = cleanName(rawName)
    if (parsed.error) {
      setMessage(parsed.error)
      return
    }
    const folder = folders.find((item) => item.id === id)
    if (!folder) return
    if (nameTaken(folders, files, folder.parent_id, parsed.name, id)) {
      setMessage('That name is already in this folder.')
      return
    }
    setWorking(true)
    try {
      await renameFolder(id, parsed.name)
      setFolders((current) => current.map((item) => (item.id === id ? { ...item, name: parsed.name } : item)))
      setMessage('')
    } catch (error) {
      setMessage(error.message ?? 'The folder could not be renamed.')
    } finally {
      setWorking(false)
    }
  }

  async function removeFolder(id) {
    setWorking(true)
    await persist()
    canSaveRef.current = false
    try {
      await deleteFolder(id)
      const [nextFolders, nextFiles] = await Promise.all([listFolders(selectedId), listFiles(selectedId)])
      setFolders(nextFolders)
      setFiles(nextFiles)
      setSelectedFolderId(null)
      if (!nextFiles.some((file) => file.id === activeFileId)) {
        savedRef.current = { ...savedRef.current, fileId: null, fileText: '' }
        setActiveFileId(null)
        setFileText('')
      }
      setMessage('')
    } catch (error) {
      setMessage(error.message ?? 'The folder could not be deleted.')
    } finally {
      canSaveRef.current = true
      setWorking(false)
    }
  }

  function chooseFolder(id) {
    setSelectedFolderId(id)
    setOpenFolders((current) => ({ ...current, [id]: current[id] && selectedFolderId === id ? false : true }))
    setMessage('')
  }

  async function uploadInto(chosen, folderId) {
    if (!selectedId || chosen.length === 0) return
    setMessage('')
    setWorking(true)
    try {
      const created = []
      for (const file of chosen) {
        const problem = fileKindError(file)
        if (problem) {
          setMessage(`${file.name}: ${problem}`)
          continue
        }
        const parsed = cleanName(file.name)
        if (parsed.error || nameTaken(folders, files, folderId, file.name)) {
          setMessage(`${file.name} is already in that place.`)
          continue
        }
        const content = await readFileAsText(file)
        created.push(await createFile(userId, selectedId, folderId, file.name, content))
      }
      if (created.length) {
        setFiles((current) => [...current, ...created].sort((a, b) => a.name.localeCompare(b.name)))
        if (folderId) setOpenFolders((current) => ({ ...current, [folderId]: true }))
        showFile(created.at(-1))
      }
    } catch (error) {
      if (markSetup(error)) return
      const detail = error.message ?? 'The file could not be stored.'
      const needsRules = /recursion|row-level security|permission denied/i.test(detail)
      setMessage(needsRules ? `${detail} Run supabase/schema.sql again, then drop the file once more.` : detail)
    } finally {
      setWorking(false)
    }
  }

  function onUpload(event) {
    const chosen = Array.from(event.target.files ?? [])
    event.target.value = ''
    void uploadInto(chosen, uploadTargetRef.current)
  }

  async function removeFile(file) {
    setWorking(true)
    const wasActive = activeFileId === file.id
    if (wasActive) canSaveRef.current = false
    try {
      await deleteNoteFile(file.id)
      setFiles((current) => current.filter((item) => item.id !== file.id))
      if (wasActive) {
        savedRef.current = { ...savedRef.current, fileId: null, fileText: '' }
        setActiveFileId(null)
        setFileText('')
        canSaveRef.current = true
      }
    } catch (error) {
      setMessage(error.message ?? 'The file could not be removed.')
      if (wasActive) canSaveRef.current = true
    } finally {
      setWorking(false)
    }
  }

  async function putFileInFolder(file, folderId) {
    const destination = folderId || null
    if ((file.folder_id ?? null) === destination) return
    if (nameTaken(folders, files, destination, file.name, file.id)) {
      setMessage(destination ? 'That name is already in this folder.' : 'That name is already outside the folders.')
      return
    }
    setWorking(true)
    try {
      await moveFile(file.id, destination)
      setFiles((current) => current.map((item) => (item.id === file.id ? { ...item, folder_id: destination } : item)))
      if (destination) setOpenFolders((current) => ({ ...current, [destination]: true }))
      setMessage('')
    } catch (error) {
      setMessage(error.message ?? 'The file could not be moved.')
    } finally {
      setWorking(false)
    }
  }

  function textFor(file) {
    if (file.id === activeFileId) return fileText
    return file.content ?? ''
  }

  async function saveFileToComputer(file) {
    const content = textFor(file)
    try {
      if (typeof window.showDirectoryPicker !== 'function') {
        downloadTextFile(file.name, content)
        const note = `${file.name} was downloaded. Move it into FileZilla from your downloads folder.`
        setMessage(note)
        return note
      }
      let folder = localFolderRef.current
      if (folder) {
        const permission = await folder.requestPermission({ mode: 'readwrite' })
        if (permission !== 'granted') folder = null
      }
      if (!folder) {
        folder = await window.showDirectoryPicker({ mode: 'readwrite' })
        localFolderRef.current = folder
      }
      await writeTextToFolder(folder, file.name, content)
      const note = `${file.name} is in "${folder.name}". Upload that folder with FileZilla.`
      setMessage(note)
      return note
    } catch (error) {
      if (error?.name === 'AbortError') return ''
      downloadTextFile(file.name, content)
      const note = `${file.name} was downloaded. Move it into FileZilla from your downloads folder.`
      setMessage(note)
      return note
    }
  }

  async function reload() {
    setLoading(true)
    setSetupNeeded(false)
    setMessage('')
    try {
      setNotes(await listNotes())
    } catch (error) {
      if (!markSetup(error)) setMessage(error.message ?? 'The notes could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  const activeFile = files.find((file) => file.id === activeFileId) ?? null
  const saveLabel = saveState === 'saving' ? 'Saving' : saveState === 'error' ? 'Not saved' : 'Saved'
  const showList = panel === 'list'
  const showFolders = panel === 'folders'
  const needle = search.trim().toLowerCase()
  const stackNeedle = stackSearch.trim().toLowerCase()
  const otherStackHits = stackNeedle
    ? notes.flatMap((note) => {
        if (note.id === selectedId) return []
        return parseNotePages(note.body || '').flatMap((page, index) => {
          const text = plainHtml(page.html)
          if (!text.toLowerCase().includes(stackNeedle)) return []
          return [{
            key: `${note.id}-${page.id}`,
            noteId: note.id,
            title: displayTitle(note.title),
            label: `Note ${index + 1}`,
            excerpt: snippetAround(text, stackNeedle),
          }]
        })
      })
    : []
  const visibleNotes = needle
    ? notes.filter((note) => {
        const text = note.id === selectedId
          ? `${title} ${pages.map((page) => plainHtml(page.html)).join(' ')}`
          : `${note.title || ''} ${notePlainText(note.body || '')}`
        return text.toLowerCase().includes(needle)
      })
    : notes

  return (
    <div className="min-h-dvh bg-[#e8eef3] text-ink lg:grid lg:grid-cols-[11.5rem_minmax(0,1fr)_15.5rem]">
      <aside className={`${showList ? 'flex' : 'hidden'} min-h-dvh flex-col bg-navy text-paper lg:sticky lg:top-0 lg:z-20 lg:flex lg:h-dvh lg:max-h-dvh lg:self-start lg:overflow-hidden`}>
        <div className="flex items-center justify-between px-3 pt-4">
          <p className="font-display text-xs font-semibold tracking-[0.22em] uppercase">NODE</p>
        </div>
        <div className="px-3 py-3">
          <button
            type="button"
            onClick={addNote}
            disabled={working || setupNeeded}
            className="w-full cursor-pointer rounded-md bg-white px-2.5 py-1.5 text-left text-sm font-semibold text-navy transition-colors duration-200 hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta disabled:cursor-wait disabled:opacity-70"
          >
            New note
          </button>
        </div>
        <div className="px-3 pb-2">
          <label className="block">
            <span className="sr-only">Search notes</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notes"
              className="w-full rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white placeholder:text-paper/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta"
            />
          </label>
        </div>
        <ul className="flex-1 overflow-y-auto px-2 pb-3" aria-label="Your notes">
          {visibleNotes.map((note) => {
            const selected = note.id === selectedId
            const noteText = note.id === selectedId
              ? pages.map((page) => plainHtml(page.html)).join(' ')
              : notePlainText(note.body || '')
            const excerpt = needle ? snippetAround(`${note.title || ''} ${noteText}`, needle) : ''
            return (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => void openNote(note.id)}
                  aria-current={selected ? 'page' : undefined}
                  className={`mb-0.5 w-full cursor-pointer rounded-md px-2 py-1.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta ${selected ? 'bg-white/10' : 'hover:bg-white/5'}`}
                >
                  <span className="block truncate text-sm font-medium">{displayTitle(note.title)}</span>
                  {needle ? (
                    <span className="mt-0.5 block text-[11px] leading-4 text-paper/70">{excerpt || 'Title match'}</span>
                  ) : (
                    <span className="block text-[11px] leading-4 text-paper/60">{formatWhen(note.updated_at)}</span>
                  )}
                </button>
              </li>
            )
          })}
          {!loading && notes.length === 0 && !setupNeeded ? (
            <li className="px-3 py-6 text-sm text-paper/70">No notes yet.</li>
          ) : null}
          {!loading && notes.length > 0 && visibleNotes.length === 0 ? (
            <li className="px-3 py-6 text-sm text-paper/70">No notes contain that word.</li>
          ) : null}
        </ul>
        <div className="border-t border-white/10 px-5 py-4">
          <p className="truncate text-sm text-paper/75">{email}</p>
          <button
            type="button"
            onClick={() => {
              void persist().then(() => onSignOut())
            }}
            disabled={signingOut}
            className="mt-3 cursor-pointer text-sm font-semibold text-paper transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta disabled:cursor-wait"
          >
            {signingOut ? 'Signing out' : 'Sign out'}
          </button>
        </div>
      </aside>

      <main className={`relative ${showList || showFolders ? 'hidden' : 'block'} min-h-dvh lg:block`}>
        {selectedId && !activeFile ? (
          <div className="pointer-events-none absolute inset-y-0 right-3 z-10 hidden w-[6.25rem] lg:block">
            <div className="pointer-events-auto sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
              <StackMap pages={pages} activeId={activeMapId ?? pages[0]?.id} stackNeedle={stackNeedle} onJump={jumpToPage} />
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:hidden">
          <button type="button" onClick={() => setPanel('list')} className="cursor-pointer text-sm font-semibold text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta">
            Notes
          </button>
          <button type="button" onClick={() => setPanel('folders')} className="cursor-pointer text-sm font-semibold text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta">
            Folders
          </button>
        </div>

        {loading ? <p className="px-8 pt-16 font-display text-3xl font-semibold">Opening your notes…</p> : null}

        {!loading && setupNeeded ? (
          <div className="mx-auto max-w-xl px-6 pt-16">
            <h2 className="font-display text-4xl font-semibold tracking-tight">One script, then the desk is ready.</h2>
            <p className="mt-4 text-base leading-relaxed text-slate-ink">
              Paste <span className="font-semibold text-ink">supabase/schema.sql</span> into the SQL editor and run it. If you already ran an older copy, run this one again so folders are added.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={sqlEditorUrl()} target="_blank" rel="noreferrer" className="cursor-pointer bg-navy px-4 py-3 font-display text-sm font-medium text-white transition-colors duration-200 hover:bg-slate-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta focus-visible:ring-offset-2">
                Open the SQL editor
              </a>
              <button type="button" onClick={() => void reload()} className="cursor-pointer border border-line bg-white px-4 py-3 font-display text-sm font-medium transition-colors duration-200 hover:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta">
                Try again
              </button>
            </div>
          </div>
        ) : null}

        {!loading && !setupNeeded && !selectedId ? (
          <div className="px-8 pt-24">
            <h2 className="max-w-md font-display text-5xl leading-none font-semibold tracking-tight">The page is blank.</h2>
            <p className="mt-5 max-w-sm text-lg text-slate-ink">Start a note. The writing stays on your account.</p>
          </div>
        ) : null}

        {!loading && !setupNeeded && selectedId ? (
          <div className={`w-full px-5 py-5 sm:px-8 sm:py-8 ${selectedId && !activeFile ? 'lg:pr-36' : ''}`}>
            <div className="mb-3 flex items-start justify-between gap-4">
              <label className="block min-w-0 flex-1" htmlFor="note-title">
                <span className="sr-only">Title</span>
                <input
                  id="note-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full bg-transparent font-display text-3xl font-semibold tracking-tight text-ink outline-none focus-visible:ring-2 focus-visible:ring-cta sm:text-4xl"
                />
              </label>
              <p
                className={`mt-2 rounded-md px-2.5 py-1 text-xs font-semibold ${saveState === 'saving' ? 'bg-[#e0f2fe] text-[#0369A1]' : saveState === 'error' ? 'bg-[#ffe4e6] text-[#9f1239]' : 'bg-[#dcfce7] text-[#166534]'}`}
                aria-live="polite"
              >
                {saveLabel}
              </p>
            </div>

            {activeFile ? (
            <div className="overflow-hidden rounded-xl border border-line bg-white shadow-[0_10px_36px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
                <button type="button" onClick={showNoteText} className="cursor-pointer text-sm font-semibold text-cta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta">
                  Back to the note
                </button>
                <p className="truncate font-mono text-sm">{activeFile.name}</p>
                <button type="button" onClick={() => void removeFile(activeFile)} className="cursor-pointer rounded-md bg-[#ffe4e6] px-2.5 py-1 text-sm font-semibold text-[#9f1239] transition-colors duration-200 hover:bg-[#fecdd3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta">
                  Remove
                </button>
              </div>
              <NoteEditor value={fileText} onChange={setFileText} filename={activeFile.name} label={`Editing ${activeFile.name}`} height="68vh" />
            </div>
              ) : (
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={addPage}
                  className="cursor-pointer rounded-md bg-navy px-3 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta"
                >
                  Add note
                </button>
                <label className="min-w-48 flex-1">
                  <span className="sr-only">Search words in every note</span>
                  <input
                    value={stackSearch}
                    onChange={(event) => setStackSearch(event.target.value)}
                    placeholder="Search the notes"
                    className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-[#475569] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta"
                  />
                </label>
                <p className="text-xs text-slate-ink">
                  {stackNeedle
                    ? `${pages.filter((page) => plainHtml(page.html).toLowerCase().includes(stackNeedle)).length + otherStackHits.length} found`
                    : pages.length === 1 ? '1 note' : `${pages.length} notes`}
                </p>
              </div>
              <StackMap layout="row" pages={pages} activeId={activeMapId ?? pages[0]?.id} stackNeedle={stackNeedle} onJump={jumpToPage} />
              <div className="flex flex-col gap-3">
                {pages.map((page, index) => {
                  const text = plainHtml(page.html).toLowerCase()
                  const stackHit = Boolean(stackNeedle) && text.includes(stackNeedle)
                  const listHit = Boolean(needle) && text.includes(needle)
                  if (stackNeedle && !stackHit) return null
                  const hit = stackHit || listHit
                  return (
                    <article
                      key={page.id}
                      id={`note-page-${page.id}`}
                      onDragOver={(event) => {
                        if (!pageDragRef.current) return
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                        setPageDropId(page.id)
                      }}
                      onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setPageDropId((current) => (current === page.id ? null : current))
                      }}
                      onDrop={(event) => dropPage(page.id, event)}
                      className={`overflow-hidden rounded-xl border bg-white shadow-[0_8px_28px_rgba(15,23,42,0.04)] ${pageDropId === page.id ? 'border-cta' : hit ? 'border-cta' : 'border-line'}`}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-line px-2 py-1">
                        <div
                          draggable
                          onDragStart={(event) => {
                            pageDragRef.current = page.id
                            event.dataTransfer.setData('application/x-northline-page', page.id)
                            event.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragEnd={() => {
                            pageDragRef.current = null
                            setPageDropId(null)
                          }}
                          className="cursor-grab px-1 text-xs font-semibold text-slate-ink active:cursor-grabbing"
                        >
                          Note {index + 1}
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" aria-label={`Move note ${index + 1} up`} disabled={index === 0} onClick={() => movePage(page.id, -1)} className="grid size-7 cursor-pointer place-items-center rounded-md bg-[#f1f5f9] text-[#334155] transition-colors duration-200 hover:bg-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta disabled:cursor-not-allowed disabled:opacity-40">
                            <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 10 8 6l4 4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                          <button type="button" aria-label={`Move note ${index + 1} down`} disabled={index === pages.length - 1} onClick={() => movePage(page.id, 1)} className="grid size-7 cursor-pointer place-items-center rounded-md bg-[#f1f5f9] text-[#334155] transition-colors duration-200 hover:bg-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta disabled:cursor-not-allowed disabled:opacity-40">
                            <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 6 8 10l4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                          <button type="button" aria-label={`Remove note ${index + 1}`} onClick={() => removePage(page.id)} className="grid size-7 cursor-pointer place-items-center rounded-md bg-[#ffe4e6] text-[#9f1239] transition-colors duration-200 hover:bg-[#fecdd3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta">
                            <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" /></svg>
                          </button>
                        </div>
                      </div>
                      <DocEditor
                        key={page.id}
                        label={`Note ${index + 1}`}
                        initialHtml={page.html}
                        autoFocus={page.id === focusPageId}
                        onChange={(html) => changePage(page.id, html)}
                      />
                    </article>
                  )
                })}
              </div>
              {stackNeedle && pages.every((page) => !plainHtml(page.html).toLowerCase().includes(stackNeedle)) ? (
                <p className="mt-3 text-sm text-slate-ink">No note in this stack has that word.</p>
              ) : null}
              {otherStackHits.length ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-ink">In other notes</p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {otherStackHits.map((hit) => (
                      <li key={hit.key}>
                        <button
                          type="button"
                          onClick={() => void openNote(hit.noteId)}
                          className="w-full cursor-pointer rounded-lg border border-line bg-white px-3 py-2 text-left transition-colors duration-200 hover:border-cta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta"
                        >
                          <span className="block text-sm font-semibold text-ink">{hit.title}</span>
                          <span className="mt-0.5 block text-xs text-slate-ink">{hit.label}{hit.excerpt ? ` · ${hit.excerpt}` : ''}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
              )}

            {message ? <p className="mt-4 text-sm text-alert" role="alert">{message}</p> : null}

            {confirmDelete ? (
              <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3">
                <p className="text-sm text-[#9f1239]">Delete this note, its folders, and its files?</p>
                <button type="button" onClick={() => void removeNote()} disabled={working} className="cursor-pointer rounded-md bg-[#9f1239] px-3 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#881337] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy disabled:cursor-wait">
                  Delete
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="cursor-pointer rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-ink transition-colors duration-200 hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta">
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="mt-6 cursor-pointer rounded-md bg-[#ffe4e6] px-3 py-2 text-sm font-semibold text-[#9f1239] transition-colors duration-200 hover:bg-[#fecdd3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta">
                Delete note
              </button>
            )}
          </div>
        ) : null}
      </main>

      <aside className={`${showFolders ? 'block' : 'hidden'} border-l border-line bg-white lg:sticky lg:top-0 lg:z-20 lg:block lg:h-dvh lg:max-h-dvh lg:self-start lg:overflow-hidden`}>
        <button type="button" onClick={() => setPanel('note')} className="w-full cursor-pointer border-b border-line px-4 py-3 text-left text-sm font-semibold text-navy lg:hidden">
          Back to the note
        </button>
        {selectedId ? (
          <FolderPane
            folders={folders}
            files={files}
            openFolders={openFolders}
            selectedFolderId={selectedFolderId}
            activeFileId={activeFileId}
            activeFileText={fileText}
            working={working}
            onSelectFolder={chooseFolder}
            onOpenFile={showFile}
            onCreateFolder={(parentId, name) => void addFolder(parentId, name)}
            onRenameFolder={(id, name) => void renameSelectedFolder(id, name)}
            onDeleteFolder={(id) => void removeFolder(id)}
            onAddFiles={(folderId) => {
              uploadTargetRef.current = folderId
              fileInputRef.current?.click()
            }}
            onUploadFiles={(chosen, folderId) => void uploadInto(chosen, folderId)}
            onDeleteFile={(file) => void removeFile(file)}
            onMoveFile={(file, folderId) => void putFileInFolder(file, folderId)}
            onSaveFile={(file) => void saveFileToComputer(file)}
          />
        ) : (
          <div className="px-5 py-8">
            <h2 className="font-display text-lg font-semibold">Folders</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-ink">Open a note to keep folders and files with it.</p>
          </div>
        )}
        <input ref={fileInputRef} type="file" multiple className="sr-only" onChange={(event) => void onUpload(event)} />
      </aside>
    </div>
  )
}

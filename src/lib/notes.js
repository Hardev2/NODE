import { supabase } from './supabase'

const TEXT_EXTENSIONS = new Set([
  'php', 'phtml', 'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx',
  'py', 'rb', 'go', 'rs', 'java', 'c', 'h', 'cpp', 'cs',
  'sql', 'css', 'scss', 'html', 'htm', 'json', 'md', 'txt',
  'sh', 'bash', 'yml', 'yaml', 'xml', 'ini', 'toml', 'vue',
  'svelte', 'env', 'twig',
])

const noteColumns = 'id, title, body, updated_at, created_at'
const fileColumns = 'id, note_id, folder_id, name, content, updated_at'
const folderColumns = 'id, note_id, parent_id, name, updated_at'

export function sqlEditorUrl() {
  const raw = import.meta.env.VITE_SUPABASE_URL
  if (!raw) return 'https://supabase.com/dashboard'
  try {
    const ref = new URL(raw).hostname.split('.')[0]
    return `https://supabase.com/dashboard/project/${ref}/sql/new`
  } catch {
    return 'https://supabase.com/dashboard'
  }
}

export function isSetupError(error) {
  const message = error?.message ?? ''
  const missingTable = error?.code === '42P01' || error?.code === 'PGRST205'
  const missingRelation = /could not find the table|relation ["']?(public\.)?(notes|note_files|note_folders)["']? does not exist/i.test(message)
  return missingTable || missingRelation
}

export function extensionOf(name) {
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? parts.at(-1) : ''
}

export function fileKindError(file) {
  const ext = extensionOf(file.name)
  const textType = file.type.startsWith('text/') || file.type === 'application/json' || file.type === 'application/javascript'
  if (!TEXT_EXTENSIONS.has(ext) && !textType) {
    return 'This desk keeps text files, such as .php, .js, .py, and .sql.'
  }
  if (file.size > 1_000_000) return 'Keep each file under 1 MB.'
  return ''
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read that file.'))
    reader.readAsText(file)
  })
}

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function documentHtml(body) {
  const value = body ?? ''
  const trimmed = value.trim()
  if (!trimmed) return '<p></p>'
  if (trimmed.startsWith('<')) return value
  return trimmed
    .split('\n')
    .map((line) => `<p>${line ? escapeHtml(line) : '<br>'}</p>`)
    .join('')
}

export function parseNotePages(body) {
  const value = (body ?? '').trim()
  if (value.startsWith('[')) {
    try {
      const data = JSON.parse(value)
      const pages = Array.isArray(data) ? data : null
      if (pages && pages.every((item) => item && typeof item.id === 'string' && typeof item.html === 'string')) {
        return pages.map((item) => ({ id: item.id, html: documentHtml(item.html) }))
      }
    } catch {
      // Older notes keep one HTML document in this column.
    }
  }
  return [{ id: crypto.randomUUID(), html: documentHtml(value) }]
}

export function serializeNotePages(pages) {
  return JSON.stringify(pages.map((page) => ({ id: page.id, html: page.html })))
}

export function notePlainText(body) {
  return parseNotePages(body)
    .map((page) => page.html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' '))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function listNotes() {
  const { data, error } = await supabase
    .from('notes')
    .select(noteColumns)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createNote(userId) {
  const { data, error } = await supabase
    .from('notes')
    .insert({ user_id: userId, title: 'Untitled', body: '' })
    .select('id, title, body, updated_at, created_at')
    .single()
  if (error) throw error
  return data
}

export async function getNote(id) {
  const { data, error } = await supabase
    .from('notes')
    .select('id, title, body, updated_at, created_at')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function saveNote(id, { title, body }) {
  const { error } = await supabase
    .from('notes')
    .update({ title, body })
    .eq('id', id)
  if (error) throw error
}

export async function deleteNote(id) {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}

export async function listFiles(noteId) {
  const { data, error } = await supabase
    .from('note_files')
    .select(fileColumns)
    .eq('note_id', noteId)
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function listFolders(noteId) {
  const { data, error } = await supabase
    .from('note_folders')
    .select(folderColumns)
    .eq('note_id', noteId)
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createFolder(userId, noteId, name, parentId) {
  const { data, error } = await supabase
    .from('note_folders')
    .insert({ user_id: userId, note_id: noteId, name, parent_id: parentId })
    .select(folderColumns)
    .single()
  if (error) throw error
  return data
}

export async function renameFolder(id, name) {
  const { error } = await supabase.from('note_folders').update({ name }).eq('id', id)
  if (error) throw error
}

export async function deleteFolder(id) {
  const { error } = await supabase.from('note_folders').delete().eq('id', id)
  if (error) throw error
}

export async function createFile(userId, noteId, folderId, name, content) {
  const { data, error } = await supabase
    .from('note_files')
    .insert({ user_id: userId, note_id: noteId, folder_id: folderId, name, content })
    .select(fileColumns)
    .single()
  if (error) throw error
  return data
}

export async function saveFile(id, content) {
  const { error } = await supabase.from('note_files').update({ content }).eq('id', id)
  if (error) throw error
}

export async function moveFile(id, folderId) {
  const { error } = await supabase.from('note_files').update({ folder_id: folderId }).eq('id', id)
  if (error) throw error
}

export async function deleteNoteFile(id) {
  const { error } = await supabase.from('note_files').delete().eq('id', id)
  if (error) throw error
}

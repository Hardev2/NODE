export function safeFileName(name) {
  const clean = String(name ?? '').replace(/[\\/:*?"<>|\r\n]/g, '_').trim()
  return clean || 'file.txt'
}

export function downloadTextFile(name, content) {
  const blob = new Blob([content ?? ''], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = safeFileName(name)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export async function writeTextToFolder(folderHandle, name, content) {
  const handle = await folderHandle.getFileHandle(safeFileName(name), { create: true })
  const writable = await handle.createWritable()
  await writable.write(content ?? '')
  await writable.close()
}

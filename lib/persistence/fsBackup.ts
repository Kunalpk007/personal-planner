// Optional folder-based JSON auto-export via the File System Access API (Chrome/Edge).
// The directory handle is kept in IndexedDB so it can be re-used within a browser
// profile; browsers re-prompt for permission each session for security.
//
// Minimal local types — the File System Access API isn't in every TS lib.dom version.
interface FSWritable {
  write:  (data: string) => Promise<void>
  close:  () => Promise<void>
}
interface FSFileHandle {
  createWritable: () => Promise<FSWritable>
}
interface FSDirHandle {
  name: string
  queryPermission:   (o: { mode: string }) => Promise<string>
  requestPermission: (o: { mode: string }) => Promise<string>
  getFileHandle:     (name: string, o?: { create?: boolean }) => Promise<FSFileHandle>
}
type WindowWithFS = Window & {
  showDirectoryPicker?: (o: { mode: string }) => Promise<FSDirHandle>
}

const DB_NAME  = 'planner_fs'
const STORE    = 'handles'
const DIR_KEY  = 'backupDir'

function isSupported(): boolean {
  return typeof window !== 'undefined' && !!(window as WindowWithFS).showDirectoryPicker && 'indexedDB' in window
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

async function getHandle(): Promise<FSDirHandle | null> {
  if (!isSupported()) return null
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(DIR_KEY)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror   = () => reject(req.error)
    })
  } catch {
    return null
  }
}

async function setHandle(handle: FSDirHandle): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(handle, DIR_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

/** Prompts the user to pick a folder for auto-export. Returns its name, or null if unsupported/cancelled. */
export async function pickBackupFolder(): Promise<string | null> {
  const picker = (window as WindowWithFS).showDirectoryPicker
  if (!picker) return null
  try {
    const handle = await picker({ mode: 'readwrite' })
    await setHandle(handle)
    return handle.name
  } catch {
    return null
  }
}

/** Returns the configured folder name, or null if none is set / unsupported. */
export async function getBackupFolderName(): Promise<string | null> {
  const handle = await getHandle()
  return handle?.name ?? null
}

export function fsBackupSupported(): boolean {
  return isSupported()
}

/** Writes a dated JSON snapshot into the configured folder. No-ops if unsupported/unset/denied. */
export async function writeBackupFile(state: unknown): Promise<boolean> {
  const handle = await getHandle()
  if (!handle) return false
  try {
    let perm = await handle.queryPermission({ mode: 'readwrite' })
    if (perm !== 'granted') perm = await handle.requestPermission({ mode: 'readwrite' })
    if (perm !== 'granted') return false

    const now   = new Date()
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const fileHandle = await handle.getFileHandle(`planner_backup_${stamp}.json`, { create: true })
    const writable   = await fileHandle.createWritable()
    await writable.write(JSON.stringify(state, null, 2))
    await writable.close()
    return true
  } catch {
    return false
  }
}

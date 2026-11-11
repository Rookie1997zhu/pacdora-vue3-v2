import type { DesignDocumentV1 } from '../../packages/design-schema/designDocument'

const DB_NAME = 'boxcraft-studio-drafts'
const STORE = 'drafts'
const DB_VERSION = 1

export type DesignDraft = {
  designId: string
  rowVersion: number
  document: DesignDocumentV1
  updatedAt: string
  dirty: boolean
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'designId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('idb_open_failed'))
  })
}

export async function saveDraft(draft: DesignDraft): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(draft)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('idb_put_failed'))
  })
  db.close()
}

export async function loadDraft(designId: string): Promise<DesignDraft | null> {
  const db = await openDb()
  const draft = await new Promise<DesignDraft | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(designId)
    req.onsuccess = () => resolve((req.result as DesignDraft) || null)
    req.onerror = () => reject(req.error || new Error('idb_get_failed'))
  })
  db.close()
  return draft
}

export async function clearDraft(designId: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(designId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('idb_delete_failed'))
  })
  db.close()
}

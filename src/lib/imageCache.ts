// IndexedDB blob cache for memory photos. Service workers don't run in the
// Capacitor WKWebView (Apple restricts them to entitled browsers), and its
// HTTP cache is small and aggressively evicted — so offline images have to
// be cached at the app level. Photos are immutable (uuid filenames), so
// entries never need revalidation; an LRU cap keeps the store bounded.

const DB_NAME = 'memora-image-cache'
const STORE = 'images'
const MAX_ENTRIES = 600 // mostly ~12KB thumbs + some full images ≈ tens of MB

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null)
  if (!dbPromise) {
    dbPromise = new Promise(resolve => {
      try {
        const req = indexedDB.open(DB_NAME, 1)
        req.onupgradeneeded = () => {
          const store = req.result.createObjectStore(STORE, { keyPath: 'path' })
          store.createIndex('lastUsed', 'lastUsed')
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
        req.onblocked = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }
  return dbPromise
}

// Rows store raw bytes + mime, NOT Blob objects — WebKit has a history of
// corrupting Blobs persisted in IndexedDB (they resurface as broken images
// until an app restart). ArrayBuffers round-trip reliably; the Blob is
// rebuilt on read. Legacy Blob rows are still readable.
interface StoredImage { path: string; buf?: ArrayBuffer; type?: string; blob?: Blob; lastUsed: number }

export async function getBlob(path: string): Promise<Blob | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise(resolve => {
    try {
      // Read with a READONLY transaction — the LRU touch used to run in
      // the same readwrite txn, and IndexedDB serialises writers, so a
      // screenful of images queued behind each other on load.
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(path)
      req.onsuccess = () => {
        const row = req.result as StoredImage | undefined
        if (!row) return resolve(null)
        resolve(row.buf ? new Blob([row.buf], { type: row.type || 'image/jpeg' }) : row.blob ?? null)
        // Fire-and-forget LRU touch in its own transaction, off the read path
        try {
          db.transaction(STORE, 'readwrite').objectStore(STORE).put({ ...row, lastUsed: Date.now() })
        } catch { /* touch is best-effort */ }
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function putBlob(path: string, blob: Blob): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    const buf = await blob.arrayBuffer()
    db.transaction(STORE, 'readwrite').objectStore(STORE).put({ path, buf, type: blob.type, lastUsed: Date.now() })
  } catch {
    return // quota exceeded — cache is best-effort
  }
  void evictIfNeeded(db)
}

export async function removeBlob(path: string): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(path)
  } catch { /* best-effort */ }
}

// Trim least-recently-used entries once over the cap. Uses the lastUsed
// index with a key cursor so blobs are never materialized during eviction.
async function evictIfNeeded(db: IDBDatabase) {
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const countReq = store.count()
    countReq.onsuccess = () => {
      let toDelete = countReq.result - MAX_ENTRIES
      if (toDelete <= 0) return
      const cursorReq = store.index('lastUsed').openKeyCursor()
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (!cursor || toDelete <= 0) return
        store.delete(cursor.primaryKey)
        toDelete--
        cursor.continue()
      }
    }
  } catch { /* best-effort */ }
}

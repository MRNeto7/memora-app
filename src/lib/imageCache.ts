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

export async function getBlob(path: string): Promise<Blob | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const req = store.get(path)
      req.onsuccess = () => {
        const row = req.result as { path: string; blob: Blob; lastUsed: number } | undefined
        if (!row) return resolve(null)
        store.put({ ...row, lastUsed: Date.now() }) // touch for LRU
        resolve(row.blob)
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
    db.transaction(STORE, 'readwrite').objectStore(STORE).put({ path, blob, lastUsed: Date.now() })
  } catch {
    return // quota exceeded — cache is best-effort
  }
  void evictIfNeeded(db)
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

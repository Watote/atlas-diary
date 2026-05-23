import { openDB } from 'idb'

// Opens (or creates) the database. Version 1 = first schema.
// If we ever need to change the schema, we bump the version and add a migration.
const DB_NAME = 'atlas-diary'
const DB_VERSION = 1
const PHOTOS_STORE = 'photos'

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 'photos' object store: key = entryId + '-' + index (e.g. "1716000000000-0")
      // We don't use autoIncrement because we want deterministic keys tied to entry IDs
      if (!db.objectStoreNames.contains(PHOTOS_STORE)) {
        db.createObjectStore(PHOTOS_STORE)
      }
    },
  })
}

// Store a list of File objects for a given entry ID.
// Each photo gets a key like "entryId-0", "entryId-1", etc.
export async function savePhotos(entryId, files) {
  const db = await getDB()
  const tx = db.transaction(PHOTOS_STORE, 'readwrite')
  await Promise.all(
    files.map((file, i) => tx.store.put(file, `${entryId}-${i}`))
  )
  await tx.done
}

// Retrieve all photos for a given entry as object URLs (usable in <img src>).
// Returns an array of { url, name } objects.
export async function getPhotos(entryId, count) {
  const db = await getDB()
  const urls = []
  for (let i = 0; i < count; i++) {
    const blob = await db.get(PHOTOS_STORE, `${entryId}-${i}`)
    if (blob) {
      urls.push({
        url: URL.createObjectURL(blob),
        name: blob.name || `photo-${i}`,
      })
    }
  }
  return urls
}

// Delete all photos for a given entry.
export async function deletePhotos(entryId, count) {
  const db = await getDB()
  const tx = db.transaction(PHOTOS_STORE, 'readwrite')
  await Promise.all(
    Array.from({ length: count }, (_, i) =>
      tx.store.delete(`${entryId}-${i}`)
    )
  )
  await tx.done
}

// Delete ALL photos (used when clearing all entries).
export async function clearAllPhotos() {
  const db = await getDB()
  await db.clear(PHOTOS_STORE)
}

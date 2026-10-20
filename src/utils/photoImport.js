// Read GPS + date from photos (EXIF) and group them into memories.
import exifr from 'exifr'
import { distanceKm } from './flyCamera.js'
import { MAX_PHOTOS } from '../constants/limits.js'

const SAME_PLACE_KM = 1.5   // photos closer than this on the same day become one memory

// HEIC can't be shown by most browsers, so it is skipped (export as JPEG, or iPhone converts on upload)
const isHeic = (f) => /hei[cf]/i.test(f.type || '') || /\.hei[cf]$/i.test(f.name || '')
const isImage = (f) => f && !isHeic(f) && (f.type?.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(f.name || ''))
const ymd = (d) => {
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

// → { file, lat, lng, date (YYYY-MM-DD) | null, time (ms) | null }
export async function readPhotoMeta(file, fallbackDate = null) {
  let lat = null, lng = null, when = null
  try {
    const gps = await exifr.gps(file)
    if (gps && isFinite(gps.latitude) && isFinite(gps.longitude) && !(gps.latitude === 0 && gps.longitude === 0)) {
      lat = gps.latitude; lng = gps.longitude
    }
  } catch { /* no GPS */ }
  try {
    const t = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate', 'DateTime'])
    when = t?.DateTimeOriginal || t?.CreateDate || t?.DateTime || null
  } catch { /* no date */ }
  if (!(when instanceof Date) || isNaN(when)) when = fallbackDate ? new Date(fallbackDate) : null
  return { file, lat, lng, date: when ? ymd(when) : null, time: when ? when.getTime() : null }
}

// Big phone photos are scaled down (long side 2560px) so uploads stay quick; small ones are kept as is.
export async function shrinkPhoto(file, maxSide = 2560, minBytes = 1_500_000) {
  if (file.size < minBytes || !/jpe?g|png|webp/i.test(file.type || file.name)) return file
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close?.()
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified })
  } catch { return file }
}

// files → { groups: [{ lat, lng, date, photos: [File] }], noGps: [{ file, date }], skipped }
export async function importPhotos(files, { fallbackDates = new Map(), onProgress } = {}) {
  const all = Array.from(files)
  const list = all.filter(isImage)
  let done = 0
  const metas = await Promise.all(list.map(async f => {
    const m = await readPhotoMeta(f, fallbackDates.get(f) || null)
    m.file = await shrinkPhoto(f)
    onProgress?.(++done, list.length)
    return m
  }))
  metas.sort((a, b) => (a.time ?? 0) - (b.time ?? 0))

  const groups = []
  const noGps = []
  for (const m of metas) {
    if (m.lat == null) { noGps.push({ file: m.file, date: m.date }); continue }
    const g = groups.find(g => g.date === m.date && g.photos.length < MAX_PHOTOS && distanceKm(g, m) <= SAME_PLACE_KM)
    if (g) {
      g.photos.push(m.file)
      // keep the group centred on its photos
      const n = g.photos.length
      g.lat = g.lat + (m.lat - g.lat) / n
      g.lng = g.lng + (m.lng - g.lng) / n
    } else {
      groups.push({ lat: m.lat, lng: m.lng, date: m.date, photos: [m.file] })
    }
  }
  return { groups, noGps, skipped: all.length - list.length }
}

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

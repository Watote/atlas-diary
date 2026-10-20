// State for "add memories from photos": GPS photos become a queue of ready-made memories,
// photos without a location wait in a tray until the user taps the map or searches a place.
import { useState, useRef, useCallback, useEffect } from 'react'
import { importPhotos } from '../utils/photoImport.js'
import { startPicking, openPicker, finishPicking } from '../utils/googlePhotos.js'
import { MAX_PHOTOS } from '../constants/limits.js'

let trayId = 0
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`

// Select the photos of the earliest day (up to MAX_PHOTOS) when nothing is selected yet
function withDefaultSelection(list) {
  if (!list.length || list.some(t => t.selected)) return list
  const day = list.map(t => t.date || '9999').sort()[0]
  let n = 0
  return list.map(t => ((t.date || '9999') === day && n++ < MAX_PHOTOS ? { ...t, selected: true } : t))
}

export function usePhotoImport() {
  const [queue, setQueue] = useState([])       // [{ lat, lng, date, photos }]
  const [queueTotal, setQueueTotal] = useState(0)
  const [tray, setTray] = useState([])         // [{ id, file, date, url, selected }]
  const [status, setStatus] = useState(null)   // { text, busy?, error?, cancel?, action?: { label, run } }
  const [dragging, setDragging] = useState(false)
  const cancelRef = useRef(false)
  const dragDepth = useRef(0)
  const hideTimer = useRef(null)

  const flash = useCallback((s, ms = 6000) => {
    clearTimeout(hideTimer.current)
    setStatus(s)
    if (s && ms) hideTimer.current = setTimeout(() => setStatus(null), ms)
  }, [])

  const addFiles = useCallback(async (files, fallbackDates) => {
    const list = Array.from(files || [])
    if (!list.length) return
    clearTimeout(hideTimer.current)
    setStatus({ text: 'reading photos…', busy: true })
    try {
      const { groups, noGps, skipped } = await importPhotos(list, {
        fallbackDates,
        onProgress: (d, n) => setStatus({ text: `reading photos… ${d}/${n}`, busy: true }),
      })
      if (noGps.length) {
        setTray(prev => withDefaultSelection([
          ...prev,
          ...noGps.map(p => ({ id: ++trayId, file: p.file, date: p.date, url: URL.createObjectURL(p.file), selected: false })),
        ]))
      }
      if (groups.length) {
        setQueue(prev => [...prev, ...groups])
        setQueueTotal(t => t + groups.length)
      }
      const bits = []
      if (groups.length) bits.push(`${plural(groups.length, 'place')} found from photo locations`)
      if (noGps.length) bits.push(`${plural(noGps.length, 'photo')} need a place`)
      if (skipped) bits.push(`${skipped} skipped (HEIC/other — export as JPEG)`)
      if (!bits.length) bits.push('no photos found in that drop')
      flash({ text: bits.join(' · '), error: !groups.length && !noGps.length })
    } catch (e) {
      flash({ text: `couldn't read those photos (${e.message})`, error: true })
    }
  }, [flash])

  // ── queue ──
  const queueHead = queue[0] || null
  const queuePos = queueTotal - queue.length + 1
  const popQueue = useCallback(() => {
    setQueue(prev => {
      const next = prev.slice(1)
      if (!next.length) setQueueTotal(0)
      return next
    })
  }, [])
  const clearQueue = useCallback(() => { setQueue([]); setQueueTotal(0) }, [])

  // ── tray ──
  const traySelected = tray.filter(t => t.selected)
  const toggleTray = useCallback((id) => {
    setTray(prev => {
      const sel = prev.filter(t => t.selected).length
      return prev.map(t => (t.id === id ? { ...t, selected: !t.selected && sel >= MAX_PHOTOS ? false : !t.selected } : t))
    })
  }, [])
  const removeTray = useCallback((ids) => {
    setTray(prev => {
      prev.filter(t => ids.includes(t.id)).forEach(t => URL.revokeObjectURL(t.url))
      return withDefaultSelection(prev.filter(t => !ids.includes(t.id)))
    })
  }, [])
  const clearTray = useCallback(() => {
    setTray(prev => { prev.forEach(t => URL.revokeObjectURL(t.url)); return [] })
  }, [])

  // ── Google Photos (two clicks may be needed: sign-in pop-up, then the picker window) ──
  const runGoogle = useCallback(async (ctx, win) => {
    cancelRef.current = false
    let closedAt = 0
    setStatus({ text: 'pick photos in the Google Photos window…', busy: true, cancel: true })
    try {
      const { files, dates } = await finishPicking(ctx, {
        onStatus: (t) => setStatus({ text: t, busy: true, cancel: true }),
        isCancelled: () => {
          if (cancelRef.current) return true
          // window closed without picking anything → give Google a few seconds, then stop waiting
          if (win?.closed) { closedAt ||= Date.now(); return Date.now() - closedAt > 9000 }
          return false
        },
      })
      if (!files.length) return flash({ text: 'no photos were picked' })
      await addFiles(files, dates)
    } catch (e) {
      if (e.message === 'cancelled') return setStatus(null)
      flash({ text: e.message, error: true }, 9000)
    }
  }, [addFiles, flash])

  const pickGoogle = useCallback(async () => {
    clearTimeout(hideTimer.current)
    setStatus({ text: 'connecting to Google Photos…', busy: true })
    try {
      const ctx = await startPicking()
      const win = openPicker(ctx.session)
      if (win) return runGoogle(ctx, win)
      // the sign-in pop-up used up this click; ask for one more
      setStatus({
        text: 'signed in to Google Photos',
        action: { label: 'choose photos', run: () => runGoogle(ctx, openPicker(ctx.session)) },
      })
    } catch (e) {
      flash({ text: e.message || 'Google Photos is not available', error: true }, 9000)
    }
  }, [runGoogle, flash])

  const cancelStatus = useCallback(() => { cancelRef.current = true; setStatus(null) }, [])

  // ── drag & drop onto the map ──
  const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files')
  const dropHandlers = {
    onDragEnter: (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth.current++; setDragging(true) },
    onDragOver: (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy' },
    onDragLeave: (e) => { if (!hasFiles(e)) return; if (--dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false) } },
    onDrop: (e) => {
      if (!hasFiles(e)) return
      e.preventDefault(); dragDepth.current = 0; setDragging(false)
      addFiles(e.dataTransfer.files)
    },
  }

  // a photo dropped anywhere else must not make the browser navigate away
  useEffect(() => {
    const stop = (e) => { if (Array.from(e.dataTransfer?.types || []).includes('Files')) e.preventDefault() }
    window.addEventListener('dragover', stop)
    window.addEventListener('drop', stop)
    return () => { window.removeEventListener('dragover', stop); window.removeEventListener('drop', stop) }
  }, [])

  return {
    addFiles, pickGoogle,
    queueHead, queuePos, queueTotal, popQueue, clearQueue,
    tray, traySelected, toggleTray, removeTray, clearTray,
    status, cancelStatus, dismissStatus: () => setStatus(null),
    dragging, dropHandlers,
  }
}

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import { getMoodFromEntry } from '../utils/moods.js'

const HOLD_MS = 3800       // how long each stop stays on screen
const FAR_KM = 300         // beyond this, zoom out before flying to the next stop

const wait = (ms) => new Promise(r => setTimeout(r, ms))

function distanceKm(a, b) {
  const g = window.google?.maps?.geometry?.spherical
  if (g) return g.computeDistanceBetween(a, b) / 1000
  // fallback: haversine
  const R = 6371, toRad = d => d * Math.PI / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Plays the memories in date order: flies the map stop to stop and shows a caption card.
export default function TripPlayer({ stops, mapRef, coverUrls, onProgress, onOpen, onClose, isMobile }) {
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const runRef = useRef(0)   // bumps on every jump so stale timers stop

  const flyTo = useCallback(async (entry, token) => {
    const map = mapRef.current
    if (!map) return
    // resolve when the map finishes moving (or after a timeout as a safety net)
    const idle = (ms = 1500) => new Promise(res => {
      const ev = window.google?.maps?.event
      if (!ev) return setTimeout(res, ms)
      const l = ev.addListenerOnce(map, 'idle', () => { clearTimeout(t); res() })
      const t = setTimeout(() => { l.remove(); res() }, ms)
    })
    const stale = () => runRef.current !== token
    const target = { lat: entry.lat, lng: entry.lng }
    const c = map.getCenter()
    const from = c ? { lat: c.lat(), lng: c.lng() } : target
    if (distanceKm(from, target) > FAR_KM) {
      // long hop: pull back, glide over, then dive in
      if ((map.getZoom() ?? 5) > 5) { map.setZoom(5); await idle(); if (stale()) return }
      await wait(150); if (stale()) return
      map.panTo(target); await idle(2200); if (stale()) return
      // panTo jumps instead of gliding when the hop is wider than the screen; make sure we're there
      map.setCenter(target); await wait(250); if (stale()) return
    } else {
      map.panTo(target); await idle(); if (stale()) return
    }
    map.setZoom(10)
    // the map's strict world bounds can clamp the centre at low zoom; re-centre once zoomed in
    await idle(); if (stale()) return
    map.panTo(target)
  }, [mapRef])

  // Move camera + report progress whenever the stop changes
  const stopId = stops[idx]?.id
  useEffect(() => {
    const entry = stops[idx]
    if (!entry) return
    const token = ++runRef.current
    onProgress?.(idx)
    flyTo(entry, token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, stopId])

  // Auto-advance while playing
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => {
      if (idx < stops.length - 1) setIdx(i => i + 1)
      else setPlaying(false)
    }, HOLD_MS + 1200)
    return () => clearTimeout(t)
  }, [idx, playing, stops.length])

  // Keyboard: space = pause, arrows = prev/next, Esc = stop
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return
      if (e.key === 'Escape') onClose()
      else if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p) }
      else if (e.key === 'ArrowRight') setIdx(i => Math.min(i + 1, stops.length - 1))
      else if (e.key === 'ArrowLeft') setIdx(i => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, stops.length])

  const entry = stops[idx]
  if (!entry) return null
  const mood = getMoodFromEntry(entry)
  const cover = coverUrls[entry.id]
  const dateStr = entry.date
    ? new Date(entry.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''
  const atEnd = idx === stops.length - 1 && !playing

  const btn = 'p-2 rounded-full text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors disabled:opacity-30'

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 z-[900] w-[min(440px,calc(100%-32px))]"
      style={{ bottom: isMobile ? 'calc(84px + max(env(safe-area-inset-bottom), 34px))' : 24 }}
    >
      {/* progress bar */}
      <div className="flex gap-1 mb-2 px-1">
        {stops.map((s, i) => (
          <button key={s.id} onClick={() => setIdx(i)} aria-label={`stop ${i + 1}`}
            className="flex-1 rounded-full transition-colors p-0 border-0 appearance-none"
            style={{ height: 4, minHeight: 0, background: i <= idx ? mood.color : 'rgba(53,47,40,0.18)' }} />
        ))}
      </div>

      <div className="bg-stone-50/95 backdrop-blur rounded-2xl border border-stone-200 shadow-xl overflow-hidden"
        style={{ animation: 'tripIn 0.35s ease' }} key={entry.id}>
        <div style={{ height: 4, background: mood.color }} />
        <div className="flex gap-3 p-3 cursor-pointer" onClick={() => { setPlaying(false); onOpen(entry.id) }}>
          {cover ? (
            <img src={cover} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl"
              style={{ background: mood.color + '22', color: mood.color }}>●</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] tracking-widest uppercase text-stone-400" style={{ fontFamily: 'DM Mono, monospace' }}>
              stop {idx + 1} of {stops.length} · {dateStr}
            </p>
            <h3 className="truncate text-stone-800" style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, lineHeight: 1.25 }}>
              {entry.englishName || entry.location}
            </h3>
            {entry.country && <p className="text-xs text-stone-400 truncate">{entry.country}</p>}
            {entry.note && (
              <p className="text-xs text-stone-600 mt-1 line-clamp-2" style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>
                “{entry.note}”
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="text-[10px] text-stone-400 pl-2" style={{ fontFamily: 'DM Mono, monospace' }}>tap card to open</span>
          <div className="flex items-center">
            <button className={btn} onClick={() => setIdx(i => Math.max(i - 1, 0))} disabled={idx === 0} aria-label="previous"><SkipBack size={15} /></button>
            <button className={btn} aria-label={playing ? 'pause' : 'play'}
              onClick={() => { if (atEnd) { setIdx(0); setPlaying(true) } else setPlaying(p => !p) }}>
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button className={btn} onClick={() => setIdx(i => Math.min(i + 1, stops.length - 1))} disabled={idx === stops.length - 1} aria-label="next"><SkipForward size={15} /></button>
            <button className={btn} onClick={onClose} aria-label="stop trip"><X size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react'
import { getMoodFromEntry } from '../utils/moods.js'
import { flyCamera, distanceKm, interpolate, headingDeg } from '../utils/flyCamera.js'

const HOLD_MS = 6500        // time at each stop (relaxed pace)
const STOP_ZOOM = 11
const STOP_TILT = 45        // vector maps only
const PLANE_KM = 500        // longer hops show a plane, shorter ones a glowing dot

// ── imperative map layers (kept out of React so per-frame updates stay smooth) ──
function createHeadOverlay(map) {
  const g = window.google.maps
  class Head extends g.OverlayView {
    constructor() { super(); this.pos = null; this.rot = 0; this.kind = 'dot'; this.div = null }
    onAdd() {
      this.div = document.createElement('div')
      this.div.style.position = 'absolute'
      this.div.style.pointerEvents = 'none'
      this.div.style.width = '30px'
      this.div.style.height = '30px'
      this.div.style.display = 'flex'
      this.div.style.alignItems = 'center'
      this.div.style.justifyContent = 'center'
      this.getPanes().floatPane.appendChild(this.div)
      this.render()
    }
    render() {
      if (!this.div) return
      this.div.innerHTML = this.kind === 'plane'
        ? `<svg width="30" height="30" viewBox="0 0 24 24" style="transform:rotate(${this.rot}deg);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))"><path fill="#352f28" stroke="#f5f0ea" stroke-width="0.8" d="M12 2c.7 0 1.2.6 1.2 1.3v6.1l7.8 4.6v2l-7.8-2.4v4.8l2.3 1.7V22L12 21l-3.5 1v-1.9l2.3-1.7v-4.8L3 15v-2l7.8-4.6V3.3C10.8 2.6 11.3 2 12 2z"/></svg>`
        : `<span class="trip-dot"></span>`
    }
    place(pos, rot, kind) {
      this.pos = pos; this.rot = rot
      if (kind !== this.kind) { this.kind = kind; this.render() }
      else if (kind === 'plane' && this.div?.firstChild) this.div.firstChild.style.transform = `rotate(${rot}deg)`
      if (this.div) this.div.style.display = pos ? 'flex' : 'none'
      this.draw()
    }
    draw() {
      if (!this.div || !this.pos) return
      const p = this.getProjection()?.fromLatLngToDivPixel(new g.LatLng(this.pos))
      if (!p) return
      this.div.style.left = `${p.x - 15}px`
      this.div.style.top = `${p.y - 15}px`
    }
    onRemove() { this.div?.remove(); this.div = null }
  }
  const h = new Head()
  h.setMap(map)
  return h
}

function createTrail(map) {
  const g = window.google.maps
  return new g.Polyline({
    map, geodesic: true, clickable: false, strokeOpacity: 0, zIndex: 5,
    icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: '#352f28', scale: 3 }, offset: '0', repeat: '11px' }],
  })
}

// ── Polaroid that drops onto the map at each stop ──
function Polaroid({ entry, photos, isMobile, tiltSide }) {
  const mood = getMoodFromEntry(entry)
  const [k, setK] = useState(0)
  const n = photos.length
  useEffect(() => {
    if (n < 2) return
    const per = Math.max(1800, (HOLD_MS - 600) / n)
    const t = setInterval(() => setK(i => (i + 1) % n), per)
    return () => clearInterval(t)
  }, [n])

  const W = isMobile ? 190 : 250
  const dateStr = entry.date
    ? new Date(entry.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''
  return (
    <div className="absolute left-1/2 top-1/2 z-[850] pointer-events-none"
      style={{ transform: `translate(-50%, calc(-100% - ${isMobile ? 46 : 58}px))` }}>
      <div className="relative bg-white shadow-2xl"
        style={{ width: W, padding: 10, paddingBottom: 38, borderRadius: 3, '--rot': `${tiltSide * 3}deg`, animation: 'polaroidIn 0.65s cubic-bezier(.2,1.35,.4,1) both', transformOrigin: 'bottom center' }}>
        <div className="relative overflow-hidden bg-stone-200" style={{ width: W - 20, height: Math.round((W - 20) * 0.82), perspective: 800 }}>
          {n > 0 ? (
            <img key={photos[k]} src={photos[k]} alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ animation: `${k > 0 ? 'flipIn 0.55s ease both, ' : ''}kenburns ${HOLD_MS + 1500}ms ease-out both`, transformOrigin: k % 2 ? '30% 40%' : '70% 60%' }} />
          ) : (
            // no photos: a postcard in the memory's colour
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
              style={{ background: `linear-gradient(135deg, ${mood.color}, ${mood.color}bb)`, color: '#fffaf2' }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: isMobile ? 20 : 26, lineHeight: 1.1 }}>{entry.englishName || entry.location}</div>
              {entry.note && <div className="mt-2 line-clamp-3" style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontSize: 12, opacity: 0.9 }}>“{entry.note}”</div>}
              {!entry.note && entry.country && <div className="mt-1 text-[10px] tracking-widest uppercase opacity-80" style={{ fontFamily: 'DM Mono, monospace' }}>{entry.country}</div>}
            </div>
          )}
          {n > 1 && (
            <span className="absolute bottom-1.5 right-1.5 text-[9px] text-white bg-black/45 rounded-full px-1.5 py-0.5" style={{ fontFamily: 'DM Mono, monospace' }}>{k + 1}/{n}</span>
          )}
        </div>
        <div className="absolute left-0 right-0 bottom-2 text-center px-2">
          <div className="truncate text-stone-700" style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontSize: isMobile ? 13 : 15, lineHeight: 1.2 }}>{entry.englishName || entry.location}</div>
          <div className="text-[9px] text-stone-400" style={{ fontFamily: 'DM Mono, monospace' }}>{dateStr}</div>
        </div>
        {/* tape */}
        <div className="absolute -top-2 left-1/2 w-14 h-4" style={{ background: mood.color + 'aa', transform: 'translateX(-50%) rotate(-4deg)' }} />
      </div>
    </div>
  )
}

// Plays the memories in date order: glides the camera stop to stop, a marker travels the route,
// and a polaroid of each memory drops in on arrival.
export default function TripPlayer({ stops, mapRef, coverUrls, getPhotoUrls, onProgress, onOpen, onClose, isMobile }) {
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [phase, setPhase] = useState('flying') // flying | arrived | done
  const [photos, setPhotos] = useState({})     // entryId → [urls]
  const [replayKey, setReplayKey] = useState(0)
  const runRef = useRef(0)
  const layers = useRef(null)
  const prevPos = useRef(null)
  const requested = useRef(new Set())

  // map layers: trail + travelling head
  useEffect(() => {
    const map = mapRef.current
    if (!map || !window.google?.maps) return
    layers.current = { trail: createTrail(map), head: createHeadOverlay(map) }
    return () => {
      layers.current?.trail.setMap(null)
      layers.current?.head.setMap(null)
      layers.current = null
    }
  }, [mapRef])

  // photo loading (current + next stop), preloaded so the polaroid appears instantly
  const loadPhotos = useCallback(async (entry) => {
    if (!entry || !entry.photoCount || requested.current.has(entry.id)) return
    requested.current.add(entry.id)
    const urls = await getPhotoUrls(entry.id, Math.min(entry.photoCount, 6))
    urls.forEach(u => { const im = new Image(); im.src = u })
    setPhotos(p => ({ ...p, [entry.id]: urls }))
  }, [getPhotoUrls])

  const stopId = stops[idx]?.id
  useEffect(() => {
    const entry = stops[idx]
    if (!entry) return
    const token = ++runRef.current
    const map = mapRef.current
    onProgress?.(idx)
    loadPhotos(entry); loadPhotos(stops[idx + 1])
    setPhase('flying')
    if (!map) return

    const done = stops.slice(0, idx).map(e => ({ lat: e.lat, lng: e.lng }))
    const target = { lat: entry.lat, lng: entry.lng }
    const c = map.getCenter()
    const from = prevPos.current || (c ? { lat: c.lat(), lng: c.lng() } : target)
    const km = distanceKm(from, target)
    const showLeg = idx > 0 && !!prevPos.current && km > 0.5
    const kind = km > PLANE_KM ? 'plane' : 'dot'
    const hdg = headingDeg(from, target)

    layers.current?.trail.setPath(done)
    if (!showLeg) layers.current?.head.place(null, 0, 'dot')

    flyCamera(map, target, {
      zoom: STOP_ZOOM, tilt: STOP_TILT,
      isCancelled: () => runRef.current !== token,
      onFrame: (f) => {
        if (!showLeg || !layers.current) return
        const pos = interpolate(from, target, f)
        layers.current.trail.setPath([...done, pos])
        layers.current.head.place(pos, hdg - (map.getHeading?.() ?? 0), kind)
      },
    }).then(ok => {
      if (!ok || runRef.current !== token) return
      prevPos.current = target
      layers.current?.trail.setPath([...done, target])
      layers.current?.head.place(null, 0, 'dot')
      setPhase('arrived')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, stopId, replayKey])

  // hold at each stop, then move on (or finish)
  useEffect(() => {
    if (phase !== 'arrived' || !playing) return
    const t = setTimeout(() => {
      if (idx < stops.length - 1) setIdx(i => i + 1)
      else setPhase('done')
    }, HOLD_MS)
    return () => clearTimeout(t)
  }, [phase, playing, idx, stops.length])

  // slow orbit while looking at a stop (only visible on vector maps)
  useEffect(() => {
    const map = mapRef.current
    if (phase !== 'arrived' || !playing || !map?.getHeading || !map.getTilt?.()) return
    let raf, last = performance.now()
    const spin = (now) => {
      map.moveCamera({ heading: (map.getHeading() ?? 0) + (now - last) * 0.004 })
      last = now; raf = requestAnimationFrame(spin)
    }
    raf = requestAnimationFrame(spin)
    return () => cancelAnimationFrame(raf)
  }, [phase, playing, mapRef])

  // finale: pull back to show the whole route
  useEffect(() => {
    if (phase !== 'done') return
    const map = mapRef.current
    if (!map || stops.length < 2) return
    const b = new window.google.maps.LatLngBounds()
    stops.forEach(s => b.extend(s))
    map.moveCamera({ tilt: 0, heading: 0 })
    map.fitBounds(b, isMobile ? 60 : 120)
  }, [phase, stops, mapRef, isMobile])

  const jump = (i) => {
    const j = Math.max(0, Math.min(i, stops.length - 1))
    prevPos.current = null
    if (j === idx) setReplayKey(k => k + 1)
    else setIdx(j)
  }
  const replay = () => { setPlaying(true); jump(0) }

  // Keyboard: space = pause, arrows = prev/next, Esc = stop
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return
      if (e.key === 'Escape') onClose()
      else if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p) }
      else if (e.key === 'ArrowRight') jump(idx + 1)
      else if (e.key === 'ArrowLeft') jump(idx - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const entry = stops[idx]
  if (!entry) return null
  const mood = getMoodFromEntry(entry)
  const dateStr = entry.date
    ? new Date(entry.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''
  const finished = phase === 'done'
  const btn = 'p-2 rounded-full text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors disabled:opacity-30'
  const totalKm = Math.round(stops.slice(1).reduce((a, s, i) => a + distanceKm(stops[i], s), 0))
  const countries = new Set(stops.map(s => s.country).filter(Boolean)).size
  const placeName = entry.englishName || entry.location

  return (
    <>
      {phase === 'arrived' && (
        <Polaroid key={entry.id + ':' + replayKey} entry={entry}
          photos={photos[entry.id] || (coverUrls[entry.id] ? [coverUrls[entry.id]] : [])}
          isMobile={isMobile} tiltSide={idx % 2 ? 1 : -1} />
      )}

      <div
        className="absolute left-1/2 -translate-x-1/2 z-[900] w-[min(440px,calc(100%-32px))]"
        style={{ bottom: isMobile ? 'calc(84px + max(env(safe-area-inset-bottom), 34px))' : 24 }}
      >
        {/* progress */}
        <div className="flex gap-1 mb-2 px-1">
          {stops.map((s, i) => (
            <button key={s.id} onClick={() => jump(i)} aria-label={`stop ${i + 1}`}
              className="flex-1 rounded-full transition-colors p-0 border-0 appearance-none"
              style={{ height: 4, minHeight: 0, background: finished || i < idx || (i === idx && phase !== 'flying') ? mood.color : 'rgba(53,47,40,0.18)' }} />
          ))}
        </div>

        <div className="bg-stone-50/95 backdrop-blur rounded-2xl border border-stone-200 shadow-xl overflow-hidden">
          <div style={{ height: 4, background: mood.color, transition: 'background .4s' }} />
          {finished ? (
            <div className="px-4 pt-3 pb-1" style={{ animation: 'tripIn 0.35s ease' }}>
              <p className="text-[10px] tracking-widest uppercase text-stone-400" style={{ fontFamily: 'DM Mono, monospace' }}>trip complete</p>
              <h3 className="text-stone-800" style={{ fontFamily: 'Playfair Display, serif', fontSize: 18 }}>
                {stops.length} places{countries > 1 ? ` · ${countries} countries` : ''} · {totalKm.toLocaleString()} km
              </h3>
            </div>
          ) : (
            <div className="px-4 pt-3 pb-1 cursor-pointer" key={entry.id} style={{ animation: 'tripIn 0.35s ease' }}
              onClick={() => { setPlaying(false); onOpen(entry.id) }}>
              <p className="text-[10px] tracking-widest uppercase text-stone-400" style={{ fontFamily: 'DM Mono, monospace' }}>
                {phase === 'flying' && idx > 0 ? 'travelling · ' : ''}stop {idx + 1} of {stops.length} · {dateStr}
              </p>
              <h3 className="truncate text-stone-800" style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, lineHeight: 1.25 }}>
                {placeName}{entry.country && entry.country !== placeName ? <span className="text-stone-400 text-sm"> · {entry.country}</span> : null}
              </h3>
              {entry.note && (
                <p className="text-xs text-stone-600 mt-0.5 line-clamp-2" style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>
                  “{entry.note}”
                </p>
              )}
            </div>
          )}
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-[10px] text-stone-400 pl-2" style={{ fontFamily: 'DM Mono, monospace' }}>{finished ? '' : 'tap to open'}</span>
            <div className="flex items-center">
              <button className={btn} onClick={() => jump(idx - 1)} disabled={idx === 0 || finished} aria-label="previous"><SkipBack size={15} /></button>
              {finished ? (
                <button className={btn} onClick={replay} aria-label="replay"><RotateCcw size={15} /></button>
              ) : (
                <button className={btn} aria-label={playing ? 'pause' : 'play'} onClick={() => setPlaying(p => !p)}>
                  {playing ? <Pause size={15} /> : <Play size={15} />}
                </button>
              )}
              <button className={btn} onClick={() => jump(idx + 1)} disabled={idx === stops.length - 1 || finished} aria-label="next"><SkipForward size={15} /></button>
              <button className={btn} onClick={onClose} aria-label="stop trip"><X size={15} /></button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

import { useState, useEffect, useRef } from 'react'
import { X, Trash2, ChevronLeft, ChevronRight, Pencil, Check, Upload, Globe, Mountain, Star, Pipette } from 'lucide-react'
import { getMoodFromEntry, MOODS, CUSTOM_MOOD_IDX, WEATHER_OPTIONS, COMPANION_OPTIONS } from '../utils/moods.js'
import { MAX_PHOTOS } from '../constants/limits.js'
import { preparePhotos, IMAGE_ACCEPT } from '../utils/photoImport.js'
import StreetViewMini from './StreetViewMini.jsx'

export default function DetailCard({ entry, onClose, onDelete, onUpdate, getPhotoUrls, uploadPhotos, siblings = [], onNavigate = () => {}, isMobile = false }) {
  const [lightbox, setLightbox] = useState(false)
  const [photoUrls, setPhotoUrls] = useState([])
  const [photoIdx, setPhotoIdx] = useState(0)
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const revokeRef = useRef([])

  const [editing, setEditing] = useState(false)
  const [editLocation, setEditLocation] = useState(entry.location)
  const [editDate, setEditDate] = useState(entry.date)
  const [editNote, setEditNote] = useState(entry.note)
  const [editMoodIdx, setEditMoodIdx] = useState(entry.moodIdx)
  const [editCustomColor, setEditCustomColor] = useState(entry.customMoodColor || '#e07a5f')
  const [editCustomLabel, setEditCustomLabel] = useState(entry.customMoodLabel || '')
  const [editWeather, setEditWeather] = useState(entry.weather || '')
  const [editCompanions, setEditCompanions] = useState(entry.companions || '')
  const [editRating, setEditRating] = useState(entry.rating || 0)
  const [editTags, setEditTags] = useState((entry.tags || []).join(', '))
  const [newPhotos, setNewPhotos] = useState([])
  const [newPreviews, setNewPreviews] = useState([])
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef()
  const colorInputRef = useRef()

  const mood = getMoodFromEntry(entry)
  const editMoodColor = editMoodIdx === CUSTOM_MOOD_IDX ? editCustomColor : (MOODS[editMoodIdx]?.color || editCustomColor)

  const dateStr = entry.date
    ? new Date(entry.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  // Leave edit mode and reset the gallery when switching to another memory
  useEffect(() => { setEditing(false); setLightbox(false); setPhotoIdx(0) }, [entry.id])

  useEffect(() => {
    if (entry.photoCount === 0) { setPhotoUrls([]); return }
    setLoadingPhotos(true)
    getPhotoUrls(entry.id, entry.photoCount).then(urls => {
      revokeRef.current = []
      setPhotoUrls(urls)
      setPhotoIdx(0)
      setLoadingPhotos(false)
    })
    return () => { revokeRef.current = [] }
  }, [entry.id, entry.photoCount])

  const handleDelete = async () => {
    if (confirm(`Delete memory "${entry.location}"?`)) { await onDelete(entry.id); onClose() }
  }

  const startEdit = () => {
    setEditLocation(entry.location); setEditDate(entry.date); setEditNote(entry.note)
    setEditMoodIdx(entry.moodIdx); setEditCustomColor(entry.customMoodColor || '#e07a5f')
    setEditCustomLabel(entry.customMoodLabel || ''); setEditWeather(entry.weather || '')
    setEditCompanions(entry.companions || ''); setEditRating(entry.rating || 0)
    setEditTags((entry.tags || []).join(', ')); setNewPhotos([]); setNewPreviews([])
    setEditing(true)
  }

  const cancelEdit = () => {
    newPreviews.forEach(url => URL.revokeObjectURL(url))
    setNewPhotos([]); setNewPreviews([]); setEditing(false)
  }

  const [converting, setConverting] = useState(false)
  const handleNewPhotos = async (files) => {
    const total = entry.photoCount + newPhotos.length
    const list = Array.from(files || []).slice(0, Math.max(0, MAX_PHOTOS - total))
    if (!list.length) return
    setConverting(true)
    const { files: valid } = await preparePhotos(list)   // HEIC → JPEG, big photos scaled down
    setConverting(false)
    if (!valid.length) return
    const previews = valid.map(f => URL.createObjectURL(f))
    setNewPhotos(p => [...p, ...valid]); setNewPreviews(p => [...p, ...previews])
  }

  const handleSaveEdit = async () => {
    setSaving(true)
    if (newPhotos.length > 0) {
      await uploadPhotos(entry.id, entry.photoCount, newPhotos)
    }
    await onUpdate(entry.id, {
      location: editLocation.trim() || entry.location,
      date: editDate, note: editNote.trim(),
      moodIdx: editMoodIdx,
      customMoodColor: editMoodIdx === CUSTOM_MOOD_IDX ? editCustomColor : null,
      customMoodLabel: editMoodIdx === CUSTOM_MOOD_IDX ? (editCustomLabel.trim() || 'custom') : null,
      weather: editWeather, companions: editCompanions, rating: editRating,
      tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
      photoCount: entry.photoCount + newPhotos.length,
    })
    newPreviews.forEach(url => URL.revokeObjectURL(url))
    setNewPhotos([]); setNewPreviews([]); setSaving(false); setEditing(false)
  }

  const weatherObj = WEATHER_OPTIONS.find(w => w.value === entry.weather)
  const companionObj = COMPANION_OPTIONS.find(c => c.value === entry.companions)

  // ── photo gallery helpers ──
  const n = photoUrls.length
  const prevPhoto = () => setPhotoIdx(i => (i - 1 + n) % n)
  const nextPhoto = () => setPhotoIdx(i => (i + 1) % n)
  const touchX = useRef(null)
  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (touchX.current == null || n < 2) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) > 40) (dx < 0 ? nextPhoto : prevPhoto)()
    touchX.current = null
  }

  // ── older / newer memory (date order, same filters as the sidebar) ──
  const pos = siblings.findIndex(s => s.id === entry.id)
  const older = pos > 0 ? siblings[pos - 1] : null
  const newer = pos >= 0 && pos < siblings.length - 1 ? siblings[pos + 1] : null

  // Keyboard: ←/→ photos, Esc closes (lightbox first)
  useEffect(() => {
    const onKey = (e) => {
      if (editing || e.target.closest?.('input, textarea')) return
      if (e.key === 'Escape') { lightbox ? setLightbox(false) : onClose() }
      else if (e.key === 'ArrowRight' && n > 1) nextPhoto()
      else if (e.key === 'ArrowLeft' && n > 1) prevPhoto()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, lightbox, n, onClose])

  const hasPhotos = entry.photoCount > 0
  const title = entry.englishName && entry.nativeName && entry.nativeName !== entry.englishName ? entry.englishName : entry.location

  const gallery = hasPhotos && (
    <div className="relative bg-stone-900 overflow-hidden select-none"
      style={{ height: isMobile ? '46vh' : '100%', minHeight: isMobile ? 0 : 420 }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* blurred backdrop so portrait and landscape photos both fill the frame */}
      {n > 0 && (
        <img src={photoUrls[photoIdx]} alt="" aria-hidden
          className="absolute inset-0 w-full h-full object-cover scale-110"
          style={{ filter: 'blur(24px) brightness(0.6)' }} />
      )}
      {loadingPhotos && n === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-stone-400">loading photos...</div>
      ) : n > 0 ? (
        <>
          <img key={photoUrls[photoIdx]} src={photoUrls[photoIdx]} alt=""
            onClick={() => setLightbox(true)}
            className="relative w-full h-full object-contain cursor-zoom-in"
            style={{ animation: 'tripIn 0.25s ease' }} />
          {n > 1 && (
            <>
              <button onClick={prevPhoto} aria-label="previous photo"
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <button onClick={nextPhoto} aria-label="next photo"
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 transition-colors">
                <ChevronRight size={16} />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[90%] overflow-x-auto p-1">
                {photoUrls.map((u, i) => (
                  <button key={u} onClick={() => setPhotoIdx(i)} aria-label={`photo ${i + 1}`}
                    className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 transition-all"
                    style={{ outline: i === photoIdx ? '2px solid white' : 'none', opacity: i === photoIdx ? 1 : 0.6 }}>
                    <img src={u} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}
          <span className="absolute top-3 left-3 text-[10px] text-white/90 bg-black/40 rounded-full px-2 py-0.5"
            style={{ fontFamily: 'DM Mono, monospace' }}>{photoIdx + 1} / {n}</span>
        </>
      ) : null}
    </div>
  )

  return (
    <div className={`absolute inset-0 z-[1000] flex items-center justify-center ${isMobile ? '' : 'p-6'}`}
      style={{ background: 'rgba(26,22,18,0.45)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-stone-50 shadow-2xl overflow-hidden flex ${isMobile ? 'flex-col w-full h-full' : 'rounded-2xl border border-stone-200 w-full max-h-[88vh]'}`}
        style={{ maxWidth: isMobile ? '100%' : (hasPhotos ? 880 : 460), animation: 'cardIn 0.3s ease' }}
      >
        {/* Photos (left on desktop, top on mobile) */}
        {hasPhotos && (
          <div className={isMobile ? 'flex-shrink-0' : 'w-[52%] flex-shrink-0'}>{gallery}</div>
        )}

        {/* Diary page */}
        <div className="relative flex-1 min-w-0 flex flex-col">
          <div style={{ height: 5, background: editing ? editMoodColor : mood.color, transition: 'background 0.2s', flexShrink: 0 }} />

          {/* Header buttons */}
          <div className="absolute top-4 right-3 flex gap-1.5 z-10">
            {!editing && (
              <button onClick={startEdit} className="bg-stone-50/90 rounded-full p-1.5 text-stone-400 hover:text-stone-700 transition-colors" title="edit">
                <Pencil size={14} />
              </button>
            )}
            <button onClick={editing ? cancelEdit : onClose} className="bg-stone-50/90 rounded-full p-1.5 text-stone-400 hover:text-stone-700 transition-colors" title="close">
              <X size={14} />
            </button>
          </div>

          <div className="px-6 py-5 overflow-y-auto flex-1">
          {editing ? (
            <div className="space-y-3 pt-1">
              {/* Location */}
              <div>
                <label className="block text-xs tracking-widest text-stone-400 uppercase mb-1">location</label>
                <input value={editLocation} onChange={e => setEditLocation(e.target.value)} autoFocus
                  className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:border-stone-400"
                  style={{ fontFamily: 'DM Mono, monospace' }} />
              </div>
              {/* Date */}
              <div>
                <label className="block text-xs tracking-widest text-stone-400 uppercase mb-1">date</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
                  style={{ fontFamily: 'DM Mono, monospace' }} />
              </div>
              {/* Note */}
              <div>
                <label className="block text-xs tracking-widest text-stone-400 uppercase mb-1">note</label>
                <textarea value={editNote} onChange={e => setEditNote(e.target.value)} rows={2}
                  className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-stone-400 resize-none"
                  style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }} />
              </div>
              {/* Rating */}
              <div>
                <label className="block text-xs tracking-widest text-stone-400 uppercase mb-1">rating</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setEditRating(prev => prev === s ? 0 : s)}
                      className="text-lg" style={{ color: s <= editRating ? '#d4a843' : '#d6d3cd' }}>★</button>
                  ))}
                </div>
              </div>
              {/* Weather */}
              <div>
                <label className="block text-xs tracking-widest text-stone-400 uppercase mb-1">weather</label>
                <div className="flex gap-1 flex-wrap">
                  {WEATHER_OPTIONS.map(w => (
                    <button key={w.value} onClick={() => setEditWeather(prev => prev === w.value ? '' : w.value)}
                      className="text-xs px-2 py-1 rounded-lg border transition-colors"
                      style={{ borderColor: editWeather === w.value ? '#8a7f72' : '#e7e3dd', background: editWeather === w.value ? '#352f28' : 'white', color: editWeather === w.value ? '#f5f0ea' : '#6b6058', fontFamily: 'DM Mono, monospace' }}>
                      {w.emoji} {w.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Companions */}
              <div>
                <label className="block text-xs tracking-widest text-stone-400 uppercase mb-1">with</label>
                <div className="flex gap-1 flex-wrap">
                  {COMPANION_OPTIONS.map(c => (
                    <button key={c.value} onClick={() => setEditCompanions(prev => prev === c.value ? '' : c.value)}
                      className="text-xs px-2 py-1 rounded-lg border transition-colors"
                      style={{ borderColor: editCompanions === c.value ? '#8a7f72' : '#e7e3dd', background: editCompanions === c.value ? '#352f28' : 'white', color: editCompanions === c.value ? '#f5f0ea' : '#6b6058', fontFamily: 'DM Mono, monospace' }}>
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Tags */}
              <div>
                <label className="block text-xs tracking-widest text-stone-400 uppercase mb-1">tags</label>
                <input value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="food, beach, hiking..."
                  className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
                  style={{ fontFamily: 'DM Mono, monospace' }} />
              </div>
              {/* Mood */}
              <div>
                <label className="block text-xs tracking-widest text-stone-400 uppercase mb-2">mood color</label>
                <div className="flex gap-2 flex-wrap items-center">
                  {MOODS.map((m, i) => (
                    <button key={m.label} onClick={() => setEditMoodIdx(i)}
                      className="relative w-7 h-7 rounded-full hover:scale-110 transition-transform"
                      style={{ background: m.color, outline: editMoodIdx === i ? `2.5px solid ${m.color}` : 'none', outlineOffset: '3px' }}>
                      {editMoodIdx === i && <span className="absolute inset-0 flex items-center justify-center text-white text-xs">✓</span>}
                    </button>
                  ))}
                  <div className="relative">
                    <button onClick={() => { setEditMoodIdx(CUSTOM_MOOD_IDX); colorInputRef.current?.click() }}
                      className="relative w-7 h-7 rounded-full border-2 border-dashed border-stone-300 flex items-center justify-center overflow-hidden"
                      style={{ background: editMoodIdx === CUSTOM_MOOD_IDX ? editCustomColor : 'white', outline: editMoodIdx === CUSTOM_MOOD_IDX ? `2.5px solid ${editCustomColor}` : 'none', outlineOffset: '3px' }}>
                      {editMoodIdx !== CUSTOM_MOOD_IDX ? <Pipette size={11} className="text-stone-400" /> : <span className="text-white text-xs">✓</span>}
                    </button>
                    <input ref={colorInputRef} type="color" value={editCustomColor}
                      onChange={e => { setEditCustomColor(e.target.value); setEditMoodIdx(CUSTOM_MOOD_IDX) }}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                  </div>
                </div>
              </div>
              {/* Add photos */}
              {(entry.photoCount + newPhotos.length) < MAX_PHOTOS && (
                <div>
                  <label className="block text-xs tracking-widest text-stone-400 uppercase mb-1">add photos</label>
                  <button onClick={() => fileInputRef.current.click()}
                    className="flex items-center gap-2 text-xs text-stone-500 border border-dashed border-stone-300 rounded-lg px-3 py-2 hover:bg-stone-100 w-full">
                    <Upload size={13} /> browse photos
                  </button>
                  <input ref={fileInputRef} type="file" accept={IMAGE_ACCEPT} multiple className="hidden" onChange={e => { handleNewPhotos(e.target.files); e.target.value = '' }} />
                  {newPreviews.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {newPreviews.map((url, i) => (
                        <div key={i} className="w-14 h-14 rounded-lg overflow-hidden border border-stone-200">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Save/Cancel */}
              <div className="flex gap-2 pt-1">
                <button onClick={cancelEdit}
                  className="flex-1 py-2 text-xs text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-100"
                  style={{ fontFamily: 'DM Mono, monospace' }}>cancel</button>
                <button onClick={handleSaveEdit} disabled={saving || converting}
                  className="flex-1 py-2 text-xs text-white rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
                  style={{ background: editMoodColor, fontFamily: 'DM Mono, monospace' }}>
                  <Check size={13} />{saving ? 'saving...' : converting ? 'preparing photos…' : 'save changes'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* date line */}
              <p className="text-[11px] tracking-widest uppercase text-stone-400 mb-1 pr-16">{dateStr}</p>

              {/* Location title */}
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: 28, lineHeight: 1.15, marginBottom: 4, paddingRight: 56 }}>
                {title}
              </h2>
              {entry.nativeName && entry.nativeName !== entry.englishName && (
                <p className="text-sm text-stone-400 mb-1" style={{ fontFamily: 'serif' }}>{entry.nativeName}</p>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {entry.country && (
                  <span className="flex items-center gap-1 text-xs text-stone-500"><Globe size={11} />{entry.country}</span>
                )}
                {entry.elevation != null && (
                  <span className="flex items-center gap-1 text-xs text-stone-500"><Mountain size={11} />{entry.elevation.toLocaleString()}m</span>
                )}
                {entry.rating > 0 && (
                  <span className="flex items-center gap-0.5">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} style={{ color: s <= entry.rating ? '#d4a843' : '#d6d3cd', fontSize: 15 }}>★</span>
                    ))}
                  </span>
                )}
              </div>

              {/* Note — the diary text */}
              {entry.note && (
                <p className="text-stone-700 leading-relaxed mb-4 pl-3"
                  style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontSize: 16, borderLeft: `3px solid ${mood.color}` }}>
                  {entry.note}
                </p>
              )}

              {/* Chips row: mood, weather, companions */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                  style={{ background: mood.color + '22', color: mood.color }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: mood.color }} />
                  {mood.label}
                </span>
                {weatherObj && (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">
                    {weatherObj.emoji} {weatherObj.label}
                  </span>
                )}
                {companionObj && (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">
                    {companionObj.emoji} {companionObj.label}
                  </span>
                )}
                {hasPhotos && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-500">
                    {entry.photoCount} photo{entry.photoCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Tags */}
              {entry.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {entry.tags.map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full border border-stone-200 text-stone-500"
                      style={{ fontFamily: 'DM Mono, monospace' }}>
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Street View of the spot */}
              <div className="mb-4">
                <StreetViewMini lat={entry.lat} lng={entry.lng} />
              </div>

              {/* Actions */}
              <div className="flex gap-3 border-t border-stone-100 pt-3">
                <button onClick={startEdit}
                  className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-700 transition-colors py-1"
                  style={{ fontFamily: 'DM Mono, monospace' }}>
                  <Pencil size={13} />edit
                </button>
                <button onClick={handleDelete}
                  className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-rose-500 transition-colors py-1"
                  style={{ fontFamily: 'DM Mono, monospace' }}>
                  <Trash2 size={13} />delete
                </button>
              </div>
            </>
          )}
          </div>

          {/* Older / newer memory */}
          {!editing && (older || newer) && (
            <div className="flex items-center justify-between border-t border-stone-200 px-4 py-2.5 flex-shrink-0 gap-2"
              style={{ fontFamily: 'DM Mono, monospace', paddingBottom: isMobile ? 'max(10px, env(safe-area-inset-bottom))' : undefined }}>
              <button disabled={!older} onClick={() => older && onNavigate(older.id)}
                className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 disabled:opacity-30 min-w-0">
                <ChevronLeft size={14} className="flex-shrink-0" /><span className="truncate">{older ? (older.englishName || older.location) : 'older'}</span>
              </button>
              <span className="text-[10px] text-stone-400 flex-shrink-0">{pos + 1} / {siblings.length}</span>
              <button disabled={!newer} onClick={() => newer && onNavigate(newer.id)}
                className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 disabled:opacity-30 min-w-0 justify-end">
                <span className="truncate">{newer ? (newer.englishName || newer.location) : 'newer'}</span><ChevronRight size={14} className="flex-shrink-0" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Full-screen photo */}
      {lightbox && n > 0 && (
        <div className="fixed inset-0 z-[1100] bg-black/95 flex items-center justify-center"
          onClick={() => setLightbox(false)} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <img src={photoUrls[photoIdx]} alt="" className="max-w-[96vw] max-h-[92vh] object-contain" onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(false)} className="absolute top-4 right-4 text-white/80 hover:text-white p-2" aria-label="close photo"><X size={20} /></button>
          {n > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); prevPhoto() }} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2" aria-label="previous photo"><ChevronLeft size={28} /></button>
              <button onClick={e => { e.stopPropagation(); nextPhoto() }} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2" aria-label="next photo"><ChevronRight size={28} /></button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

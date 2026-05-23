import { useState, useEffect, useRef } from 'react'
import { X, Trash2, ChevronLeft, ChevronRight, Pencil, Check, Upload, Globe, Mountain, Star, Pipette } from 'lucide-react'
import { getMoodFromEntry, MOODS, CUSTOM_MOOD_IDX, WEATHER_OPTIONS, COMPANION_OPTIONS } from '../utils/moods.js'

const MAX_PHOTOS = 3

export default function DetailCard({ entry, onClose, onDelete, onUpdate, getPhotoUrls, uploadPhotos }) {
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

  useEffect(() => {
    if (entry.photoCount === 0) return
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

  const handleNewPhotos = (files) => {
    const total = entry.photoCount + newPhotos.length
    const valid = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, MAX_PHOTOS - total)
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

  return (
    <div className="absolute inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(26,22,18,0.4)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-stone-50 rounded-xl border border-stone-200 w-full max-w-sm shadow-xl overflow-hidden">

        {/* Mood color bar */}
        <div style={{ height: 5, background: editing ? editMoodColor : mood.color, transition: 'background 0.2s' }} />

        {/* Photo gallery */}
        {entry.photoCount > 0 && (
          <div className="relative bg-stone-200 overflow-hidden" style={{ height: 200 }}>
            {loadingPhotos ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-stone-400">loading photos...</div>
            ) : photoUrls.length > 0 ? (
              <>
                <img src={photoUrls[photoIdx]} alt="" className="w-full h-full object-cover" />
                {photoUrls.length > 1 && (
                  <>
                    <button onClick={() => setPhotoIdx(i => (i - 1 + photoUrls.length) % photoUrls.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1 hover:bg-black/60 transition-colors">
                      <ChevronLeft size={14} />
                    </button>
                    <button onClick={() => setPhotoIdx(i => (i + 1) % photoUrls.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1 hover:bg-black/60 transition-colors">
                      <ChevronRight size={14} />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      {photoUrls.map((_, i) => (
                        <button key={i} onClick={() => setPhotoIdx(i)}
                          className="w-1.5 h-1.5 rounded-full transition-colors"
                          style={{ background: i === photoIdx ? 'white' : 'rgba(255,255,255,0.4)' }} />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* Header buttons */}
        <div className="absolute top-3 right-3 flex gap-1.5 z-10">
          {!editing && (
            <button onClick={startEdit} className="bg-stone-50/90 rounded-full p-1.5 text-stone-400 hover:text-stone-700 transition-colors" title="edit">
              <Pencil size={14} />
            </button>
          )}
          <button onClick={editing ? cancelEdit : onClose} className="bg-stone-50/90 rounded-full p-1.5 text-stone-400 hover:text-stone-700 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-[75vh] overflow-y-auto">
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
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleNewPhotos(e.target.files)} />
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
                <button onClick={handleSaveEdit} disabled={saving}
                  className="flex-1 py-2 text-xs text-white rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
                  style={{ background: editMoodColor, fontFamily: 'DM Mono, monospace' }}>
                  <Check size={13} />{saving ? 'saving...' : 'save changes'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Location title */}
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: 20, marginBottom: 4, paddingRight: 56 }}>
                {entry.englishName && entry.nativeName && entry.nativeName !== entry.englishName ? entry.englishName : entry.location}
              </h2>
              {entry.nativeName && entry.nativeName !== entry.englishName && (
                <p className="text-sm text-stone-400 mb-1" style={{ fontFamily: 'serif' }}>{entry.nativeName}</p>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <p className="text-xs text-stone-400">{dateStr}</p>
                {entry.elevation != null && (
                  <span className="flex items-center gap-1 text-xs text-stone-400"><Mountain size={10} />{entry.elevation.toLocaleString()}m</span>
                )}
                {entry.country && (
                  <span className="flex items-center gap-1 text-xs text-stone-400"><Globe size={10} />{entry.country}</span>
                )}
              </div>

              {/* Rating */}
              {entry.rating > 0 && (
                <div className="flex items-center gap-0.5 mb-3">
                  {[1,2,3,4,5].map(s => (
                    <span key={s} style={{ color: s <= entry.rating ? '#d4a843' : '#d6d3cd', fontSize: 16 }}>★</span>
                  ))}
                </div>
              )}

              {/* Note */}
              {entry.note && (
                <p className="text-sm text-stone-600 leading-relaxed mb-3"
                  style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>
                  "{entry.note}"
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
                {entry.photoCount > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-500">
                    {entry.photoCount} photo{entry.photoCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Tags */}
              {entry.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {entry.tags.map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full border border-stone-200 text-stone-500"
                      style={{ fontFamily: 'DM Mono, monospace' }}>
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

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
      </div>
    </div>
  )
}

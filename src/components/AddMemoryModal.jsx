import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Upload, MapPin, Globe, Mountain, Pipette } from 'lucide-react'
import { MOODS, CUSTOM_MOOD_IDX, WEATHER_OPTIONS, COMPANION_OPTIONS } from '../utils/moods.js'
import { reverseGeocode, getElevation } from '../utils/geocode.js'

const MAX_PHOTOS = 3

export default function AddMemoryModal({ coords, onSave, onClose, prefillLocation }) {
  const [location, setLocation] = useState(prefillLocation || '')
  const [nativeName, setNativeName] = useState('')
  const [englishName, setEnglishName] = useState('')
  const [country, setCountry] = useState('')
  const [elevation, setElevation] = useState(null)
  const [geocoding, setGeocoding] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')

  // Mood — preset index or CUSTOM_MOOD_IDX
  const [moodIdx, setMoodIdx] = useState(0)
  const [customColor, setCustomColor] = useState('#e07a5f')
  const [customLabel, setCustomLabel] = useState('')
  const colorInputRef = useRef()

  // New fields
  const [weather, setWeather] = useState('')
  const [companions, setCompanions] = useState('')
  const [rating, setRating] = useState(0)
  const [tags, setTags] = useState('')

  const [photos, setPhotos] = useState([])
  const [previews, setPreviews] = useState([])
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef()

  const activeMoodColor = moodIdx === CUSTOM_MOOD_IDX ? customColor : MOODS[moodIdx]?.color

  useEffect(() => {
    if (!coords) return
    if (prefillLocation) { setLocation(prefillLocation); return }
    setGeocoding(true)
    Promise.all([
      reverseGeocode(coords.lat, coords.lng),
      getElevation(coords.lat, coords.lng),
    ]).then(([geo, elev]) => {
      if (geo) {
        setLocation(geo.displayName)
        setNativeName(geo.nativeName)
        setEnglishName(geo.englishName)
        setCountry(geo.country)
      }
      if (elev !== null) setElevation(elev)
      setGeocoding(false)
    })
  }, [coords?.lat, coords?.lng, prefillLocation])

  const handleFiles = useCallback((files) => {
    const valid = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, MAX_PHOTOS - photos.length)
    if (!valid.length) return
    const newPreviews = valid.map(f => URL.createObjectURL(f))
    setPhotos(prev => [...prev, ...valid])
    setPreviews(prev => [...prev, ...newPreviews])
  }, [photos])

  const removePhoto = (idx) => {
    URL.revokeObjectURL(previews[idx])
    setPhotos(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)
  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }

  const handleSave = async () => {
    if (!location.trim()) { document.getElementById('f-location')?.focus(); return }
    setSaving(true)
    await onSave({
      lat: coords.lat, lng: coords.lng,
      location: location.trim(), nativeName, englishName, country, elevation,
      date, note: note.trim(),
      moodIdx,
      customMoodColor: moodIdx === CUSTOM_MOOD_IDX ? customColor : null,
      customMoodLabel: moodIdx === CUSTOM_MOOD_IDX ? (customLabel.trim() || 'custom') : null,
      weather, companions, rating,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      photos,
    })
    previews.forEach(url => URL.revokeObjectURL(url))
    setSaving(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.type !== 'text') handleSave()
  }

  return (
    <div
      className="absolute inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(26,22,18,0.4)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-stone-50 rounded-xl border border-stone-200 w-full max-w-md shadow-xl relative">

        {/* Mood color bar at top */}
        <div style={{ height: 4, background: activeMoodColor, borderRadius: '12px 12px 0 0', transition: 'background 0.2s' }} />

        {/* Header */}
        <div className="px-6 pt-4 pb-4 border-b border-stone-200 flex items-center justify-between">
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: 18 }}>new memory</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors"><X size={18} /></button>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* Coords + elevation */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-stone-400">
              <MapPin size={11} /><span>{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
            </div>
            {elevation !== null && (
              <div className="flex items-center gap-1.5 text-xs text-stone-400">
                <Mountain size={11} /><span>{elevation.toLocaleString()}m</span>
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs tracking-widest text-stone-400 uppercase mb-1.5">
              location <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input id="f-location" type="text"
                value={geocoding ? '' : location}
                onChange={e => setLocation(e.target.value)}
                placeholder={geocoding ? 'detecting...' : 'e.g. Tokyo (東京), Japan'}
                disabled={geocoding}
                className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400 disabled:opacity-60"
                style={{ fontFamily: 'DM Mono, monospace' }}
                autoFocus={!geocoding}
              />
              {geocoding && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border border-stone-300 border-t-stone-500 rounded-full animate-spin" />}
            </div>
            {(nativeName || englishName) && !geocoding && (
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Globe size={10} className="text-stone-300" />
                {englishName && <span className="text-xs text-stone-400">{englishName}</span>}
                {nativeName && nativeName !== englishName && <><span className="text-xs text-stone-300">·</span><span className="text-xs text-stone-400" style={{ fontFamily: 'serif' }}>{nativeName}</span></>}
                {country && <><span className="text-xs text-stone-300">·</span><span className="text-xs text-stone-300">{country}</span></>}
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs tracking-widest text-stone-400 uppercase mb-1.5">date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:border-stone-400"
              style={{ fontFamily: 'DM Mono, monospace' }} />
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs tracking-widest text-stone-400 uppercase mb-1.5">note</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="what do you remember about this place..."
              rows={3}
              className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700 placeholder-stone-300 focus:outline-none focus:border-stone-400 resize-none"
              style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }} />
          </div>

          {/* Rating */}
          <div>
            <label className="block text-xs tracking-widest text-stone-400 uppercase mb-2">rating</label>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(star => (
                <button key={star} onClick={() => setRating(prev => prev === star ? 0 : star)}
                  className="text-xl transition-transform hover:scale-110"
                  style={{ color: star <= rating ? '#d4a843' : '#d6d3cd' }}
                >★</button>
              ))}
              {rating > 0 && <span className="text-xs text-stone-400 self-center ml-1">{rating}/5</span>}
            </div>
          </div>

          {/* Weather */}
          <div>
            <label className="block text-xs tracking-widest text-stone-400 uppercase mb-2">weather</label>
            <div className="flex gap-1.5 flex-wrap">
              {WEATHER_OPTIONS.map(w => (
                <button key={w.value} onClick={() => setWeather(prev => prev === w.value ? '' : w.value)}
                  title={w.label}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
                  style={{
                    borderColor: weather === w.value ? '#8a7f72' : '#e7e3dd',
                    background: weather === w.value ? '#352f28' : 'white',
                    color: weather === w.value ? '#f5f0ea' : '#6b6058',
                    fontFamily: 'DM Mono, monospace',
                  }}
                >
                  <span>{w.emoji}</span>
                  <span>{w.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Companions */}
          <div>
            <label className="block text-xs tracking-widest text-stone-400 uppercase mb-2">with</label>
            <div className="flex gap-1.5 flex-wrap">
              {COMPANION_OPTIONS.map(c => (
                <button key={c.value} onClick={() => setCompanions(prev => prev === c.value ? '' : c.value)}
                  title={c.label}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
                  style={{
                    borderColor: companions === c.value ? '#8a7f72' : '#e7e3dd',
                    background: companions === c.value ? '#352f28' : 'white',
                    color: companions === c.value ? '#f5f0ea' : '#6b6058',
                    fontFamily: 'DM Mono, monospace',
                  }}
                >
                  <span>{c.emoji}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs tracking-widest text-stone-400 uppercase mb-1.5">tags</label>
            <input type="text" value={tags} onChange={e => setTags(e.target.value)}
              placeholder="food, beach, hiking, temple..."
              className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700 placeholder-stone-300 focus:outline-none focus:border-stone-400"
              style={{ fontFamily: 'DM Mono, monospace' }} />
            <p className="text-xs text-stone-300 mt-1">separate with commas</p>
          </div>

          {/* Mood — presets + custom color picker */}
          <div>
            <label className="block text-xs tracking-widest text-stone-400 uppercase mb-2">mood color</label>
            <div className="flex gap-2 flex-wrap items-center">
              {MOODS.map((mood, i) => (
                <button key={mood.label} onClick={() => setMoodIdx(i)} title={mood.label}
                  className="relative w-8 h-8 rounded-full transition-transform hover:scale-110 flex-shrink-0"
                  style={{
                    background: mood.color,
                    outline: moodIdx === i ? `2.5px solid ${mood.color}` : 'none',
                    outlineOffset: '3px',
                    transform: moodIdx === i ? 'scale(1.15)' : 'scale(1)',
                  }}
                >
                  {moodIdx === i && <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">✓</span>}
                </button>
              ))}

              {/* Custom color button */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => { setMoodIdx(CUSTOM_MOOD_IDX); colorInputRef.current?.click() }}
                  title="custom color"
                  className="relative w-8 h-8 rounded-full border-2 border-dashed border-stone-300 flex items-center justify-center hover:border-stone-500 transition-colors overflow-hidden"
                  style={{
                    background: moodIdx === CUSTOM_MOOD_IDX ? customColor : 'white',
                    outline: moodIdx === CUSTOM_MOOD_IDX ? `2.5px solid ${customColor}` : 'none',
                    outlineOffset: '3px',
                  }}
                >
                  {moodIdx !== CUSTOM_MOOD_IDX && <Pipette size={12} className="text-stone-400" />}
                  {moodIdx === CUSTOM_MOOD_IDX && <span className="text-white text-xs font-bold">✓</span>}
                </button>
                <input ref={colorInputRef} type="color" value={customColor}
                  onChange={e => { setCustomColor(e.target.value); setMoodIdx(CUSTOM_MOOD_IDX) }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
              </div>
            </div>

            {/* Custom label input */}
            {moodIdx === CUSTOM_MOOD_IDX && (
              <input type="text" value={customLabel} onChange={e => setCustomLabel(e.target.value)}
                placeholder="name this mood..."
                className="mt-2 w-full bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-xs text-stone-700 placeholder-stone-300 focus:outline-none focus:border-stone-400"
                style={{ fontFamily: 'DM Mono, monospace' }} />
            )}

            <p className="text-xs text-stone-400 mt-1.5 italic">
              {moodIdx === CUSTOM_MOOD_IDX
                ? `custom · ${customColor}`
                : MOODS[moodIdx]?.label}
            </p>
          </div>

          {/* Photos */}
          <div>
            <label className="block text-xs tracking-widest text-stone-400 uppercase mb-2">
              photos ({photos.length}/{MAX_PHOTOS})
            </label>
            {photos.length < MAX_PHOTOS && (
              <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                onClick={() => fileInputRef.current.click()}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${dragging ? 'border-stone-400 bg-stone-100' : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'}`}
              >
                <Upload size={18} className="mx-auto mb-1 text-stone-300" />
                <p className="text-xs text-stone-400">drag photos or click to browse</p>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
              </div>
            )}
            {previews.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {previews.map((url, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-stone-200 group">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-white">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2 text-sm text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-100 transition-colors"
            style={{ fontFamily: 'DM Mono, monospace' }}>
            cancel
          </button>
          <button onClick={handleSave} disabled={saving || geocoding}
            className="flex-1 py-2 text-sm text-stone-50 rounded-lg transition-opacity disabled:opacity-50"
            style={{ background: activeMoodColor, fontFamily: 'DM Mono, monospace' }}>
            {saving ? 'saving...' : geocoding ? 'detecting...' : 'save memory'}
          </button>
        </div>
      </div>
    </div>
  )
}

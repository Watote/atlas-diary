import { useState, useMemo } from 'react'
import { Camera, Download, Upload, BarChart2, X } from 'lucide-react'
import { MOODS, getMoodFromEntry, WEATHER_OPTIONS } from '../utils/moods.js'

export default function Sidebar({
  entries,
  activeId,
  onSelectEntry,
  onExportJSON,
  onImportJSON,
  onShowStats,
  onFilterChange,
}) {
  const [moodFilter, setMoodFilter] = useState(null)
  const [yearFilter, setYearFilter] = useState('all')
  const [weatherFilter, setWeatherFilter] = useState('')
  const [minRating, setMinRating] = useState(0)

  // Derive available years from entries for the year dropdown.
  // useMemo recalculates only when entries change — not on every render.
  const years = useMemo(() => {
    const ys = new Set(
      entries
        .filter(e => e.date)
        .map(e => e.date.slice(0, 4))
    )
    return ['all', ...Array.from(ys).sort().reverse()]
  }, [entries])

  // Compute filtered entries and notify parent (App.jsx) of the filtered IDs.
  // The parent passes filteredIds to MapView to dim non-matching pins.
  const filteredEntries = useMemo(() => {
    let result = [...entries].reverse()
    if (moodFilter !== null) result = result.filter(e => e.moodIdx === moodFilter)
    if (yearFilter !== 'all') result = result.filter(e => e.date?.startsWith(yearFilter))
    if (weatherFilter) result = result.filter(e => e.weather === weatherFilter)
    if (minRating > 0) result = result.filter(e => (e.rating || 0) >= minRating)
    const ids = (moodFilter !== null || yearFilter !== 'all' || weatherFilter || minRating > 0)
      ? new Set(result.map(e => e.id))
      : null
    onFilterChange(ids)
    return result
  }, [entries, moodFilter, yearFilter, weatherFilter, minRating])

  const toggleMoodFilter = (idx) => {
    setMoodFilter(prev => prev === idx ? null : idx)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      if (e.target.files[0]) onImportJSON(e.target.files[0])
    }
    input.click()
  }

  return (
    <div className="w-56 flex flex-col border-l border-stone-200 bg-stone-50 flex-shrink-0">

      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs tracking-widest text-stone-400 uppercase">memories</span>
          <span className="text-xs text-stone-300">{entries.length}</span>
        </div>

        {/* Mood filter chips */}
        <div className="flex gap-1.5 flex-wrap mb-2">
          {MOODS.map((mood, i) => (
            <button
              key={mood.label}
              onClick={() => toggleMoodFilter(i)}
              title={mood.label}
              className="w-5 h-5 rounded-full transition-transform hover:scale-110 flex-shrink-0"
              style={{
                background: mood.color,
                outline: moodFilter === i ? `2px solid ${mood.color}` : 'none',
                outlineOffset: '2px',
                opacity: moodFilter !== null && moodFilter !== i ? 0.35 : 1,
              }}
            />
          ))}
          {moodFilter !== null && (
            <button onClick={() => setMoodFilter(null)} className="text-stone-400 hover:text-stone-600 transition-colors ml-auto" title="clear">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Weather filter */}
        <div className="flex gap-1 flex-wrap mb-2">
          {WEATHER_OPTIONS.slice(0, 4).map(w => (
            <button key={w.value}
              onClick={() => setWeatherFilter(prev => prev === w.value ? '' : w.value)}
              title={w.label}
              className="text-base transition-transform hover:scale-110"
              style={{ opacity: weatherFilter && weatherFilter !== w.value ? 0.3 : 1 }}
            >{w.emoji}</button>
          ))}
          {WEATHER_OPTIONS.slice(4).map(w => (
            <button key={w.value}
              onClick={() => setWeatherFilter(prev => prev === w.value ? '' : w.value)}
              title={w.label}
              className="text-base transition-transform hover:scale-110"
              style={{ opacity: weatherFilter && weatherFilter !== w.value ? 0.3 : 1 }}
            >{w.emoji}</button>
          ))}
          {weatherFilter && (
            <button onClick={() => setWeatherFilter('')} className="text-stone-400 hover:text-stone-600 ml-auto"><X size={12} /></button>
          )}
        </div>

        {/* Rating filter */}
        <div className="flex items-center gap-1 mb-2">
          {[1,2,3,4,5].map(s => (
            <button key={s} onClick={() => setMinRating(prev => prev === s ? 0 : s)}
              className="text-sm transition-transform hover:scale-110"
              style={{ color: s <= minRating ? '#d4a843' : '#d6d3cd' }}>★</button>
          ))}
          {minRating > 0 && (
            <span className="text-xs text-stone-400 ml-1">{minRating}+</span>
          )}
        </div>

        {/* Year filter */}
        {years.length > 1 && (
          <select
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
            className="w-full text-xs border border-stone-200 rounded-md px-2 py-1 bg-white text-stone-600 focus:outline-none focus:border-stone-400"
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            {years.map(y => (
              <option key={y} value={y}>{y === 'all' ? 'all years' : y}</option>
            ))}
          </select>
        )}
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto">
        {filteredEntries.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <Camera size={24} className="mx-auto mb-2 text-stone-300" />
            <p className="text-xs text-stone-400 leading-relaxed">
              {entries.length === 0
                ? 'no entries yet.\nclick the map to begin.'
                : 'no entries match this filter.'}
            </p>
          </div>
        ) : (
          filteredEntries.map(entry => {
            const mood = getMoodFromEntry(entry)
            const dateStr = entry.date
              ? new Date(entry.date + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
              : ''
            return (
              <button
                key={entry.id}
                onClick={() => onSelectEntry(entry.id)}
                className={`w-full text-left px-4 py-3 border-b border-stone-100 transition-colors hover:bg-stone-100 ${
                  activeId === entry.id ? 'bg-stone-100' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                    style={{ background: mood.color }}
                  />
                  <div className="min-w-0">
                    <p
                      className="text-sm text-stone-800 truncate"
                      style={{ fontFamily: 'Playfair Display, serif' }}
                    >
                      {entry.location}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">{dateStr}</p>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t border-stone-200 px-4 py-3 space-y-1">
        <button
          onClick={onShowStats}
          className="w-full flex items-center gap-2 text-xs text-stone-500 hover:text-stone-800 py-1.5 transition-colors"
          style={{ fontFamily: 'DM Mono, monospace' }}
        >
          <BarChart2 size={13} />
          stats
        </button>
        <button
          onClick={onExportJSON}
          className="w-full flex items-center gap-2 text-xs text-stone-500 hover:text-stone-800 py-1.5 transition-colors"
          style={{ fontFamily: 'DM Mono, monospace' }}
        >
          <Download size={13} />
          export json
        </button>
        <button
          onClick={handleImport}
          className="w-full flex items-center gap-2 text-xs text-stone-500 hover:text-stone-800 py-1.5 transition-colors"
          style={{ fontFamily: 'DM Mono, monospace' }}
        >
          <Upload size={13} />
          import json
        </button>
      </div>
    </div>
  )
}

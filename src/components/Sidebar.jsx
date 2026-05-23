import { useState, useMemo } from 'react'
import { Camera, Download, Upload, BarChart2, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { MOODS, getMoodFromEntry, WEATHER_OPTIONS } from '../utils/moods.js'

// SidebarContent is the full panel content — shared between desktop sidebar and mobile floating panel
export function SidebarContent({
  entries, activeId, onSelectEntry,
  onExportJSON, onImportJSON, onShowStats,
  onFilterChange, onSignOut, userEmail,
}) {
  const [moodFilter, setMoodFilter] = useState(null)
  const [yearFilter, setYearFilter] = useState('all')
  const [weatherFilter, setWeatherFilter] = useState('')
  const [minRating, setMinRating] = useState(0)

  const years = useMemo(() => {
    const ys = new Set(entries.filter(e => e.date).map(e => e.date.slice(0, 4)))
    return ['all', ...Array.from(ys).sort().reverse()]
  }, [entries])

  const filteredEntries = useMemo(() => {
    let result = [...entries].reverse()
    if (moodFilter !== null) result = result.filter(e => e.moodIdx === moodFilter)
    if (yearFilter !== 'all') result = result.filter(e => e.date?.startsWith(yearFilter))
    if (weatherFilter) result = result.filter(e => e.weather === weatherFilter)
    if (minRating > 0) result = result.filter(e => (e.rating || 0) >= minRating)
    const ids = (moodFilter !== null || yearFilter !== 'all' || weatherFilter || minRating > 0)
      ? new Set(result.map(e => e.id)) : null
    onFilterChange(ids)
    return result
  }, [entries, moodFilter, yearFilter, weatherFilter, minRating])

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = (e) => { if (e.target.files[0]) onImportJSON(e.target.files[0]) }
    input.click()
  }

  const activeFilters = (moodFilter !== null ? 1 : 0) + (yearFilter !== 'all' ? 1 : 0) + (weatherFilter ? 1 : 0) + (minRating > 0 ? 1 : 0)

  return (
    <div className="flex flex-col h-full">
      {/* Filters header */}
      <div className="px-4 py-3 border-b border-stone-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs tracking-widest text-stone-400 uppercase">memories</span>
          <div className="flex items-center gap-2">
            {activeFilters > 0 && (
              <button onClick={() => { setMoodFilter(null); setYearFilter('all'); setWeatherFilter(''); setMinRating(0) }}
                className="text-xs text-stone-400 hover:text-stone-600 flex items-center gap-0.5">
                <X size={11} />{activeFilters}
              </button>
            )}
            <span className="text-xs text-stone-300">{entries.length}</span>
          </div>
        </div>

        {/* Mood chips */}
        <div className="flex gap-1.5 flex-wrap mb-2">
          {MOODS.map((mood, i) => (
            <button key={mood.label} onClick={() => setMoodFilter(prev => prev === i ? null : i)}
              title={mood.label}
              className="w-4.5 h-4.5 rounded-full transition-transform hover:scale-110 flex-shrink-0"
              style={{
                width: 18, height: 18,
                background: mood.color,
                outline: moodFilter === i ? `2px solid ${mood.color}` : 'none',
                outlineOffset: '2px',
                opacity: moodFilter !== null && moodFilter !== i ? 0.3 : 1,
              }} />
          ))}
        </div>

        {/* Weather */}
        <div className="flex gap-1 flex-wrap mb-2">
          {WEATHER_OPTIONS.map(w => (
            <button key={w.value}
              onClick={() => setWeatherFilter(prev => prev === w.value ? '' : w.value)}
              title={w.label} className="text-sm transition-transform hover:scale-110"
              style={{ opacity: weatherFilter && weatherFilter !== w.value ? 0.25 : 1 }}>
              {w.emoji}
            </button>
          ))}
        </div>

        {/* Stars */}
        <div className="flex items-center gap-0.5 mb-2">
          {[1,2,3,4,5].map(s => (
            <button key={s} onClick={() => setMinRating(prev => prev === s ? 0 : s)}
              style={{ color: s <= minRating ? '#d4a843' : '#d6d3cd', fontSize: 14 }}>★</button>
          ))}
          {minRating > 0 && <span className="text-xs text-stone-400 ml-1">{minRating}+</span>}
        </div>

        {/* Year */}
        {years.length > 1 && (
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            className="w-full text-xs border border-stone-200 rounded-md px-2 py-1 bg-white text-stone-600 focus:outline-none"
            style={{ fontFamily: 'DM Mono, monospace' }}>
            {years.map(y => <option key={y} value={y}>{y === 'all' ? 'all years' : y}</option>)}
          </select>
        )}
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto">
        {filteredEntries.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <Camera size={22} className="mx-auto mb-2 text-stone-300" />
            <p className="text-xs text-stone-400 leading-relaxed">
              {entries.length === 0 ? 'no entries yet.' : 'no matches.'}
            </p>
          </div>
        ) : filteredEntries.map(entry => {
          const mood = getMoodFromEntry(entry)
          const dateStr = entry.date
            ? new Date(entry.date + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
            : ''
          return (
            <button key={entry.id} onClick={() => onSelectEntry(entry.id)}
              className={`w-full text-left px-4 py-3 border-b border-stone-100 transition-colors hover:bg-stone-100 ${activeId === entry.id ? 'bg-stone-100' : ''}`}>
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: mood.color }} />
                <div className="min-w-0">
                  <p className="text-sm text-stone-800 truncate" style={{ fontFamily: 'Playfair Display, serif' }}>
                    {entry.location}
                  </p>
                  <p className="text-xs text-stone-400 mt-0.5">{dateStr}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-stone-200 px-4 py-3 space-y-1 flex-shrink-0">
        <button onClick={onShowStats}
          className="w-full flex items-center gap-2 text-xs text-stone-500 hover:text-stone-800 py-1.5 transition-colors"
          style={{ fontFamily: 'DM Mono, monospace' }}>
          <BarChart2 size={13} />stats
        </button>
        <button onClick={onExportJSON}
          className="w-full flex items-center gap-2 text-xs text-stone-500 hover:text-stone-800 py-1.5 transition-colors"
          style={{ fontFamily: 'DM Mono, monospace' }}>
          <Download size={13} />export json
        </button>
        <button onClick={handleImport}
          className="w-full flex items-center gap-2 text-xs text-stone-500 hover:text-stone-800 py-1.5 transition-colors"
          style={{ fontFamily: 'DM Mono, monospace' }}>
          <Upload size={13} />import json
        </button>
        {onSignOut && (
          <button onClick={onSignOut}
            className="w-full flex items-center gap-2 text-xs text-stone-400 hover:text-rose-500 py-1.5 transition-colors"
            style={{ fontFamily: 'DM Mono, monospace' }}>
            sign out
          </button>
        )}
      </div>
    </div>
  )
}

// Desktop sidebar — collapsible icon rail ↔ full panel
export default function Sidebar(props) {
  const [open, setOpen] = useState(true)

  return (
    <div
      className="flex-shrink-0 flex border-l border-stone-200 bg-stone-50 transition-all duration-300"
      style={{ width: open ? 224 : 48 }}
    >
      {/* Collapsed icon rail */}
      {!open && (
        <div className="w-full flex flex-col items-center py-3 gap-4">
          <button onClick={() => setOpen(true)}
            className="text-stone-400 hover:text-stone-700 transition-colors p-1" title="expand">
            <ChevronLeft size={16} />
          </button>
          <button onClick={props.onShowStats} className="text-stone-400 hover:text-stone-700 transition-colors p-1" title="stats">
            <BarChart2 size={16} />
          </button>
          <button onClick={props.onExportJSON} className="text-stone-400 hover:text-stone-700 transition-colors p-1" title="export">
            <Download size={16} />
          </button>
          {/* Memory count badge */}
          {props.entries.length > 0 && (
            <span className="text-xs text-stone-400 bg-stone-200 rounded-full w-6 h-6 flex items-center justify-center font-medium">
              {props.entries.length}
            </span>
          )}
        </div>
      )}

      {/* Expanded full panel */}
      {open && (
        <div className="flex flex-col w-full overflow-hidden">
          {/* Collapse toggle */}
          <div className="flex items-center justify-between px-4 pt-3 pb-0 flex-shrink-0">
            <span className="text-xs tracking-widest text-stone-400 uppercase">memories</span>
            <button onClick={() => setOpen(false)}
              className="text-stone-300 hover:text-stone-600 transition-colors p-0.5" title="collapse">
              <ChevronRight size={15} />
            </button>
          </div>
          <SidebarContent {...props} />
        </div>
      )}
    </div>
  )
}

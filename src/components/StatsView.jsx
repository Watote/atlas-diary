import { useMemo } from 'react'
import { X, Globe, Camera, Calendar, Map } from 'lucide-react'
import { MOODS, getMood } from '../utils/moods.js'

export default function StatsView({ entries, onClose }) {
  const stats = useMemo(() => {
    if (entries.length === 0) return null

    // Countries: try to extract from location string after the last comma.
    // e.g. "Cebu, Philippines" → "Philippines"
    const countries = new Set(
      entries
        .map(e => {
          const parts = e.location.split(',')
          return parts.length > 1 ? parts[parts.length - 1].trim() : e.location.trim()
        })
        .filter(Boolean)
    )

    // Memories per year
    const byYear = {}
    entries.forEach(e => {
      if (e.date) {
        const y = e.date.slice(0, 4)
        byYear[y] = (byYear[y] || 0) + 1
      }
    })
    const years = Object.entries(byYear).sort(([a], [b]) => a.localeCompare(b))
    const maxYear = Math.max(...Object.values(byYear), 1)

    // Mood breakdown
    const byMood = new Array(MOODS.length).fill(0)
    entries.forEach(e => { byMood[e.moodIdx] = (byMood[e.moodIdx] || 0) + 1 })

    // Most visited location
    const locationCounts = {}
    entries.forEach(e => { locationCounts[e.location] = (locationCounts[e.location] || 0) + 1 })
    const topLocation = Object.entries(locationCounts).sort(([,a],[,b]) => b - a)[0]

    // Timeline (last 10 entries sorted by date)
    const timeline = [...entries]
      .filter(e => e.date)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-8)

    return { countries, years, maxYear, byMood, topLocation, timeline }
  }, [entries])

  return (
    <div
      className="absolute inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(26,22,18,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-stone-50 rounded-xl border border-stone-200 w-full max-w-lg shadow-xl overflow-hidden max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-stone-200 flex items-center justify-between flex-shrink-0">
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: 18 }}>
            your atlas, at a glance
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {!stats || entries.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-stone-400">
              add some memories first to see stats.
            </div>
          ) : (
            <div className="px-6 py-5 space-y-6">

              {/* Top metrics */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Globe, label: 'countries', value: stats.countries.size },
                  { icon: Camera, label: 'memories', value: entries.length },
                  { icon: Calendar, label: 'years', value: stats.years.length },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="bg-white border border-stone-200 rounded-lg p-3 text-center">
                    <Icon size={16} className="mx-auto mb-1 text-stone-400" />
                    <div className="text-2xl font-medium text-stone-800">{value}</div>
                    <div className="text-xs text-stone-400 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {/* Memories per year — horizontal bar chart */}
              {stats.years.length > 0 && (
                <div>
                  <p className="text-xs tracking-widest text-stone-400 uppercase mb-3">memories per year</p>
                  <div className="space-y-2">
                    {stats.years.map(([year, count]) => (
                      <div key={year} className="flex items-center gap-3">
                        <span className="text-xs text-stone-400 w-10 flex-shrink-0">{year}</span>
                        <div className="flex-1 bg-stone-200 rounded-full overflow-hidden h-2">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.round((count / stats.maxYear) * 100)}%`,
                              background: '#8a7f72',
                            }}
                          />
                        </div>
                        <span className="text-xs text-stone-500 w-4 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mood breakdown */}
              <div>
                <p className="text-xs tracking-widest text-stone-400 uppercase mb-3">mood breakdown</p>
                <div className="space-y-2">
                  {MOODS.map((mood, i) => {
                    const count = stats.byMood[i] || 0
                    const pct = entries.length > 0 ? Math.round((count / entries.length) * 100) : 0
                    return (
                      <div key={mood.label} className="flex items-center gap-3">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: mood.color }}
                        />
                        <span className="text-xs text-stone-500 w-14">{mood.label}</span>
                        <div className="flex-1 bg-stone-200 rounded-full overflow-hidden h-1.5">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: mood.color }}
                          />
                        </div>
                        <span className="text-xs text-stone-400 w-8 text-right">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Timeline strip */}
              {stats.timeline.length > 0 && (
                <div>
                  <p className="text-xs tracking-widest text-stone-400 uppercase mb-3">recent timeline</p>
                  <div className="relative">
                    {/* Connecting line */}
                    <div className="absolute left-2 top-2 bottom-2 w-px bg-stone-200" />
                    <div className="space-y-3">
                      {stats.timeline.map(entry => {
                        const mood = getMood(entry.moodIdx)
                        const dateStr = new Date(entry.date + 'T00:00:00').toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })
                        return (
                          <div key={entry.id} className="flex items-start gap-3 pl-1">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5 relative z-10"
                              style={{ background: mood.color }}
                            />
                            <div>
                              <p className="text-sm text-stone-700" style={{ fontFamily: 'Playfair Display, serif' }}>
                                {entry.location}
                              </p>
                              <p className="text-xs text-stone-400">{dateStr}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Countries list */}
              <div>
                <p className="text-xs tracking-widest text-stone-400 uppercase mb-3">countries visited</p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(stats.countries).sort().map(country => (
                    <span
                      key={country}
                      className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-600 border border-stone-200"
                      style={{ fontFamily: 'DM Mono, monospace' }}
                    >
                      {country}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

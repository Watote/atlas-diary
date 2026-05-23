import { useState, useEffect, useRef } from 'react'
import { X, ChevronUp, MapPin } from 'lucide-react'
import { getMoodFromEntry, MOODS } from '../utils/moods.js'
import { SidebarContent } from './Sidebar.jsx'

// FloatingPanel — mobile only
// Collapsed: a small pill bottom-right showing memory count + mood dots
// Expanded: a card that slides up showing full memories list + filters
export default function FloatingPanel({
  entries, activeId, onSelectEntry,
  onExportJSON, onImportJSON, onShowStats,
  onFilterChange, onSignOut, userEmail,
}) {
  const [expanded, setExpanded] = useState(false)
  const panelRef = useRef(null)

  // Close on outside tap
  useEffect(() => {
    if (!expanded) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setExpanded(false)
      }
    }
    document.addEventListener('touchstart', handler)
    document.addEventListener('mousedown', handler)
    return () => {
      document.removeEventListener('touchstart', handler)
      document.removeEventListener('mousedown', handler)
    }
  }, [expanded])

  // Close when an entry is selected
  const handleSelectEntry = (id) => {
    onSelectEntry(id)
    setExpanded(false)
  }

  // Mood dots from recent entries (up to 5)
  const recentMoods = entries.slice(0, 5).map(e => getMoodFromEntry(e).color)

  return (
    <div ref={panelRef} style={{ position: 'absolute', bottom: 'calc(24px + env(safe-area-inset-bottom))', right: 16, zIndex: 40 }}>

      {/* Expanded panel */}
      {expanded && (
        <div
          style={{
            position: 'absolute',
            bottom: 56,
            right: 0,
            width: 'min(320px, calc(100vw - 32px))',
            maxHeight: 'calc(100vh - 160px)',
            background: '#faf9f7',
            borderRadius: 16,
            border: '0.5px solid #e2d9cc',
            boxShadow: '0 8px 32px rgba(26,22,18,0.18)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'panelSlideUp 0.2s ease',
          }}
        >
          {/* Panel header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px 0',
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, color: '#1a1612' }}>
              atlas <em style={{ color: '#a89d8f' }}>diary</em>
            </span>
            <button onClick={() => setExpanded(false)}
              style={{ color: '#a89d8f', padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>

          {/* Sidebar content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <SidebarContent
              entries={entries}
              activeId={activeId}
              onSelectEntry={handleSelectEntry}
              onExportJSON={onExportJSON}
              onImportJSON={onImportJSON}
              onShowStats={() => { onShowStats(); setExpanded(false) }}
              onFilterChange={onFilterChange}
              onSignOut={onSignOut}
              userEmail={userEmail}
            />
          </div>
        </div>
      )}

      {/* Floating pill button */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: expanded ? '#352f28' : '#faf9f7',
          border: '0.5px solid',
          borderColor: expanded ? '#352f28' : '#c9bfb2',
          borderRadius: 24,
          padding: '8px 14px',
          boxShadow: '0 2px 12px rgba(26,22,18,0.15)',
          cursor: 'pointer',
          transition: 'all 0.2s',
          minWidth: 64,
          fontFamily: 'DM Mono, monospace',
        }}
      >
        {/* Mood dots */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {recentMoods.length > 0
            ? recentMoods.map((color, i) => (
                <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'block', flexShrink: 0 }} />
              ))
            : <MapPin size={13} color={expanded ? '#f5f0ea' : '#8a7f72'} />
          }
        </div>
        {/* Count */}
        <span style={{ fontSize: 11, color: expanded ? '#f5f0ea' : '#6b6058', fontWeight: 500 }}>
          {entries.length}
        </span>
        <ChevronUp size={12} color={expanded ? '#f5f0ea' : '#8a7f72'}
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      <style>{`
        @keyframes panelSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

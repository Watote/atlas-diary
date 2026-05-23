import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from './utils/supabase.js'
import MapView from './components/MapView.jsx'
import Sidebar from './components/Sidebar.jsx'
import FloatingPanel from './components/FloatingPanel.jsx'
import AddMemoryModal from './components/AddMemoryModal.jsx'
import DetailCard from './components/DetailCard.jsx'
import StatsView from './components/StatsView.jsx'
import SearchBar from './components/SearchBar.jsx'
import AuthScreen from './components/AuthScreen.jsx'
import { useEntries } from './hooks/useEntries.js'
import { useIsMobile } from './hooks/useIsMobile.js'
import { Search, Plus, X } from 'lucide-react'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="h-screen flex items-center justify-center bg-stone-100">
        <div className="text-xs text-stone-400" style={{ fontFamily: 'DM Mono, monospace' }}>loading...</div>
      </div>
    )
  }

  if (!session) return <AuthScreen />
  return <AtlasDiary userId={session.user.id} userEmail={session.user.email} />
}

function AtlasDiary({ userId, userEmail }) {
  const {
    entries, loading,
    addEntry, deleteEntry, updateEntry,
    uploadPhotos, getPhotoUrls,
    exportJSON, importJSON,
  } = useEntries(userId)

  const isMobile = useIsMobile()
  const [pendingCoords, setPendingCoords] = useState(null)
  const [activeEntryId, setActiveEntryId] = useState(null)
  const [showStats, setShowStats] = useState(false)
  const [filteredIds, setFilteredIds] = useState(null)
  const [prefillLocation, setPrefillLocation] = useState('')
  const [apiReady, setApiReady] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const mapRef = useRef(null)

  const handleMapReady = useCallback((map) => { mapRef.current = map }, [])
  const handleApiLoaded = useCallback(() => setApiReady(true), [])

  const handleMapClick = useCallback((lat, lng) => {
    if (pendingCoords || activeEntryId || showStats) return
    setPrefillLocation('')
    setPendingCoords({ lat, lng })
  }, [pendingCoords, activeEntryId, showStats])

  const handlePinClick = useCallback((id) => {
    setActiveEntryId(id); setPendingCoords(null)
  }, [])

  const handleSaveEntry = useCallback(async (data) => {
    await addEntry(data)
    setPendingCoords(null); setPrefillLocation('')
  }, [addEntry])

  const handleDeleteEntry = useCallback(async (id) => {
    await deleteEntry(id); setActiveEntryId(null)
  }, [deleteEntry])

  const handleSelectEntry = useCallback((id) => {
    const entry = entries.find(e => e.id === id)
    if (entry && mapRef.current) {
      mapRef.current.panTo({ lat: entry.lat, lng: entry.lng })
      mapRef.current.setZoom(10)
    }
    setActiveEntryId(id)
  }, [entries])

  const closeAll = useCallback(() => {
    setPendingCoords(null); setActiveEntryId(null)
    setShowStats(false); setPrefillLocation('')
    setMobileSearchOpen(false)
  }, [])

  const handlePlaceSelected = useCallback(({ lat, lng, label }) => {
    closeAll(); setPrefillLocation(label || '')
    setPendingCoords({ lat, lng })
    setMobileSearchOpen(false)
  }, [closeAll])

  const handleSignOut = async () => { await supabase.auth.signOut() }

  const activeEntry = entries.find(e => e.id === activeEntryId) || null

  const sidebarProps = {
    entries, activeId: activeEntryId,
    onSelectEntry: handleSelectEntry,
    onExportJSON: exportJSON,
    onImportJSON: importJSON,
    onShowStats: () => { closeAll(); setShowStats(true) },
    onFilterChange: setFilteredIds,
    onSignOut: handleSignOut,
    userEmail,
  }

  return (
    <div className="flex flex-col h-screen bg-stone-50" style={{ fontFamily: 'DM Mono, monospace' }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-stone-200 flex-shrink-0 z-20 gap-3">
        <h1 className="text-lg text-stone-800 flex-shrink-0"
          style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, letterSpacing: '-0.3px' }}>
          atlas <em className="text-stone-400">diary</em>
        </h1>

        {/* Desktop search — full width */}
        {!isMobile && (
          <div className="flex-1 max-w-sm">
            <SearchBar onPlaceSelected={handlePlaceSelected} mapRef={mapRef} apiReady={apiReady} />
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mobile search toggle */}
          {isMobile && (
            <button onClick={() => setMobileSearchOpen(prev => !prev)}
              className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 transition-colors">
              {mobileSearchOpen ? <X size={18} /> : <Search size={18} />}
            </button>
          )}

          {/* Desktop: memory count + add button */}
          {!isMobile && (
            <>
              <span className="text-xs text-stone-400">
                {loading ? '...' : `${entries.length} ${entries.length === 1 ? 'memory' : 'memories'}`}
              </span>
              <button onClick={() => { closeAll(); setPendingCoords({ lat: 20, lng: 10 }) }}
                className="text-xs px-3 py-1.5 border border-stone-300 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors">
                + add
              </button>
            </>
          )}

          {/* User menu — desktop only */}
          {!isMobile && (
            <div className="relative group">
              <button className="text-xs px-2.5 py-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 border border-stone-200 truncate max-w-[100px]">
                {userEmail.split('@')[0]}
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden w-40 hidden group-hover:block z-50">
                <div className="px-3 py-2 border-b border-stone-100">
                  <p className="text-xs text-stone-400 truncate">{userEmail}</p>
                </div>
                <button onClick={handleSignOut}
                  className="w-full text-left px-3 py-2 text-xs text-stone-600 hover:bg-stone-50 transition-colors"
                  style={{ fontFamily: 'DM Mono, monospace' }}>
                  sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Mobile search overlay */}
      {isMobile && mobileSearchOpen && (
        <div className="px-4 py-2 border-b border-stone-200 bg-stone-50 z-30 flex-shrink-0">
          <SearchBar onPlaceSelected={handlePlaceSelected} mapRef={mapRef} apiReady={apiReady} />
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 relative">

          {/* Map hint */}
          {!pendingCoords && !activeEntry && !showStats && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 text-xs text-stone-500 bg-stone-50/90 px-4 py-1.5 rounded-full border border-stone-200 pointer-events-none whitespace-nowrap"
              style={{ fontFamily: 'DM Mono, monospace' }}>
              {isMobile ? 'tap the map to drop a memory' : 'click anywhere on the map · or search above'}
            </div>
          )}

          <MapView
            entries={entries}
            filteredIds={filteredIds}
            onMapClick={handleMapClick}
            onPinClick={handlePinClick}
            onMapReady={handleMapReady}
            onApiLoaded={handleApiLoaded}
          />

          {/* Mobile: floating + button bottom-left */}
          {isMobile && !pendingCoords && !activeEntry && !showStats && (
            <button
              onClick={() => { closeAll(); setPendingCoords({ lat: 20, lng: 10 }) }}
              style={{
                position: 'absolute',
                bottom: 'calc(24px + env(safe-area-inset-bottom))',
                left: 16, zIndex: 40,
                width: 48, height: 48, borderRadius: '50%',
                background: '#352f28', color: '#f5f0ea',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(26,22,18,0.25)',
                transition: 'transform 0.15s',
              }}
              onTouchStart={e => e.currentTarget.style.transform = 'scale(0.93)'}
              onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Plus size={22} />
            </button>
          )}

          {/* Mobile: floating panel bottom-right */}
          {isMobile && (
            <FloatingPanel {...sidebarProps} />
          )}

          {/* Overlays */}
          {pendingCoords && (
            <AddMemoryModal
              coords={pendingCoords}
              prefillLocation={prefillLocation}
              onSave={handleSaveEntry}
              onClose={() => { setPendingCoords(null); setPrefillLocation('') }}
            />
          )}

          {activeEntry && (
            <DetailCard
              entry={activeEntry}
              onClose={() => setActiveEntryId(null)}
              onDelete={handleDeleteEntry}
              onUpdate={updateEntry}
              getPhotoUrls={getPhotoUrls}
              uploadPhotos={uploadPhotos}
            />
          )}

          {showStats && (
            <StatsView entries={entries} onClose={() => setShowStats(false)} />
          )}
        </div>

        {/* Desktop sidebar — hidden on mobile */}
        {!isMobile && (
          <Sidebar {...sidebarProps} />
        )}
      </div>
    </div>
  )
}

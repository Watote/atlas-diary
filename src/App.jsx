import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from './utils/supabase.js'
import MapView from './components/MapView.jsx'
import Sidebar from './components/Sidebar.jsx'
import AddMemoryModal from './components/AddMemoryModal.jsx'
import DetailCard from './components/DetailCard.jsx'
import StatsView from './components/StatsView.jsx'
import SearchBar from './components/SearchBar.jsx'
import AuthScreen from './components/AuthScreen.jsx'
import { useEntries } from './hooks/useEntries.js'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading, null = logged out

  // Listen for auth state changes (login, logout, token refresh)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Show loading spinner while checking auth
  if (session === undefined) {
    return (
      <div className="h-screen flex items-center justify-center bg-stone-100">
        <div className="text-xs text-stone-400" style={{ fontFamily: 'DM Mono, monospace' }}>loading...</div>
      </div>
    )
  }

  // Show auth screen if not logged in
  if (!session) return <AuthScreen />

  // Logged in — show the app
  return <AtlasDiary userId={session.user.id} userEmail={session.user.email} />
}

// Main app — only rendered when user is authenticated
function AtlasDiary({ userId, userEmail }) {
  const {
    entries, loading,
    addEntry, deleteEntry, updateEntry,
    uploadPhotos, getPhotoUrls,
    exportJSON, importJSON,
  } = useEntries(userId)

  const [pendingCoords, setPendingCoords] = useState(null)
  const [activeEntryId, setActiveEntryId] = useState(null)
  const [showStats, setShowStats] = useState(false)
  const [filteredIds, setFilteredIds] = useState(null)
  const [prefillLocation, setPrefillLocation] = useState('')
  const [apiReady, setApiReady] = useState(false)
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
    setPendingCoords(null); setActiveEntryId(null); setShowStats(false); setPrefillLocation('')
  }, [])

  const handlePlaceSelected = useCallback(({ lat, lng, label }) => {
    closeAll(); setPrefillLocation(label || ''); setPendingCoords({ lat, lng })
  }, [closeAll])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const activeEntry = entries.find(e => e.id === activeEntryId) || null

  return (
    <div className="flex flex-col h-screen bg-stone-50" style={{ fontFamily: 'DM Mono, monospace' }}>
      <header className="flex items-center justify-between px-5 py-2.5 border-b border-stone-200 flex-shrink-0 z-20 gap-4">
        <h1 className="text-lg text-stone-800 flex-shrink-0"
          style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, letterSpacing: '-0.3px' }}>
          atlas <em className="text-stone-400">diary</em>
        </h1>

        <div className="flex-1 max-w-sm">
          <SearchBar onPlaceSelected={handlePlaceSelected} mapRef={mapRef} apiReady={apiReady} />
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-stone-400 hidden sm:block">
            {loading ? 'loading...' : `${entries.length} ${entries.length === 1 ? 'memory' : 'memories'}`}
          </span>
          <button onClick={() => { closeAll(); setPendingCoords({ lat: 20, lng: 10 }) }}
            className="text-xs px-3 py-1.5 border border-stone-300 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors">
            + add
          </button>
          {/* User menu */}
          <div className="relative group">
            <button className="text-xs px-2.5 py-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors border border-stone-200 truncate max-w-[120px]">
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
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 relative">
          {!pendingCoords && !activeEntry && !showStats && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-xs text-stone-500 bg-stone-50/90 px-4 py-1.5 rounded-full border border-stone-200 pointer-events-none"
              style={{ fontFamily: 'DM Mono, monospace' }}>
              click anywhere on the map · or search a city above
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

        <Sidebar
          entries={entries}
          activeId={activeEntryId}
          onSelectEntry={handleSelectEntry}
          onExportJSON={exportJSON}
          onImportJSON={importJSON}
          onShowStats={() => { closeAll(); setShowStats(true) }}
          onFilterChange={setFilteredIds}
        />
      </div>
    </div>
  )
}

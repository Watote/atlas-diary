import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, MapPin, X, Navigation } from 'lucide-react'

// SearchBar receives `apiReady` (boolean) from App.jsx which is set true only after
// useJsApiLoader in MapView signals the SDK is fully loaded.
// This avoids the race condition where we try to instantiate Places services
// before window.google.maps.places exists.

export default function SearchBar({ onPlaceSelected, mapRef, apiReady }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const [mode, setMode] = useState('place')
  const [coordError, setCoordError] = useState('')

  const autocompleteService = useRef(null)
  const placesService = useRef(null)
  const sessionToken = useRef(null)
  const debounceTimer = useRef(null)
  const inputRef = useRef(null)

  // Init Places services only once apiReady flips to true.
  // At this point window.google.maps.places is guaranteed to exist.
  useEffect(() => {
    if (!apiReady) return
    if (!window.google?.maps?.places) return

    autocompleteService.current = new window.google.maps.places.AutocompleteService()
    sessionToken.current = new window.google.maps.places.AutocompleteSessionToken()
    // PlacesService requires a map instance or a dummy DOM node
    const dummy = document.createElement('div')
    placesService.current = new window.google.maps.places.PlacesService(dummy)
  }, [apiReady])

  const looksLikeCoords = (str) =>
    /^-?\d+(\.\d+)?[\s,]+-?\d+(\.\d+)?$/.test(str.trim())

  const handleInputChange = (e) => {
    const val = e.target.value
    setQuery(val)
    setCoordError('')

    if (!val.trim()) {
      setSuggestions([])
      setMode('place')
      return
    }

    if (looksLikeCoords(val)) {
      setMode('coords')
      setSuggestions([])
      return
    }

    setMode('place')

    if (!autocompleteService.current) return

    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      if (val.length < 2) return
      setLoading(true)
      autocompleteService.current.getPlacePredictions(
        { input: val, sessionToken: sessionToken.current },
        (predictions, status) => {
          setLoading(false)
          if (
            status === window.google.maps.places.PlacesServiceStatus.OK &&
            predictions?.length
          ) {
            setSuggestions(predictions.slice(0, 5))
          } else {
            setSuggestions([])
          }
        }
      )
    }, 300)
  }

  const handleSuggestionClick = useCallback((prediction) => {
    if (!placesService.current) return
    setSuggestions([])
    setQuery(prediction.description)
    setLoading(true)

    placesService.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['geometry', 'name', 'formatted_address'],
        sessionToken: sessionToken.current,
      },
      (place, status) => {
        setLoading(false)
        // Refresh token after completed session (Google billing optimisation)
        sessionToken.current = new window.google.maps.places.AutocompleteSessionToken()

        if (
          status === window.google.maps.places.PlacesServiceStatus.OK &&
          place?.geometry?.location
        ) {
          const lat = place.geometry.location.lat()
          const lng = place.geometry.location.lng()

          onPlaceSelected({ lat, lng, label: prediction.description })

          if (mapRef?.current) {
            if (place.geometry.viewport) {
              mapRef.current.fitBounds(place.geometry.viewport)
            } else {
              mapRef.current.panTo({ lat, lng })
              mapRef.current.setZoom(12)
            }
          }
        }
      }
    )
  }, [onPlaceSelected, mapRef])

  const handleCoordsSubmit = useCallback(() => {
    const parts = query.trim().split(/[\s,]+/)
    if (parts.length !== 2) {
      setCoordError('Format: lat, lng  e.g. 16.87, 96.19')
      return
    }
    const lat = parseFloat(parts[0])
    const lng = parseFloat(parts[1])
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setCoordError('Invalid — lat must be -90 to 90, lng -180 to 180')
      return
    }
    setCoordError('')
    onPlaceSelected({ lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` })
    if (mapRef?.current) {
      mapRef.current.panTo({ lat, lng })
      mapRef.current.setZoom(12)
    }
  }, [query, onPlaceSelected, mapRef])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (mode === 'coords') handleCoordsSubmit()
      else if (suggestions.length > 0) handleSuggestionClick(suggestions[0])
    }
    if (e.key === 'Escape') {
      setSuggestions([])
      setQuery('')
      inputRef.current?.blur()
    }
  }

  const clear = () => {
    setQuery('')
    setSuggestions([])
    setCoordError('')
    setMode('place')
    inputRef.current?.focus()
  }

  return (
    <div className="relative" style={{ zIndex: 50 }}>
      <div
        className={`flex items-center gap-2 bg-white border rounded-xl px-3 py-2 shadow-sm transition-colors ${
          focused ? 'border-stone-400' : 'border-stone-200'
        }`}
        style={{ minWidth: 280 }}
      >
        {mode === 'coords'
          ? <Navigation size={14} className="text-stone-400 flex-shrink-0" />
          : <Search size={14} className="text-stone-400 flex-shrink-0" />
        }
        <input
          ref={inputRef}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => { setFocused(false) }, 180)}
          placeholder={apiReady ? 'search city · or paste lat, lng' : 'loading search...'}
          disabled={!apiReady}
          className="flex-1 bg-transparent text-xs text-stone-700 placeholder-stone-400 focus:outline-none disabled:opacity-50"
          style={{ fontFamily: 'DM Mono, monospace', minWidth: 0 }}
        />
        {loading && (
          <div className="w-3 h-3 border border-stone-300 border-t-stone-600 rounded-full animate-spin flex-shrink-0" />
        )}
        {query && !loading && (
          <button onClick={clear} className="text-stone-300 hover:text-stone-500 flex-shrink-0 transition-colors">
            <X size={13} />
          </button>
        )}
        {mode === 'coords' && query && (
          <button
            onClick={handleCoordsSubmit}
            className="text-xs px-2.5 py-1 bg-stone-800 text-stone-100 rounded-lg hover:bg-stone-700 transition-colors flex-shrink-0"
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            go
          </button>
        )}
      </div>

      {/* Coord parse error */}
      {coordError && (
        <div className="absolute top-full left-0 mt-1.5 text-xs text-rose-600 bg-white border border-rose-200 rounded-lg px-3 py-2 shadow-sm w-full z-50">
          {coordError}
        </div>
      )}

      {/* Autocomplete dropdown */}
      {suggestions.length > 0 && focused && (
        <div
          className="absolute top-full left-0 mt-1.5 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden w-full z-50"
        >
          {suggestions.map((s, i) => (
            <button
              key={s.place_id}
              onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(s) }}
              className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-0"
            >
              <MapPin size={12} className="text-stone-300 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div
                  className="text-xs text-stone-700 truncate"
                  style={{ fontFamily: 'DM Mono, monospace' }}
                >
                  {s.structured_formatting?.main_text || s.description}
                </div>
                {s.structured_formatting?.secondary_text && (
                  <div className="text-xs text-stone-400 truncate mt-0.5">
                    {s.structured_formatting.secondary_text}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

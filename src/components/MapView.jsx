import { useCallback, useRef, useState, useEffect } from 'react'
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api'
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES, MAP_STYLE, SATELLITE_LABEL_STYLE, MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, MAP_DEFAULT_MIN_ZOOM } from '../constants/googleMaps.js'
import { getMoodFromEntry } from '../utils/moods.js'

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' }

// We define libraries as a module-level constant so the array reference never changes.
// If passed inline, React re-renders cause useJsApiLoader to re-initialize the SDK every render,
// which throws a "LoadScript has been reloaded" warning and breaks the map.
const LIBS = GOOGLE_MAPS_LIBRARIES

function Pin({ entry, dimmed, onClick }) {
  const mood = getMoodFromEntry(entry)
  const [hovered, setHovered] = useState(false)

  return (
    <OverlayView
      position={{ lat: entry.lat, lng: entry.lng }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={(w, h) => ({ x: -w / 2, y: -h })}
    >
      <div
        onClick={(e) => { e.stopPropagation(); onClick(entry.id) }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'pointer', position: 'relative', display: 'inline-block' }}
      >
        <svg
          width="28" height="38"
          viewBox="0 0 28 38"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            transform: hovered ? 'scale(1.25) translateY(-3px)' : 'scale(1)',
            transition: 'transform 0.15s ease',
            filter: dimmed ? 'grayscale(1) opacity(0.25)' : 'none',
            display: 'block',
          }}
        >
          <ellipse cx="14" cy="36" rx="5" ry="1.8" fill="rgba(0,0,0,0.18)" />
          <circle cx="14" cy="13" r="13" fill={mood.color} opacity="0.93" />
          <circle cx="14" cy="13" r="5.5" fill="white" opacity="0.8" />
          <line x1="14" y1="26" x2="14" y2="34" stroke={mood.color} strokeWidth="2.5" strokeLinecap="round" />
        </svg>

        {hovered && (
          <div style={{
            position: 'absolute',
            bottom: '110%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(26,22,18,0.88)',
            color: '#f5f0ea',
            borderRadius: 6,
            padding: '5px 10px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 999,
          }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 12 }}>{entry.location}</div>
            {entry.date && (
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, opacity: 0.65, marginTop: 2 }}>
                {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
              </div>
            )}
          </div>
        )}
      </div>
    </OverlayView>
  )
}

export default function MapView({ entries, filteredIds, onMapClick, onPinClick, onMapReady, onApiLoaded }) {
  const mapRef = useRef(null)
  const isFiltered = filteredIds !== null
  const [mapTypeId, setMapTypeId] = useState('roadmap')
  const isMobile = window.innerWidth < 768

  // Pick style based on current map type:
  // roadmap → warm analog style
  // satellite/hybrid → white labels on dark imagery
  // terrain → warm analog style
  const activeStyle = (mapTypeId === 'satellite' || mapTypeId === 'hybrid')
    ? SATELLITE_LABEL_STYLE
    : MAP_STYLE

  // useJsApiLoader loads the Google Maps JS SDK exactly once.
  // The `libraries` array MUST be a stable reference (module-level constant above),
  // otherwise it triggers a reload warning on every render.
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBS,
  })

  // Once the SDK is loaded, notify parent so SearchBar can init Places services
  useEffect(() => {
    if (isLoaded && onApiLoaded) {
      onApiLoaded()
    }
  }, [isLoaded, onApiLoaded])

  const onLoad = useCallback((map) => {
    mapRef.current = map
    if (onMapReady) onMapReady(map)
  }, [onMapReady])

  const onUnmount = useCallback(() => {
    mapRef.current = null
  }, [])

  const handleMapClick = useCallback((e) => {
    onMapClick(e.latLng.lat(), e.latLng.lng())
  }, [onMapClick])

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-stone-100">
        <div className="text-center px-8">
          <p className="text-sm text-stone-600 mb-2">Failed to load Google Maps.</p>
          <p className="text-xs text-stone-400">Check that your API key has Maps JavaScript API enabled and no HTTP referrer restrictions blocking localhost.</p>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-stone-100">
        <div className="text-xs text-stone-400" style={{ fontFamily: 'DM Mono, monospace' }}>
          loading map...
        </div>
      </div>
    )
  }

  return (
    <GoogleMap
      mapContainerStyle={MAP_CONTAINER_STYLE}
      center={MAP_DEFAULT_CENTER}
      zoom={MAP_DEFAULT_ZOOM}
      options={{
        styles: activeStyle,
        disableDefaultUI: isMobile,   // kills ALL default controls on mobile in one shot
        streetViewControl: false,
        mapTypeControl: !isMobile,
        mapTypeControlOptions: isMobile ? {} : {
          style: 1,
          position: 1,
          mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain'],
        },
        fullscreenControl: false,
        clickableIcons: false,
        gestureHandling: 'greedy',
        zoomControl: !isMobile,
        zoomControlOptions: isMobile ? {} : { position: 9 },
        minZoom: MAP_DEFAULT_MIN_ZOOM,
        restriction: {
          latLngBounds: { north: 83, south: -83, east: 179, west: -179 },
          strictBounds: true,
        },
      }}
      onClick={handleMapClick}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onMapTypeIdChanged={() => {
        if (mapRef.current) setMapTypeId(mapRef.current.getMapTypeId())
      }}
    >
      {entries.map(entry => (
        <Pin
          key={entry.id}
          entry={entry}
          dimmed={isFiltered && !filteredIds.has(entry.id)}
          onClick={onPinClick}
        />
      ))}
    </GoogleMap>
  )
}

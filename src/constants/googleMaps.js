export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

// Libraries we need loaded from the Google Maps JS SDK
export const GOOGLE_MAPS_LIBRARIES = ['places', 'geometry']

// Custom warm analog map style — mutes colors, removes POI clutter, keeps roads subtle
// This gives the same analog-film feel as the Leaflet sepia filter, but baked into the tiles
export const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#e8e0d4' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b6058' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f0ea' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c8bfb0' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#a89d8f' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#ddd5c8' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#c8d5b5' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#7a9a6a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f0e8dc' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#d4c8b8' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a7f72' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e0d0b8' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#c8b89a' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#6b6058' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#a8c4d0' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5a8090' }] },
]

// Satellite / hybrid view label overrides — white text with dark stroke for readability
// These are applied via a second style array passed to mapTypeId-specific options
export const SATELLITE_LABEL_STYLE = [
  { elementType: 'labels.text.fill', stylers: [{ color: '#f5f0ea' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1612' }, { weight: 2.5 }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#f0ebe3' }] },
  { featureType: 'administrative', elementType: 'labels.text.stroke', stylers: [{ color: '#1a1612' }, { weight: 2 }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#f5f0ea' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#1a1612' }, { weight: 2 }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
]

export const MAP_DEFAULT_CENTER = { lat: 20, lng: 10 }
export const MAP_DEFAULT_ZOOM = 2
export const MAP_DEFAULT_MIN_ZOOM = 3

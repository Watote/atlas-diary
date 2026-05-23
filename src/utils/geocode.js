import { GOOGLE_MAPS_API_KEY } from '../constants/googleMaps.js'

// Reverse geocode a lat/lng using Google Geocoding API.
// Returns { nativeName, englishName, displayName, country, formattedAddress }
// We make TWO requests: one without language (gets native script), one with language=en (gets English).
export async function reverseGeocode(lat, lng) {
  const base = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`

  try {
    const [nativeRes, englishRes] = await Promise.all([
      fetch(`${base}&language=`),        // Native language of the place
      fetch(`${base}&language=en`),      // English transliteration
    ])
    const [nativeData, englishData] = await Promise.all([
      nativeRes.json(),
      englishRes.json(),
    ])

    if (nativeData.status !== 'OK' && englishData.status !== 'OK') {
      return null
    }

    // Pick the best result — prefer locality (city), then administrative area, then country
    const preferredTypes = [
      'locality',
      'administrative_area_level_2',
      'administrative_area_level_1',
      'country',
    ]

    function getBestResult(results) {
      for (const type of preferredTypes) {
        const found = results.find(r => r.types.includes(type))
        if (found) return found
      }
      return results[0] // fallback to first result
    }

    const nativeResult = getBestResult(nativeData.results || [])
    const englishResult = getBestResult(englishData.results || [])

    // Extract just the city/locality name from address_components
    function extractComponent(result, type) {
      if (!result) return ''
      const comp = result.address_components?.find(c => c.types.includes(type))
      return comp?.long_name || ''
    }

    function extractShortComponent(result, type) {
      if (!result) return ''
      const comp = result.address_components?.find(c => c.types.includes(type))
      return comp?.short_name || comp?.long_name || ''
    }

    // Try to get the city name specifically
    const nativeCity =
      extractComponent(nativeResult, 'locality') ||
      extractComponent(nativeResult, 'administrative_area_level_2') ||
      extractComponent(nativeResult, 'administrative_area_level_1') ||
      nativeResult?.address_components?.[0]?.long_name || ''

    const englishCity =
      extractComponent(englishResult, 'locality') ||
      extractComponent(englishResult, 'administrative_area_level_2') ||
      extractComponent(englishResult, 'administrative_area_level_1') ||
      englishResult?.address_components?.[0]?.long_name || ''

    const country = extractComponent(englishResult, 'country')
    const countryCode = extractShortComponent(englishResult, 'country')

    // Build the display name:
    // If native and english are same (already in latin), show just one.
    // If different, show "English (Native)" e.g. "Tokyo (東京)"
    const nativeName = nativeCity
    const englishName = englishCity

    let displayName
    if (!nativeName || nativeName.toLowerCase() === englishName.toLowerCase()) {
      displayName = englishName ? `${englishName}, ${country}` : country
    } else {
      displayName = `${englishName} (${nativeName}), ${country}`
    }

    return {
      nativeName,
      englishName,
      displayName,
      country,
      countryCode,
      formattedAddress: englishResult?.formatted_address || '',
    }
  } catch (err) {
    console.error('Geocoding error:', err)
    return null
  }
}

// Fetch elevation for a lat/lng using Google Elevation API
// Returns elevation in meters, or null on failure
export async function getElevation(lat, lng) {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
    )
    const data = await res.json()
    if (data.status === 'OK' && data.results?.[0]) {
      return Math.round(data.results[0].elevation)
    }
    return null
  } catch {
    return null
  }
}

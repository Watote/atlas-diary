// Reverse geocode a lat/lng with the Maps JavaScript API Geocoder.
// (The REST geocode/elevation endpoints refuse browser keys with website restrictions,
//  so everything goes through google.maps services, which accept them.)
// Returns { nativeName, englishName, displayName, country, countryCode, formattedAddress }

// Main language per country, used to get the place name in its own script (e.g. 東京, กรุงเทพ)
const LOCAL_LANG = {
  JP: 'ja', CN: 'zh-CN', TW: 'zh-TW', HK: 'zh-HK', MO: 'zh-HK', KR: 'ko', TH: 'th', MM: 'my', LA: 'lo',
  KH: 'km', VN: 'vi', RU: 'ru', UA: 'uk', BY: 'be', BG: 'bg', RS: 'sr', MK: 'mk', GR: 'el', IL: 'iw',
  SA: 'ar', AE: 'ar', EG: 'ar', JO: 'ar', QA: 'ar', KW: 'ar', OM: 'ar', BH: 'ar', MA: 'ar', IR: 'fa',
  IN: 'hi', NP: 'ne', LK: 'si', BD: 'bn', PK: 'ur', GE: 'ka', AM: 'hy', MN: 'mn', ET: 'am',
}

async function geocodeLatLng(lat, lng, language) {
  const g = window.google?.maps
  if (!g?.Geocoder) return { status: 'NOT_LOADED', results: [] }
  try {
    const res = await new g.Geocoder().geocode({ location: { lat, lng }, ...(language ? { language } : {}) })
    return { status: res.results?.length ? 'OK' : 'ZERO_RESULTS', results: res.results || [] }
  } catch {
    return { status: 'ERROR', results: [] }
  }
}

export async function reverseGeocode(lat, lng) {
  try {
    const englishData = await geocodeLatLng(lat, lng, 'en')
    const cc = englishData.results
      .flatMap(r => r.address_components || [])
      .find(c => c.types.includes('country'))?.short_name
    const nativeData = cc && LOCAL_LANG[cc] ? await geocodeLatLng(lat, lng, LOCAL_LANG[cc]) : englishData

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

// Elevation in metres via the Maps JavaScript API ElevationService, or null on failure
export async function getElevation(lat, lng) {
  try {
    const g = window.google?.maps
    if (!g?.ElevationService) return null
    const res = await new g.ElevationService().getElevationForLocations({ locations: [{ lat, lng }] })
    const e = res.results?.[0]?.elevation
    return Number.isFinite(e) ? Math.round(e) : null
  } catch {
    return null
  }
}

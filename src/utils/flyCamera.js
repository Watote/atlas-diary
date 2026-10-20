// Smooth "fly to" camera for Google Maps, based on van Wijk & Nuij (2003),
// the same zoom-out / glide / zoom-in curve used by Mapbox flyTo and Google Earth.
// Works on raster maps (zoom snaps to whole levels) and is fully smooth on
// vector maps (Map ID), where tilt and heading are animated too.

const TILE = 256
const RHO = 1.42

function project({ lat, lng }) {
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180)
  return {
    x: ((lng + 180) / 360) * TILE,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE,
  }
}

export function distanceKm(a, b) {
  const R = 6371, r = d => (d * Math.PI) / 180
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Great-circle interpolation (matches geodesic polylines)
export function interpolate(a, b, f) {
  const g = window.google?.maps?.geometry?.spherical
  if (g) {
    const p = g.interpolate(new window.google.maps.LatLng(a), new window.google.maps.LatLng(b), f)
    return { lat: p.lat(), lng: p.lng() }
  }
  let dl = b.lng - a.lng
  if (dl > 180) dl -= 360
  if (dl < -180) dl += 360
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + dl * f }
}

export function headingDeg(a, b) {
  const g = window.google?.maps?.geometry?.spherical
  if (g) return g.computeHeading(new window.google.maps.LatLng(a), new window.google.maps.LatLng(b))
  return (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI
}

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * Animate the map camera from its current view to `to`.
 * Options: zoom (target zoom), tilt (target tilt, vector maps), onFrame(f, center) progress callback,
 * isCancelled() → stop early, speed (higher = faster), minMs / maxMs duration clamps.
 * Resolves true when finished, false if cancelled.
 */
export function flyCamera(map, to, { zoom: z1 = 10, tilt: tilt1 = 0, heading: head1, onFrame, isCancelled, speed = 1.1, minMs = 1400, maxMs = 5200 } = {}) {
  return new Promise(resolve => {
    const c = map.getCenter()
    const from = c ? { lat: c.lat(), lng: c.lng() } : to
    const z0 = map.getZoom() ?? z1
    const tilt0 = map.getTilt?.() ?? 0
    const head0 = map.getHeading?.() ?? 0
    const W = Math.max(map.getDiv()?.clientWidth || 800, 320)

    const p0 = project(from), p1 = project(to)
    let dx = p1.x - p0.x
    if (dx > TILE / 2) dx -= TILE
    if (dx < -TILE / 2) dx += TILE
    const dy = p1.y - p0.y
    const u1 = Math.hypot(dx, dy)

    // viewport width in world units at each zoom
    const w0 = W / TILE / Math.pow(2, z0) * TILE
    const w1 = W / TILE / Math.pow(2, z1) * TILE
    const rho2 = RHO * RHO

    let S, wAt, uAt
    if (u1 < 1e-6) {
      const k = w1 < w0 ? -1 : 1
      S = Math.abs(Math.log(w1 / w0)) / RHO
      uAt = () => 0
      wAt = s => w0 * Math.exp(k * RHO * s)
    } else {
      const b = i => {
        const wi = i ? w1 : w0
        return (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * wi * rho2 * u1)
      }
      const r = i => { const bi = b(i); return Math.log(Math.sqrt(bi * bi + 1) - bi) }
      const r0 = r(0), r1 = r(1)
      S = (r1 - r0) / RHO
      if (!isFinite(S)) S = Math.abs(Math.log(w1 / w0)) / RHO
      wAt = s => w0 * (Math.cosh(r0) / Math.cosh(RHO * s + r0))
      uAt = s => (w0 * (Math.cosh(r0) * Math.tanh(RHO * s + r0) - Math.sinh(r0))) / rho2
    }

    const duration = Math.max(minMs, Math.min(maxMs, (S / speed) * 1000))
    let headDelta = head1 == null ? 0 : ((head1 - head0 + 540) % 360) - 180
    const t0 = performance.now()

    const frame = (now) => {
      if (isCancelled?.()) return resolve(false)
      const t = Math.min(1, (now - t0) / duration)
      const e = easeInOut(t)
      const s = e * S
      const f = u1 < 1e-6 ? 1 : Math.min(1, Math.max(0, uAt(s) / u1))
      const center = interpolate(from, to, f)
      const zoom = z0 + Math.log2(w0 / wAt(s))
      // flat while travelling, tilt in during the last third
      const tilt = t < 0.66 ? tilt0 * (1 - t / 0.66) : tilt1 * ((t - 0.66) / 0.34)
      const heading = head0 + headDelta * e
      map.moveCamera({ center, zoom: isFinite(zoom) ? zoom : z1, tilt, heading })
      onFrame?.(f, center)
      if (t < 1) requestAnimationFrame(frame)
      else { map.moveCamera({ center: to, zoom: z1, tilt: tilt1, heading: head0 + headDelta }); resolve(true) }
    }
    requestAnimationFrame(frame)
  })
}

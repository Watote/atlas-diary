import { useEffect, useRef, useState } from 'react'
import { Eye } from 'lucide-react'

// Small Street View of a memory's spot. Loads only when asked (each load uses Maps quota).
export default function StreetViewMini({ lat, lng, height = 170 }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('idle') // idle | loading | ok | none
  const boxRef = useRef(null)

  useEffect(() => { setOpen(false); setStatus('idle') }, [lat, lng])

  useEffect(() => {
    if (!open || !boxRef.current || !window.google?.maps) return
    setStatus('loading')
    const svc = new window.google.maps.StreetViewService()
    svc.getPanorama({ location: { lat, lng }, radius: 1500, source: 'outdoor' }, (data, st) => {
      if (st !== 'OK' || !data?.location?.latLng || !boxRef.current) { setStatus('none'); return }
      new window.google.maps.StreetViewPanorama(boxRef.current, {
        pano: data.location.pano,
        pov: { heading: 0, pitch: 0 },
        zoom: 0,
        addressControl: false, fullscreenControl: true, motionTracking: false,
        linksControl: true, panControl: false, zoomControl: false, enableCloseButton: false,
        showRoadLabels: false,
      })
      setStatus('ok')
    })
  }, [open, lat, lng])

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 border border-stone-200 rounded-lg px-3 py-2 w-full justify-center hover:bg-stone-100 transition-colors"
        style={{ fontFamily: 'DM Mono, monospace' }}>
        <Eye size={13} /> look around (street view)
      </button>
    )
  }
  return (
    <div className="relative rounded-xl overflow-hidden border border-stone-200 bg-stone-200" style={{ height }}>
      <div ref={boxRef} className="absolute inset-0" />
      {status !== 'ok' && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-stone-500 text-center px-4"
          style={{ fontFamily: 'DM Mono, monospace' }}>
          {status === 'none' ? 'no street view near this spot' : 'loading street view…'}
        </div>
      )}
    </div>
  )
}

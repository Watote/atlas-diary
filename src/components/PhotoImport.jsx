// UI for adding memories from photos: the "photos" button, drop overlay, status pill and no-location tray.
import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Images, X, Loader2, MapPin, Upload } from 'lucide-react'
import { IMAGE_ACCEPT } from '../utils/photoImport.js'
import { GOOGLE_OAUTH_CLIENT_ID } from '../utils/googlePhotos.js'
import { MAX_PHOTOS } from '../constants/limits.js'

const mono = { fontFamily: 'DM Mono, monospace' }
export const googlePhotosEnabled = !!GOOGLE_OAUTH_CLIENT_ID

// Desktop header button or mobile round button. Opens a tiny menu when Google Photos is set up.
export function AddPhotosButton({ onFiles, onGoogle, mobile = false, style }) {
  const inputRef = useRef()
  const [open, setOpen] = useState(false)
  const boxRef = useRef()

  useEffect(() => {
    if (!open) return
    const off = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', off)
    return () => document.removeEventListener('pointerdown', off)
  }, [open])

  const pickDevice = () => { setOpen(false); inputRef.current?.click() }
  const click = () => (googlePhotosEnabled ? setOpen(v => !v) : pickDevice())

  return (
    <div ref={boxRef} className="relative" style={style}>
      {mobile ? (
        <button onClick={click} aria-label="add memories from photos" title="add memories from photos"
          style={{
            width: 44, height: 44, borderRadius: '50%', background: '#f5f0ea', color: '#352f28',
            border: '1px solid #e7e3dd', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(26,22,18,0.18)',
          }}>
          <ImagePlus size={19} />
        </button>
      ) : (
        <button onClick={click} title="add memories from photos — location & date are read from each photo"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-stone-300 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors">
          <ImagePlus size={13} /> photos
        </button>
      )}
      <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} multiple className="hidden"
        onChange={(e) => { onFiles(e.target.files); e.target.value = '' }} />

      {open && (
        <div className={`absolute z-50 w-60 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden ${mobile ? 'bottom-full mb-2 left-0' : 'top-full mt-1 right-0'}`} style={mono}>
          <button onClick={pickDevice} className="w-full flex items-center gap-2 text-left px-3 py-2.5 text-xs text-stone-700 hover:bg-stone-50">
            <Upload size={13} className="text-stone-400" /> from this device
          </button>
          <button onClick={() => { setOpen(false); onGoogle() }} className="w-full flex items-center gap-2 text-left px-3 py-2.5 text-xs text-stone-700 hover:bg-stone-50 border-t border-stone-100">
            <Images size={13} className="text-stone-400" /> from Google Photos
          </button>
          <p className="px-3 py-2 text-[10px] leading-snug text-stone-400 bg-stone-50 border-t border-stone-100">
            {mobile ? 'location & date come from each photo.' : 'tip: drag photos straight onto the map.'} Google Photos removes locations, so you'll place those yourself.
          </p>
        </div>
      )}
    </div>
  )
}

export function DropOverlay({ show }) {
  if (!show) return null
  return (
    <div className="absolute inset-0 z-[900] pointer-events-none flex items-center justify-center"
      style={{ background: 'rgba(245,240,234,0.72)', backdropFilter: 'blur(2px)' }}>
      <div className="m-6 rounded-2xl border-2 border-dashed border-stone-400 px-10 py-8 text-center bg-stone-50/90 shadow-lg" style={mono}>
        <ImagePlus size={28} className="mx-auto mb-2 text-stone-500" />
        <p className="text-sm text-stone-700">drop photos to add memories</p>
        <p className="text-xs text-stone-400 mt-1">location & date are read from each photo</p>
      </div>
    </div>
  )
}

export function ImportStatus({ status, onCancel, onDismiss }) {
  if (!status) return null
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[950] max-w-[92%]" style={mono}>
      <div className={`flex items-center gap-2 text-xs px-3.5 py-2 rounded-full border shadow-md ${status.error ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-stone-50/95 border-stone-200 text-stone-700'}`}>
        {status.busy && <Loader2 size={13} className="animate-spin flex-shrink-0 text-stone-400" />}
        <span className="truncate">{status.text}</span>
        {status.action?.href && (
          <a href={status.action.href} target="_blank" rel="noopener" className="flex-shrink-0 px-2.5 py-0.5 rounded-full text-stone-50" style={{ background: '#352f28' }}>
            {status.action.label}
          </a>
        )}
        {status.action?.run && (
          <button onClick={status.action.run} className="flex-shrink-0 px-2.5 py-0.5 rounded-full text-stone-50" style={{ background: '#352f28' }}>
            {status.action.label}
          </button>
        )}
        <button onClick={status.cancel ? onCancel : onDismiss} aria-label={status.cancel ? 'cancel' : 'dismiss'} className="flex-shrink-0 text-stone-400 hover:text-stone-700">
          <X size={13} />
        </button>
      </div>
    </div>
  )
}

// Photos without a location: pick some, then tap the map or search a place to pin them.
export function PhotoTray({ tray, selected, onToggle, onClear, isMobile }) {
  if (!tray.length) return null
  const n = selected.length
  return (
    <div className="absolute left-1/2 -translate-x-1/2 z-[30] w-[min(560px,calc(100%-24px))]"
      style={{ ...mono, bottom: isMobile ? 'calc(130px + max(env(safe-area-inset-bottom), 34px))' : '1rem', animation: 'cardIn .25s ease-out' }}>
      <div className="bg-stone-50/97 border border-stone-200 rounded-2xl shadow-lg px-3 pt-2.5 pb-3" style={{ background: 'rgba(250,250,249,0.97)' }}>
        <div className="flex items-center gap-2 mb-2">
          <MapPin size={13} className="text-stone-500 flex-shrink-0" />
          <p className="text-xs text-stone-700 flex-1 leading-snug">
            {n
              ? <>{isMobile ? 'tap' : 'click'} the map or search a place to pin <b className="font-medium">{n} {n === 1 ? 'photo' : 'photos'}</b></>
              : 'select photos to pin'}
          </p>
          <span className="text-[10px] text-stone-400 flex-shrink-0">{tray.length} waiting</span>
          <button onClick={onClear} title="clear these photos" aria-label="clear photos" className="text-stone-400 hover:text-stone-700 flex-shrink-0"><X size={14} /></button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'thin' }}>
          {tray.map(t => (
            <button key={t.id} onClick={() => onToggle(t.id)} title={t.date || 'no date'}
              className="relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all"
              style={{ outline: t.selected ? '2px solid #352f28' : '1px solid #e7e3dd', outlineOffset: t.selected ? 1 : 0, opacity: t.selected ? 1 : 0.55 }}>
              <img src={t.url} alt="" className="w-full h-full object-cover" draggable={false} />
              {t.selected && <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full text-[9px] text-white flex items-center justify-center" style={{ background: '#352f28' }}>✓</span>}
              {t.date && <span className="absolute bottom-0 inset-x-0 text-[8px] text-white bg-black/40 leading-tight py-px">{t.date.slice(5)}</span>}
            </button>
          ))}
        </div>
        {n >= MAX_PHOTOS && <p className="text-[10px] text-stone-400 mt-1">up to {MAX_PHOTOS} photos per memory</p>}
      </div>
    </div>
  )
}

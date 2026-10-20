// Google Photos Picker API: let the user pick photos in Google Photos, then download them.
// Docs: https://developers.google.com/photos/picker
// Needs VITE_GOOGLE_OAUTH_CLIENT_ID (a Web OAuth client) and the Photos Picker API enabled.
// Note: Google removes GPS from picked photos, so they arrive without a location (the date is kept).

export const GOOGLE_OAUTH_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || ''
const SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'
const API = 'https://photospicker.googleapis.com/v1'

let gisPromise = null
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => { gisPromise = null; reject(new Error('Could not load Google sign-in')) }
      document.head.appendChild(s)
    })
  }
  return gisPromise
}

let cachedToken = null // { token, exp }
async function getToken() {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token
  await loadGis()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) return reject(new Error(resp.error_description || resp.error || 'Google sign-in was cancelled'))
        cachedToken = { token: resp.access_token, exp: Date.now() + (Number(resp.expires_in) || 3000) * 1000 }
        resolve(resp.access_token)
      },
      error_callback: (err) => reject(new Error(err?.message || 'Google sign-in was cancelled')),
    })
    client.requestAccessToken({ prompt: cachedToken ? '' : 'consent' })
  })
}

async function api(path, token, opts = {}) {
  const r = await fetch(API + path, { ...opts, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } })
  if (!r.ok) throw new Error(`Google Photos error ${r.status}`)
  return r.status === 204 ? null : r.json()
}

const secs = (d) => (parseFloat(String(d || '').replace('s', '')) || 0) * 1000

// Step 1 (on a click): sign in if needed and create a picking session → { token, session }
export async function startPicking({ maxItems = 30 } = {}) {
  const token = await getToken()
  const session = await api('/sessions', token, { method: 'POST', body: JSON.stringify({ pickingConfig: { maxItemCount: String(maxItems) } }) })
  return { token, session }
}

// Step 2 (on a second click, so the browser allows the pop-up): open the picker window
export function openPicker(session) {
  return window.open(session.pickerUri + '/autoclose', 'gphotos-picker', 'width=1000,height=760')
}

// Step 3: wait for the user to finish, then download the picked photos.
// Resolves { files: File[], dates: Map<File, isoString> }.
export async function finishPicking({ token, session }, { onStatus, isCancelled } = {}) {
  const started = Date.now()
  let s = session
  const timeout = secs(session.pollingConfig?.timeoutIn) || 20 * 60_000
  while (!s.mediaItemsSet) {
    await new Promise(r => setTimeout(r, Math.max(2000, secs(s.pollingConfig?.pollInterval) || 3000)))
    if (isCancelled?.()) throw new Error('cancelled')
    if (Date.now() - started > timeout) throw new Error('Google Photos picking timed out')
    s = await api(`/sessions/${session.id}`, token)
  }

  onStatus?.('downloading photos…')
  const items = []
  let pageToken = ''
  do {
    const q = `?sessionId=${encodeURIComponent(session.id)}&pageSize=100${pageToken ? `&pageToken=${pageToken}` : ''}`
    const page = await api(`/mediaItems${q}`, token)
    items.push(...(page.mediaItems || []))
    pageToken = page.nextPageToken || ''
  } while (pageToken)

  const files = []
  const dates = new Map()
  for (const it of items) {
    const mf = it.mediaFile
    if (!mf || it.type === 'VIDEO' || !(mf.mimeType || '').startsWith('image/')) continue
    // =w2560-h2560 keeps files a sensible size for the diary (originals can be 20+ MB)
    const r = await fetch(`${mf.baseUrl}=w2560-h2560`, { headers: { Authorization: `Bearer ${token}` } })
    if (!r.ok) continue
    const blob = await r.blob()
    const f = new File([blob], mf.filename || `google-photo-${files.length + 1}.jpg`, { type: blob.type || mf.mimeType || 'image/jpeg' })
    files.push(f)
    if (it.createTime) dates.set(f, it.createTime)
    onStatus?.(`downloading photos… ${files.length}/${items.length}`)
  }
  api(`/sessions/${session.id}`, token, { method: 'DELETE' }).catch(() => {})
  return { files, dates }
}

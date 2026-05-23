import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase.js'

// Convert snake_case DB row → camelCase entry object used throughout the app
function rowToEntry(row) {
  return {
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    location: row.location,
    nativeName: row.native_name || '',
    englishName: row.english_name || '',
    country: row.country || '',
    elevation: row.elevation ?? null,
    date: row.date,
    note: row.note || '',
    moodIdx: row.mood_idx ?? 0,
    customMoodColor: row.custom_mood_color || null,
    customMoodLabel: row.custom_mood_label || null,
    weather: row.weather || '',
    companions: row.companions || '',
    rating: row.rating || 0,
    tags: row.tags || [],
    photoCount: row.photo_count || 0,
    createdAt: row.created_at,
  }
}

// Convert camelCase entry → snake_case for DB insert/update
function entryToRow(entry, userId) {
  return {
    id: entry.id,
    user_id: userId,
    lat: entry.lat,
    lng: entry.lng,
    location: entry.location,
    native_name: entry.nativeName,
    english_name: entry.englishName,
    country: entry.country,
    elevation: entry.elevation,
    date: entry.date,
    note: entry.note,
    mood_idx: entry.moodIdx,
    custom_mood_color: entry.customMoodColor,
    custom_mood_label: entry.customMoodLabel,
    weather: entry.weather,
    companions: entry.companions,
    rating: entry.rating,
    tags: entry.tags,
    photo_count: entry.photoCount,
  }
}

export function useEntries(userId) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  // Load all entries for this user on mount
  useEffect(() => {
    if (!userId) return
    setLoading(true)
    supabase
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('Load error:', error)
        else setEntries((data || []).map(rowToEntry))
        setLoading(false)
      })
  }, [userId])

  const addEntry = useCallback(async ({
    lat, lng, location, nativeName, englishName, country, elevation,
    date, note, moodIdx, customMoodColor, customMoodLabel,
    weather, companions, rating, tags, photos
  }) => {
    const id = Date.now().toString()
    let photoCount = 0

    // Upload photos to Supabase Storage
    if (photos?.length > 0) {
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i]
        const path = `${userId}/${id}-${i}`
        const { error } = await supabase.storage.from('photos').upload(path, file)
        if (!error) photoCount++
      }
    }

    const entry = {
      id, lat, lng, location: location || 'unnamed place',
      nativeName: nativeName || '', englishName: englishName || '',
      country: country || '', elevation: elevation ?? null,
      date, note: note || '', moodIdx: moodIdx ?? 0,
      customMoodColor: customMoodColor || null,
      customMoodLabel: customMoodLabel || null,
      weather: weather || '', companions: companions || '',
      rating: rating || 0, tags: tags || [],
      photoCount,
    }

    const { error } = await supabase
      .from('entries')
      .insert(entryToRow(entry, userId))

    if (error) { console.error('Insert error:', error); return null }

    setEntries(prev => [entry, ...prev])
    return entry
  }, [userId])

  const deleteEntry = useCallback(async (id) => {
    const entry = entries.find(e => e.id === id)
    if (!entry) return

    // Delete photos from storage
    if (entry.photoCount > 0) {
      const paths = Array.from({ length: entry.photoCount }, (_, i) => `${userId}/${id}-${i}`)
      await supabase.storage.from('photos').remove(paths)
    }

    await supabase.from('entries').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }, [entries, userId])

  const updateEntry = useCallback(async (id, changes) => {
    // Convert camelCase changes to snake_case for DB
    const dbChanges = {}
    if (changes.location !== undefined) dbChanges.location = changes.location
    if (changes.date !== undefined) dbChanges.date = changes.date
    if (changes.note !== undefined) dbChanges.note = changes.note
    if (changes.moodIdx !== undefined) dbChanges.mood_idx = changes.moodIdx
    if (changes.customMoodColor !== undefined) dbChanges.custom_mood_color = changes.customMoodColor
    if (changes.customMoodLabel !== undefined) dbChanges.custom_mood_label = changes.customMoodLabel
    if (changes.weather !== undefined) dbChanges.weather = changes.weather
    if (changes.companions !== undefined) dbChanges.companions = changes.companions
    if (changes.rating !== undefined) dbChanges.rating = changes.rating
    if (changes.tags !== undefined) dbChanges.tags = changes.tags
    if (changes.photoCount !== undefined) dbChanges.photo_count = changes.photoCount

    const { error } = await supabase.from('entries').update(dbChanges).eq('id', id)
    if (error) { console.error('Update error:', error); return }

    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...changes } : e))
  }, [])

  // Upload additional photos during edit
  const uploadPhotos = useCallback(async (entryId, startIdx, photos) => {
    for (let i = 0; i < photos.length; i++) {
      const path = `${userId}/${entryId}-${startIdx + i}`
      await supabase.storage.from('photos').upload(path, photos[i])
    }
  }, [userId])

  // Get signed URLs for photos (Supabase Storage private bucket needs signed URLs)
  const getPhotoUrls = useCallback(async (entryId, count) => {
    const urls = []
    for (let i = 0; i < count; i++) {
      const path = `${userId}/${entryId}-${i}`
      const { data } = await supabase.storage.from('photos').createSignedUrl(path, 3600)
      if (data?.signedUrl) urls.push(data.signedUrl)
    }
    return urls
  }, [userId])

  const exportJSON = useCallback(() => {
    const data = JSON.stringify(entries, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `atlas-diary-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [entries])

  const importJSON = useCallback((file) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target.result)
        if (!Array.isArray(imported)) return
        const existingIds = new Set(entries.map(e => e.id))
        const newOnes = imported.filter(e => !existingIds.has(e.id))
        for (const entry of newOnes) {
          await supabase.from('entries').insert(entryToRow(entry, userId))
        }
        setEntries(prev => [...newOnes, ...prev])
      } catch { alert('Invalid JSON file.') }
    }
    reader.readAsText(file)
  }, [entries, userId])

  return {
    entries, loading,
    addEntry, deleteEntry, updateEntry,
    uploadPhotos, getPhotoUrls,
    exportJSON, importJSON,
  }
}

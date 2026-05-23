// Preset moods — index 0-4 are fixed presets, index 5 = custom (user-defined color)
export const MOODS = [
  { label: 'golden',   color: '#d4a843' },
  { label: 'ocean',    color: '#3a8fb5' },
  { label: 'dusk',     color: '#c5607a' },
  { label: 'forest',   color: '#5a9a6f' },
  { label: 'stone',    color: '#8a8070' },
  { label: 'lavender', color: '#8b74c7' },
  { label: 'coral',    color: '#e07052' },
  { label: 'mint',     color: '#4aab8a' },
]

export const CUSTOM_MOOD_IDX = 99  // Sentinel value for custom color entries

// Get mood from an entry — supports both preset index and custom color
// Entry stores: { moodIdx, customMoodColor, customMoodLabel }
export function getMoodFromEntry(entry) {
  if (entry.moodIdx === CUSTOM_MOOD_IDX) {
    return {
      label: entry.customMoodLabel || 'custom',
      color: entry.customMoodColor || '#888888',
    }
  }
  return MOODS[entry.moodIdx] ?? MOODS[0]
}

// Legacy helper — still used in places that only have an index
export function getMood(idx) {
  return MOODS[idx] ?? MOODS[0]
}

// Weather options
export const WEATHER_OPTIONS = [
  { value: 'sunny',   label: 'Sunny',   emoji: '☀️' },
  { value: 'cloudy',  label: 'Cloudy',  emoji: '☁️' },
  { value: 'rainy',   label: 'Rainy',   emoji: '🌧️' },
  { value: 'stormy',  label: 'Stormy',  emoji: '⛈️' },
  { value: 'snowy',   label: 'Snowy',   emoji: '❄️' },
  { value: 'windy',   label: 'Windy',   emoji: '💨' },
  { value: 'foggy',   label: 'Foggy',   emoji: '🌫️' },
  { value: 'hot',     label: 'Hot',     emoji: '🌡️' },
]

// Companion options
export const COMPANION_OPTIONS = [
  { value: 'solo',       label: 'Solo',       emoji: '🧍' },
  { value: 'partner',    label: 'Partner',    emoji: '👫' },
  { value: 'friends',    label: 'Friends',    emoji: '👯' },
  { value: 'family',     label: 'Family',     emoji: '👨‍👩‍👧' },
  { value: 'colleagues', label: 'Colleagues', emoji: '💼' },
  { value: 'group',      label: 'Group tour', emoji: '🚌' },
]

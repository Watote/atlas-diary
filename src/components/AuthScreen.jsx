import { useState } from 'react'
import { supabase } from '../utils/supabase.js'
import { MapPin } from 'lucide-react'

export default function AuthScreen() {
  const [mode, setMode] = useState('login')   // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setLoading(true); setError(''); setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Check your email for a confirmation link!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4"
      style={{ fontFamily: 'DM Mono, monospace' }}>

      {/* Background map-pin pattern */}
      <div className="absolute inset-0 overflow-hidden opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle, #352f28 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      <div className="bg-stone-50 rounded-2xl border border-stone-200 shadow-xl w-full max-w-sm overflow-hidden relative">

        {/* Top color bar */}
        <div style={{ height: 4, background: 'linear-gradient(90deg, #d4a843, #3a8fb5, #c5607a, #5a9a6f)' }} />

        <div className="px-8 py-8">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <MapPin size={18} className="text-stone-400" />
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: 22 }}>
              atlas <em className="text-stone-400">diary</em>
            </h1>
          </div>

          <h2 className="text-sm text-stone-600 mb-6">
            {mode === 'login' ? 'welcome back' : 'create your diary'}
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs tracking-widest text-stone-400 uppercase mb-1.5">email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="you@example.com"
                className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2.5 text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400 transition-colors"
                style={{ fontFamily: 'DM Mono, monospace' }} autoFocus />
            </div>
            <div>
              <label className="block text-xs tracking-widest text-stone-400 uppercase mb-1.5">password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="••••••••"
                className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2.5 text-sm text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400 transition-colors"
                style={{ fontFamily: 'DM Mono, monospace' }} />
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs text-rose-500 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
          )}
          {message && (
            <p className="mt-3 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{message}</p>
          )}

          <button onClick={handleSubmit} disabled={loading}
            className="mt-5 w-full py-2.5 text-sm text-stone-50 rounded-lg transition-opacity disabled:opacity-50"
            style={{ background: '#352f28', fontFamily: 'DM Mono, monospace' }}>
            {loading ? 'loading...' : mode === 'login' ? 'sign in' : 'create account'}
          </button>

          <p className="mt-4 text-xs text-center text-stone-400">
            {mode === 'login' ? "don't have an account? " : 'already have an account? '}
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }}
              className="text-stone-600 hover:text-stone-800 underline transition-colors">
              {mode === 'login' ? 'sign up' : 'sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

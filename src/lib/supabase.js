import { createClient } from '@supabase/supabase-js'

// Vite inlines these at build time. A host that never received the variables,
// such as the first Vercel deploy, still gets the public project values.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://zfpwcbjxghysmkokjvad.supabase.co'
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ZTdADomzHT1NjmpTBRVKsg_qL2bR_CX'
const REMEMBER_KEY = 'northline-remember'

export const isSupabaseConfigured = Boolean(url && anonKey)

export function setRememberPreference(remember) {
  window.localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
}

function remembersBrowser() {
  return window.localStorage.getItem(REMEMBER_KEY) !== '0'
}

const authStorage = {
  getItem(key) {
    return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key)
  },
  setItem(key, value) {
    if (remembersBrowser()) {
      window.sessionStorage.removeItem(key)
      window.localStorage.setItem(key, value)
    } else {
      window.localStorage.removeItem(key)
      window.sessionStorage.setItem(key, value)
    }
  },
  removeItem(key) {
    window.sessionStorage.removeItem(key)
    window.localStorage.removeItem(key)
  },
}

const clientKey = '__northlineSupabase'
const authOptions = {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
}

export const supabase = isSupabaseConfigured
  ? (globalThis[clientKey] ??= createClient(url, anonKey, authOptions))
  : null

export function authMessage(error) {
  const message = error?.message ?? 'Something went wrong. Try again.'
  if (/invalid login credentials/i.test(message)) return 'That email and password do not match.'
  if (/email not confirmed/i.test(message)) return 'Confirm your email before signing in. Check your inbox.'
  if (/already registered|already been registered/i.test(message)) return 'That email already has an account. Sign in instead.'
  if (/rate limit|too many requests/i.test(message)) return 'Too many attempts. Wait a moment and try again.'
  if (/provider is not enabled|unsupported provider/i.test(message)) {
    return 'Google sign-in is turned off in this Supabase project. Enable the Google provider, then try again.'
  }
  return message
}

export function returnedAuthError() {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return query.get('error_description') || hash.get('error_description') || ''
}

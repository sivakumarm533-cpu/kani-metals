import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest, AUTH_EXPIRED_EVENT, getAuthToken, getCachedUser, setAuthToken, setCachedUser } from '../services/api.js'
import { AuthContext } from './authContextValue.js'

const wait = (ms) => new Promise((resolve) => { window.setTimeout(resolve, ms) })

/**
 * Confirms the stored session. A 401 means the session really ended; anything else
 * (server waking up, no network) is retried and never signs the user out.
 */
async function confirmSession() {
  let lastError
  for (const delay of [0, 1500, 4000]) {
    if (delay) await wait(delay)
    try { return await apiRequest('/auth/me') }
    catch (error) {
      if (error.status === 401 || error.status === 403) throw error
      lastError = error
    }
  }
  throw lastError
}

export function AuthProvider({ children }) {
  // With a stored token and cached profile the app opens immediately; the session is checked in the background.
  const [user, setUser] = useState(() => (getAuthToken() ? getCachedUser() : null))
  const [loading, setLoading] = useState(() => Boolean(getAuthToken()) && !getCachedUser())

  useEffect(() => {
    if (!getAuthToken()) return undefined
    let active = true
    confirmSession()
      .then(({ user: current }) => { if (active) { setUser(current); setCachedUser(current) } })
      .catch((error) => {
        if (!active) return
        if (error.status === 401 || error.status === 403) { setAuthToken(null); setUser(null) }
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    // Any API call that reports an expired or revoked session signs the user out locally.
    const handleExpired = () => { setAuthToken(null); setUser(null) }
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired)
  }, [])

  const signIn = useCallback((auth) => {
    if (auth?.token) setAuthToken(auth.token)
    setCachedUser(auth?.user || null)
    setUser(auth?.user || null)
  }, [])

  const updateUser = useCallback((nextUser) => {
    setCachedUser(nextUser)
    setUser(nextUser)
  }, [])

  /** Ends this session (or every session with `everywhere`). Waits for the server so the token is really revoked. */
  const signOut = useCallback(async ({ everywhere = false } = {}) => {
    try { await apiRequest('/auth/logout', { method: 'POST', body: JSON.stringify({ everywhere }) }) }
    catch { /* already signed out on the server or offline; clear locally anyway */ }
    setAuthToken(null)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, loading, signIn, signOut, updateUser }), [user, loading, signIn, signOut, updateUser])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

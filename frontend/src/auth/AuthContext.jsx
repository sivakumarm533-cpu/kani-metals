import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest, AUTH_EXPIRED_EVENT, getAuthToken, setAuthToken } from '../services/api.js'
import { AuthContext } from './authContextValue.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Only wait for /auth/me when a token exists; otherwise the user is known to be signed out.
  const [loading, setLoading] = useState(() => Boolean(getAuthToken()))

  useEffect(() => {
    if (!getAuthToken()) return undefined
    let active = true
    apiRequest('/auth/me')
      .then(({ user: current }) => { if (active) setUser(current) })
      .catch(() => { if (active) setAuthToken(null) })
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
    setUser(auth?.user || null)
  }, [])

  const updateUser = useCallback((nextUser) => setUser(nextUser), [])

  const signOut = useCallback(() => {
    // The request reads the token synchronously before it is cleared below.
    apiRequest('/auth/logout', { method: 'POST' }).catch(() => {})
    setAuthToken(null)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, loading, signIn, signOut, updateUser }), [user, loading, signIn, signOut, updateUser])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

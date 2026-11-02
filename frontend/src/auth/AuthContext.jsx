import { createContext, useContext, useEffect, useState } from 'react'
import { apiRequest } from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('kani-auth-token')
    if (!token) { setLoading(false); return }
    apiRequest('/auth/me').then(({ user: current }) => setUser(current)).catch(() => localStorage.removeItem('kani-auth-token')).finally(() => setLoading(false))
  }, [])

  function signIn(auth) {
    localStorage.setItem('kani-auth-token', auth.token)
    setUser(auth.user)
  }

  function signOut() {
    localStorage.removeItem('kani-auth-token')
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

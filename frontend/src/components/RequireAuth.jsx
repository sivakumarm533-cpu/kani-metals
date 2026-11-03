import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue.js'
import PageLoader from './PageLoader.jsx'

export default function RequireAuth({ children, adminOnly = false }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader fullScreen label="Loading your account…" />
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

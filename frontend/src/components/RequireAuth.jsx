import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue.js'
import { isManager } from '../config/navigation.js'
import PageLoader from './PageLoader.jsx'

/**
 * `adminOnly` allows administrators and sub-admins; `primaryOnly` allows only the
 * primary administrator.
 */
export default function RequireAuth({ children, adminOnly = false, primaryOnly = false }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader fullScreen label="Loading your account…" />
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  if (primaryOnly && user.role !== 'admin') return <Navigate to="/settings/users" replace />
  if (adminOnly && !isManager(user)) return <Navigate to="/dashboard" replace />
  return children
}

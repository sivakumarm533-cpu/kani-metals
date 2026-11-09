import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue.js'
import { roleLabel } from '../config/navigation.js'
import logo from '../assets/logos/kani-metal-logo-1.webp'

export function Avatar({ user, className = 'navbar-profile-avatar' }) {
  return <span className={className} aria-hidden="true">{user?.profilePicture ? <img src={user.profilePicture} alt="" /> : user?.name?.trim()?.[0]?.toUpperCase() || '?'}</span>
}

function Navbar({ sidebarOpen, onToggleSidebar, onNavigate }) {
  const { user } = useAuth()

  return (
    <header className="admin-navbar">
      <button
        className={`menu-toggle${sidebarOpen ? ' is-open' : ''}`}
        type="button"
        aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={sidebarOpen}
        aria-controls="main-navigation"
        onClick={onToggleSidebar}
      >
        <span /><span /><span />
      </button>
      <Link className="navbar-brand" to="/dashboard" onClick={onNavigate}>
        <img className="navbar-logo" src={logo} alt="Kani Metals" width="84" height="42" />
      </Link>
      <div className="navbar-tools">
        {/* Signing out and profile changes live on the profile page. */}
        <NavLink to="/profile" className={({ isActive }) => `navbar-profile-link${isActive ? ' is-active' : ''}`} onClick={onNavigate} aria-label="Open my profile">
          <Avatar user={user} />
          <span className="navbar-user">
            <strong>{user?.name || 'My account'}</strong>
            <small>{roleLabel(user?.role)}</small>
          </span>
          <i className="bi bi-chevron-right navbar-profile-chevron" aria-hidden="true" />
        </NavLink>
      </div>
    </header>
  )
}

export default Navbar

import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue.js'
import { roleLabel, routeMeta } from '../config/navigation.js'
import { Avatar } from './Navbar.jsx'
import logo from '../assets/logos/kani-metal-logo-1.webp'
import mark from '../assets/logos/kani-metal-mark.webp'

/** True once the page has scrolled past its own title (phone header then shows the title). */
function useScrolledPast(offset = 48) {
  const [past, setPast] = useState(() => typeof window !== 'undefined' && window.scrollY > offset)
  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > offset)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [offset])
  return past
}

/**
 * Top bar. Desktop/tablet: menu button, logo, breadcrumbs and profile.
 * Phone: compact Android-style app bar with a back arrow on inner screens,
 * the screen title and the profile picture.
 */
export default function AppHeader({ isPhone, isDesktop, sidebarOpen, onToggleSidebar, onNavigate }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const meta = routeMeta(pathname)
  const scrolled = useScrolledPast()

  if (isPhone) {
    const showTitle = Boolean(meta.back) || scrolled
    return (
      <header className={`app-header is-phone${scrolled ? ' is-scrolled' : ''}`}>
        {meta.back
          ? <button type="button" className="app-header-icon" aria-label="Back" onClick={() => (meta.back === -1 ? navigate(-1) : navigate(meta.back))}><i className="bi bi-arrow-left" aria-hidden="true" /></button>
          : scrolled && <Link className="app-header-mark" to="/dashboard" aria-label="Kani Metals home"><img src={mark} alt="" width="34" height="34" /></Link>}
        <div className="app-header-title">
          <span className={showTitle ? 'is-visible' : ''}>{meta.title}</span>
          {!showTitle && <Link to="/dashboard" className="app-header-logo-link" aria-label="Kani Metals home"><img className="app-header-logo" src={logo} alt="" width="72" height="36" /></Link>}
        </div>
        <NavLink to="/profile" className={({ isActive }) => `app-header-avatar${isActive ? ' is-active' : ''}`} aria-label="My profile">
          <Avatar user={user} className="navbar-profile-avatar" />
        </NavLink>
      </header>
    )
  }

  return (
    <header className="admin-navbar app-header">
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
      {isDesktop
        ? <nav className="app-breadcrumbs" aria-label="Breadcrumb">
            <ol>
              {meta.crumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`}>
                  {crumb.to && index < meta.crumbs.length - 1 ? <Link to={crumb.to}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
        : <span className="app-header-tablet-title">{meta.title}</span>}
      <div className="navbar-tools">
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

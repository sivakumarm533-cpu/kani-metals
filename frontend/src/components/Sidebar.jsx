import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

const menuItems = [
  { to: '/dashboard', icon: '⌂', label: 'Dashboard' },
  { to: '/inventory', icon: '▤', label: 'Inventory' },
  { to: '/products', icon: '◈', label: 'Products' },
  { to: '/scrap-items', icon: '♻', label: 'Scrap items' },
  { to: '/itemsentry', icon: '))', label: 'items entry' }
]

function Sidebar() {
  const { user } = useAuth()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(() => window.innerWidth > 960)
  const [settingsOpen, setSettingsOpen] = useState(() => location.pathname.startsWith('/settings'))

  useEffect(() => {
    const handleToggle = (event) => setIsOpen(event.detail)
    const handleResize = () => setIsOpen(window.innerWidth > 960)
    window.addEventListener('sidebar-toggle', handleToggle)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('sidebar-toggle', handleToggle)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  function closeMenu() {
    // On wide screens, keep the persistent sidebar open when changing pages.
    if (window.innerWidth > 960) return
    setIsOpen(false)
    window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: false }))
  }

  return (
    <>
      {isOpen && window.innerWidth <= 960 && <button className="sidebar-backdrop" type="button" aria-label="Close navigation menu" onClick={closeMenu} />}
      <aside className={`admin-sidebar${isOpen ? ' is-open' : ''}`} aria-label="Main navigation" aria-hidden={!isOpen}>
        <p className="sidebar-heading">MENU</p>
        <nav>
          <ul className="sidebar-links p-0">
            {menuItems.map((item) => (
              <li key={item.to}>
                <NavLink className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`} to={item.to} onClick={closeMenu}>
                  <span className="sidebar-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
            {user?.role === 'admin' && <li className="sidebar-settings">
              <button type="button" className={`sidebar-link settings-parent${location.pathname.startsWith('/settings') ? ' is-active' : ''}`} aria-expanded={settingsOpen} onClick={() => setSettingsOpen((open) => !open)}><span className="sidebar-icon" aria-hidden="true">⚙</span><span>Settings</span><span className="settings-chevron" aria-hidden="true">{settingsOpen ? '−' : '+'}</span></button>
              {settingsOpen && <ul className="sidebar-submenu"><li><NavLink className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`} to="/settings/users" onClick={closeMenu}>User management</NavLink></li><li><NavLink className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`} to="/settings/backup" onClick={closeMenu}>Database backup</NavLink></li></ul>}
            </li>}
          </ul>
        </nav>
      </aside>
    </>
  )
}

export default Sidebar

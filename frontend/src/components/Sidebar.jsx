import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue.js'

const menuItems = [
  { to: '/dashboard', icon: 'bi-house-door', label: 'Dashboard' },
  { to: '/inventory', icon: 'bi-boxes', label: 'Inventory' },
  { to: '/products', icon: 'bi-tags', label: 'Products' },
  { to: '/scrap-items', icon: 'bi-recycle', label: 'Scrap items' },
  { to: '/itemsentry', icon: 'bi-receipt-cutoff', label: 'Item entry' },
  { to: '/dealer-payments', icon: 'bi-wallet2', label: 'Dealer Payments' },
  { to: '/bill-comparison', icon: 'bi-arrow-left-right', label: 'Bill Comparison' },
]

const settingsItems = [
  { to: '/settings/users', icon: 'bi-people', label: 'User management' },
  { to: '/settings/activity', icon: 'bi-clock-history', label: 'User activity' },
  { to: '/settings/backup', icon: 'bi-database-down', label: 'Database backup' },
]

const linkClass = ({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`

function Sidebar({ isOpen, isDesktop, onNavigate }) {
  const { user } = useAuth()
  const location = useLocation()
  const inSettings = location.pathname.startsWith('/settings')
  const [settingsOpen, setSettingsOpen] = useState(inSettings)

  return (
    <>
      {isOpen && !isDesktop && <button className="sidebar-backdrop" type="button" aria-label="Close navigation menu" tabIndex={-1} onClick={onNavigate} />}
      {/* `inert` keeps the hidden drawer's links out of the keyboard and screen-reader order. */}
      <aside id="main-navigation" className={`admin-sidebar${isOpen ? ' is-open' : ''}`} aria-label="Main navigation" inert={!isOpen}>
        <p className="sidebar-heading">MENU</p>
        <nav>
          <ul className="sidebar-links">
            {menuItems.map((item) => (
              <li key={item.to}>
                <NavLink className={linkClass} to={item.to} onClick={onNavigate}>
                  <span className="sidebar-icon" aria-hidden="true"><i className={`bi ${item.icon}`} /></span>
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
            {user?.role === 'admin' && <li className="sidebar-settings">
              <button
                type="button"
                className={`sidebar-link settings-parent${inSettings ? ' is-active' : ''}`}
                aria-expanded={settingsOpen}
                aria-controls="settings-submenu"
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <span className="sidebar-icon" aria-hidden="true"><i className="bi bi-gear" /></span>
                <span>Settings</span>
                <i className={`bi bi-chevron-down settings-chevron${settingsOpen ? ' is-open' : ''}`} aria-hidden="true" />
              </button>
              {settingsOpen && <ul className="sidebar-submenu" id="settings-submenu">
                {settingsItems.map((item) => (
                  <li key={item.to}>
                    <NavLink className={linkClass} to={item.to} onClick={onNavigate}>
                      <i className={`bi ${item.icon}`} aria-hidden="true" /><span>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>}
            </li>}
          </ul>
        </nav>
      </aside>
    </>
  )
}

export default Sidebar

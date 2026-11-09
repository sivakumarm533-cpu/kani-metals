import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue.js'
import { useAppSettings } from '../settings/appSettingsContext.js'
import { canUseItem, isManager, orderNavItems, PROFILE_ITEM, SETTINGS_ITEMS } from '../config/navigation.js'

const linkClass = ({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`

function SidebarLink({ item, onNavigate }) {
  return (
    <NavLink className={linkClass} to={item.to} onClick={onNavigate} title={item.description}>
      <span className="sidebar-icon" aria-hidden="true"><i className={`bi ${item.icon}`} /></span>
      <span className="sidebar-text"><span>{item.fullLabel}</span><small>{item.description}</small></span>
    </NavLink>
  )
}

function Sidebar({ isOpen, isDesktop, onNavigate }) {
  const { user } = useAuth()
  const { features, menuOrder } = useAppSettings()
  const location = useLocation()
  const inSettings = location.pathname.startsWith('/settings')
  const [settingsOpen, setSettingsOpen] = useState(inSettings)
  const items = orderNavItems(menuOrder).filter((item) => canUseItem(item, user, features))
  const settingsItems = SETTINGS_ITEMS.filter((item) => !item.primaryOnly || user?.role === 'admin')

  return (
    <>
      {isOpen && !isDesktop && <button className="sidebar-backdrop" type="button" aria-label="Close navigation menu" tabIndex={-1} onClick={onNavigate} />}
      {/* `inert` keeps the hidden drawer's links out of the keyboard and screen-reader order. */}
      <aside id="main-navigation" className={`admin-sidebar${isOpen ? ' is-open' : ''}`} aria-label="Main navigation" inert={!isOpen}>
        <nav>
          <p className="sidebar-heading">Work</p>
          <ul className="sidebar-links">
            {items.map((item) => <li key={item.key}><SidebarLink item={item} onNavigate={onNavigate} /></li>)}
          </ul>
          <p className="sidebar-heading">Account</p>
          <ul className="sidebar-links">
            <li><SidebarLink item={PROFILE_ITEM} onNavigate={onNavigate} /></li>
            {isManager(user) && <li className="sidebar-settings">
              <button
                type="button"
                className={`sidebar-link settings-parent${inSettings ? ' is-active' : ''}`}
                aria-expanded={settingsOpen}
                aria-controls="settings-submenu"
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <span className="sidebar-icon" aria-hidden="true"><i className="bi bi-gear" /></span>
                <span className="sidebar-text"><span>Settings</span><small>Team, features and workspace</small></span>
                <i className={`bi bi-chevron-down settings-chevron${settingsOpen ? ' is-open' : ''}`} aria-hidden="true" />
              </button>
              {settingsOpen && <ul className="sidebar-submenu" id="settings-submenu">
                {settingsItems.map((item) => (
                  <li key={item.to}>
                    <NavLink className={linkClass} to={item.to} onClick={onNavigate} title={item.description}>
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

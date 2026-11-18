import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue.js'
import { useAppSettings } from '../settings/appSettingsContext.js'
import { canUseItem, isManager, orderNavItems, PROFILE_ITEM, settingsGroupsFor } from '../config/navigation.js'

const linkClass = ({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`

function SidebarLink({ item, onNavigate, collapsed }) {
  return (
    <NavLink className={linkClass} to={item.to} onClick={onNavigate} title={collapsed ? item.fullLabel : item.description}>
      <span className="sidebar-icon" aria-hidden="true"><i className={`bi ${item.icon}`} /></span>
      <span className="sidebar-text"><span>{item.fullLabel}</span><small>{item.description}</small></span>
    </NavLink>
  )
}

/**
 * `collapsed` (desktop only): the menu shrinks to an icon rail instead of disappearing.
 * Labels stay in the markup for screen readers and show as tooltips.
 */
function Sidebar({ isOpen, isDesktop, collapsed = false, onNavigate, onExpand }) {
  const { user } = useAuth()
  const { features, menuOrder } = useAppSettings()
  const location = useLocation()
  const inSettings = location.pathname.startsWith('/settings')
  const [settingsOpen, setSettingsOpen] = useState(inSettings)
  const items = orderNavItems(menuOrder).filter((item) => canUseItem(item, user, features))
  const settingsGroups = settingsGroupsFor(user)

  return (
    <>
      {isOpen && !isDesktop && <button className="sidebar-backdrop" type="button" aria-label="Close navigation menu" tabIndex={-1} onClick={onNavigate} />}
      {/* `inert` keeps the hidden drawer's links out of the keyboard and screen-reader order. */}
      <aside id="main-navigation" className={`admin-sidebar${isOpen ? ' is-open' : ''}${collapsed ? ' is-collapsed' : ''}`} aria-label="Main navigation" inert={!isOpen && !collapsed}>
        <nav>
          <p className="sidebar-heading">Work</p>
          <ul className="sidebar-links">
            {items.map((item) => <li key={item.key}><SidebarLink item={item} onNavigate={onNavigate} collapsed={collapsed} /></li>)}
          </ul>
          <p className="sidebar-heading">Account</p>
          <ul className="sidebar-links">
            <li><SidebarLink item={PROFILE_ITEM} onNavigate={onNavigate} collapsed={collapsed} /></li>
            {isManager(user) && <li className="sidebar-settings">
              <button
                type="button"
                className={`sidebar-link settings-parent${inSettings ? ' is-active' : ''}`}
                aria-expanded={settingsOpen && !collapsed}
                aria-controls="settings-submenu"
                title={collapsed ? 'Settings' : undefined}
                // In the icon rail there is no room for the submenu, so Settings opens the full menu with it expanded.
                onClick={() => { if (collapsed) { setSettingsOpen(true); onExpand?.() } else setSettingsOpen((open) => !open) }}
              >
                <span className="sidebar-icon" aria-hidden="true"><i className="bi bi-gear" /></span>
                <span className="sidebar-text"><span>Settings</span><small>Team, workspace and data</small></span>
                <i className={`bi bi-chevron-down settings-chevron${settingsOpen ? ' is-open' : ''}`} aria-hidden="true" />
              </button>
              {settingsOpen && !collapsed && <ul className="sidebar-submenu" id="settings-submenu">
                {settingsGroups.map((group) => [
                  <li key={group.id} className="sidebar-submenu-group" aria-hidden="true">{group.label}</li>,
                  ...group.items.map((item) => (
                    <li key={item.to}>
                      <NavLink className={linkClass} to={item.to} onClick={onNavigate} title={`${group.label} · ${item.description}`}>
                        <i className={`bi ${item.icon}`} aria-hidden="true" /><span>{item.label}</span>
                      </NavLink>
                    </li>
                  )),
                ])}
              </ul>}
            </li>}
          </ul>
        </nav>
      </aside>
    </>
  )
}

export default Sidebar

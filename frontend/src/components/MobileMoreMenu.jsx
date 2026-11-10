import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue.js'
import { useAppSettings } from '../settings/appSettingsContext.js'
import { canUseItem, isManager, itemIsActive, orderNavItems, PROFILE_ITEM, roleLabel, SETTINGS_ITEMS } from '../config/navigation.js'
import BottomSheet from './BottomSheet.jsx'
import { Avatar } from './Navbar.jsx'

/**
 * The phone "More" sheet: every screen that is not on the bottom bar, the
 * profile, and (for admins and sub-admins) the settings pages.
 */
export default function MobileMoreMenu({ onClose, barKeys = [] }) {
  const { user } = useAuth()
  const { features, menuOrder } = useAppSettings()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const screens = orderNavItems(menuOrder).filter((item) => canUseItem(item, user, features) && !barKeys.includes(item.key))
  const settings = isManager(user) ? SETTINGS_ITEMS.filter((item) => !item.primaryOnly || user?.role === 'admin') : []

  // `replace` swaps out the sheet's own history entry, so Back after moving goes to the previous screen.
  const go = (to) => { onClose(); navigate(to, { replace: true }) }

  return (
    <BottomSheet title="More" onClose={onClose} className="more-sheet">
      <button type="button" className="more-profile" onClick={() => go(PROFILE_ITEM.to)}>
        <Avatar user={user} className="navbar-profile-avatar more-profile-avatar" />
        <span><strong>{user?.name || 'My account'}</strong><small>{roleLabel(user?.role)} · View profile</small></span>
        <i className="bi bi-chevron-right" aria-hidden="true" />
      </button>

      {screens.length > 0 && <>
        <h3 className="more-heading">Screens</h3>
        <ul className="more-grid">
          {screens.map((item) => {
            const active = itemIsActive(item, pathname)
            return (
              <li key={item.key}>
                <button type="button" className={`more-tile${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => go(item.to)}>
                  <span className="more-tile-icon" aria-hidden="true"><i className={`bi ${active ? item.activeIcon || item.icon : item.icon}`} /></span>
                  <span>{item.fullLabel}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </>}

      {settings.length > 0 && <>
        <h3 className="more-heading">Settings</h3>
        <ul className="more-list">
          {settings.map((item) => {
            const active = pathname === item.to
            return (
              <li key={item.to}>
                <button type="button" className={`more-row${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => go(item.to)}>
                  <span className="more-row-icon" aria-hidden="true"><i className={`bi ${item.icon}`} /></span>
                  <span className="more-row-text"><strong>{item.label}</strong><small>{item.description}</small></span>
                  <i className="bi bi-chevron-right" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      </>}
    </BottomSheet>
  )
}

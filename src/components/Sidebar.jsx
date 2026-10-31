import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

const menuItems = [
  { to: '/dashboard', icon: '⌂', label: 'Dashboard' },
  { to: '/inventory', icon: '▤', label: 'Inventory' },
  { to: '/products', icon: '◈', label: 'Products' },
  { to: '/scrap-items', icon: '♻', label: 'Scrap items' },
]

function Sidebar() {
  const [isOpen, setIsOpen] = useState(() => window.innerWidth > 960)

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
          <ul className="sidebar-links">
            {menuItems.map((item) => (
              <li key={item.to}>
                <NavLink className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`} to={item.to} onClick={closeMenu}>
                  <span className="sidebar-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}

export default Sidebar

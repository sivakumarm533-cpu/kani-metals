import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import logo from '../assets/logos/kani-metal-logo-1.png'

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(() => window.innerWidth > 960)

  useEffect(() => {
    const handleToggle = (event) => setMenuOpen(event.detail)
    const handleResize = () => setMenuOpen(window.innerWidth > 960)
    window.addEventListener('sidebar-toggle', handleToggle)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('sidebar-toggle', handleToggle)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  function toggleMenu() {
    const nextOpen = !menuOpen
    setMenuOpen(nextOpen)
    window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: nextOpen }))
  }

  function handleBrandClick() {
    if (window.innerWidth > 960) return
    setMenuOpen(false)
    window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: false }))
  }

  return (
    <header className="admin-navbar">
      <button
        className="menu-toggle"
        type="button"
        aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={menuOpen}
        onClick={toggleMenu}
      >
        <span /><span /><span />
      </button>
      <Link className="navbar-brand" to="/dashboard" onClick={handleBrandClick}>
        <img className="navbar-logo" src={logo} alt="Kani Metals" />
      </Link>
      <div className="navbar-tools">
        <span className="navbar-status">Admin panel</span>
        <span className="profile-avatar" aria-label="Administrator">A</span>
      </div>
    </header>
  )
}

export default Navbar

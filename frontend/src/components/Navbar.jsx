import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { apiRequest } from '../services/api.js'
import logo from '../assets/logos/kani-metal-logo-1.png'

function Navbar() {
  const { user, signIn, signOut } = useAuth()
  const [photoError, setPhotoError] = useState('')
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

  async function updateProfilePicture(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const body = new FormData()
    body.append('profilePicture', file)
    setPhotoError('')
    try {
      const result = await apiRequest('/auth/profile/photo', { method: 'PATCH', body })
      signIn({ token: localStorage.getItem('kani-auth-token'), user: result.user })
    } catch (error) { setPhotoError(error.message) }
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
        <label className="navbar-profile-upload" title="Change profile picture">
          <span className="navbar-profile-avatar">{user?.profilePicture ? <img src={user.profilePicture} alt="" /> : user?.name?.[0]?.toUpperCase() || '?'}</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={updateProfilePicture} aria-label="Change profile picture" />
        </label>
        <span className="navbar-status" title={photoError || undefined}>{photoError ? 'Photo upload failed' : user?.name || 'Admin panel'}</span>
        <button type="button" className="sign-out-button" onClick={signOut}>Sign out</button>
      </div>
    </header>
  )
}

export default Navbar

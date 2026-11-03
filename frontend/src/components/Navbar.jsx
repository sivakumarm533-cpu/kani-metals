import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue.js'
import { apiRequest } from '../services/api.js'
import { compressImageFile } from '../utils/image.js'
import { useToast } from '../hooks/useToast.js'
import Toast from './Toast.jsx'
import logo from '../assets/logos/kani-metal-logo-1.webp'

function Navbar({ sidebarOpen, onToggleSidebar, onNavigate }) {
  const { user, updateUser, signOut } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [toast, notify] = useToast(3600)

  async function updateProfilePicture(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const body = new FormData()
      body.append('profilePicture', await compressImageFile(file))
      const result = await apiRequest('/auth/profile/photo', { method: 'PATCH', body })
      updateUser(result.user)
      notify('Profile picture updated.')
    } catch (error) {
      notify(error.message || 'Photo upload failed.', 'danger')
    } finally { setUploading(false) }
  }

  return (
    <header className="admin-navbar">
      <Toast toast={toast} />
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
        <label className={`navbar-profile-upload${uploading ? ' is-uploading' : ''}`} title="Change profile picture">
          <span className="navbar-profile-avatar">{user?.profilePicture ? <img src={user.profilePicture} alt="" /> : user?.name?.[0]?.toUpperCase() || '?'}</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={updateProfilePicture} disabled={uploading} aria-label="Change profile picture" />
        </label>
        <span className="navbar-user">
          <strong>{user?.name || 'Admin panel'}</strong>
          <small>{user?.role === 'admin' ? 'Administrator' : 'Team member'}</small>
        </span>
        <button type="button" className="sign-out-button" onClick={signOut}>
          <i className="bi bi-box-arrow-right" aria-hidden="true" /><span>Sign out</span>
        </button>
      </div>
    </header>
  )
}

export default Navbar

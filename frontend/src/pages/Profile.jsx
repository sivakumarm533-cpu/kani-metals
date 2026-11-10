import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue.js'
import { useAppSettings } from '../settings/appSettingsContext.js'
import { apiRequest } from '../services/api.js'
import { compressImageFile } from '../utils/image.js'
import { applyTheme, cachedThemeId, findTheme, THEMES } from '../theme/themes.js'
import { useToast } from '../hooks/useToast.js'
import { LANGUAGES, savedLanguage, switchLanguage } from '../utils/translate.js'
import Toast from '../components/Toast.jsx'
import Modal from '../components/Modal.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { Avatar } from '../components/Navbar.jsx'
import { BOTTOM_NAV_CHOICES, BOTTOM_NAV_MAX, bottomNavItems, canUseItem, DEFAULT_BOTTOM_NAV, NAV_STYLES, roleLabel } from '../config/navigation.js'

function Card({ icon, title, intro, children, id }) {
  return (
    <section className="profile-card" id={id} aria-labelledby={`${id}-title`}>
      <header className="profile-card-header">
        <span className="profile-card-icon" aria-hidden="true"><i className={`bi ${icon}`} /></span>
        <div><h2 id={`${id}-title`}>{title}</h2>{intro && <p>{intro}</p>}</div>
      </header>
      {children}
    </section>
  )
}

function DetailsCard({ user, updateUser, notify }) {
  const [name, setName] = useState(user.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const result = await apiRequest('/auth/profile', { method: 'PATCH', body: JSON.stringify({ name }) })
      updateUser(result.user); notify('Your name was updated.')
    } catch (issue) { setError(issue.message) } finally { setBusy(false) }
  }

  return (
    <Card id="profile-details" icon="bi-person-vcard" title="Your details" intro="This name is shown in the top bar and in the activity history.">
      {error && <p className="api-error" role="alert">{error}</p>}
      <form className="profile-form" onSubmit={save}>
        <label>Full name<input className="form-control" value={name} onChange={(event) => setName(event.target.value)} maxLength="100" autoComplete="name" required /></label>
        <label>Email (used to sign in)<input className="form-control" value={user.email} readOnly disabled /></label>
        <div className="profile-form-actions"><button className="continue-btn" disabled={busy || !name.trim() || name.trim() === user.name}>{busy ? 'Saving…' : 'Save name'}</button></div>
      </form>
    </Card>
  )
}

/** App language through Google Translate. Saved on the profile, so it follows you to other devices. */
function LanguageCard({ user, updateUser }) {
  const current = user.preferences?.language || savedLanguage()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function choose(code) {
    if (code === current || busy) return
    setBusy(code); setError('')
    try {
      const result = await apiRequest('/auth/profile', { method: 'PATCH', body: JSON.stringify({ preferences: { language: code } }) })
      updateUser(result.user)
      switchLanguage(code) // reloads the app in the new language
    } catch (issue) { setError(issue.message); setBusy('') }
  }

  return (
    <Card id="profile-language" icon="bi-translate" title="Language" intro="Show the app in your language. Translation is done by Google Translate, so some words may not be perfect.">
      {error && <p className="api-error" role="alert">{error}</p>}
      {/* translate="no": language names always stay in their own script. */}
      <div className="language-grid" role="radiogroup" aria-label="App language" translate="no">
        {LANGUAGES.map((language) => {
          const selected = language.code === current
          return (
            <button key={language.code} type="button" role="radio" aria-checked={selected} className={`language-option notranslate${selected ? ' is-selected' : ''}`} disabled={Boolean(busy)} onClick={() => choose(language.code)}>
              <strong>{language.native}</strong>
              <small>{busy === language.code ? 'Switching…' : language.name}</small>
              {selected && <i className="bi bi-check-circle-fill" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
      <p className="language-note"><i className="bi bi-info-circle" aria-hidden="true" /><span>The app reloads to switch language. Choose <strong>English</strong> to turn translation off.</span></p>
    </Card>
  )
}

function PasswordCard({ user, notify }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mismatch = form.confirm && form.newPassword !== form.confirm

  async function save(event) {
    event.preventDefault()
    if (mismatch) return
    setBusy(true); setError('')
    try {
      const result = await apiRequest('/auth/profile/password', { method: 'POST', body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }) })
      // Offer the new password to the browser's password manager.
      try {
        if (window.PasswordCredential && navigator.credentials?.store) await navigator.credentials.store(new window.PasswordCredential({ id: user.email, password: form.newPassword, name: user.name }))
      } catch { /* the browser declined; nothing else to do */ }
      setForm({ currentPassword: '', newPassword: '', confirm: '' }); notify(result.message)
    } catch (issue) { setError(issue.message) } finally { setBusy(false) }
  }

  const type = show ? 'text' : 'password'
  return (
    <Card id="profile-password" icon="bi-key" title="Change password" intro="Use at least 12 characters. Your other devices will be signed out.">
      {error && <p className="api-error" role="alert">{error}</p>}
      <form className="profile-form" onSubmit={save}>
        <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden />
        <label>Current password<input className="form-control" type={type} name="current-password" autoComplete="current-password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} required /></label>
        <label>New password<input className="form-control" type={type} name="new-password" autoComplete="new-password" minLength="12" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} required /></label>
        <label>Type the new password again<input className="form-control" type={type} name="confirm-password" autoComplete="new-password" minLength="12" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} required aria-invalid={Boolean(mismatch)} /></label>
        {mismatch && <p className="profile-hint is-error">The two new passwords do not match.</p>}
        <label className="profile-check"><input type="checkbox" checked={show} onChange={(event) => setShow(event.target.checked)} /> Show passwords</label>
        <div className="profile-form-actions"><button className="continue-btn" disabled={busy || mismatch}>{busy ? 'Changing…' : 'Change password'}</button></div>
      </form>
    </Card>
  )
}

function AppearanceCard({ user, updateUser, notify }) {
  const { allowUserThemes, features, theme: workspaceTheme } = useAppSettings()
  const saved = user.preferences || {}
  const [theme, setTheme] = useState(saved.theme || '')
  const [navStyle, setNavStyle] = useState(saved.navStyle || 'light')
  const [navKeys, setNavKeys] = useState(() => bottomNavItems(saved.bottomNav, user, features).map((item) => item.key))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const choices = BOTTOM_NAV_CHOICES.filter((item) => canUseItem(item, user, features))
  const previewItems = navKeys.map((key) => choices.find((item) => item.key === key)).filter(Boolean)
  const savedKeys = bottomNavItems(saved.bottomNav, user, features).map((item) => item.key)
  const changed = (allowUserThemes && theme !== (saved.theme || '')) || navStyle !== (saved.navStyle || 'light') || navKeys.join() !== savedKeys.join()

  // Leaving the page without saving puts the saved theme back.
  useEffect(() => () => { applyTheme(cachedThemeId()) }, [])

  function pickTheme(id) {
    setTheme(id)
    applyTheme(id || workspaceTheme, { persist: false })
  }

  function toggleItem(key) {
    if (navKeys.includes(key)) {
      if (navKeys.length === 1) { setError('Keep at least one screen in the bottom bar.'); return }
      setError(''); setNavKeys(navKeys.filter((entry) => entry !== key)); return
    }
    if (navKeys.length >= BOTTOM_NAV_MAX) { setError(`You can pin up to ${BOTTOM_NAV_MAX} screens. Remove one first.`); return }
    setError(''); setNavKeys([...navKeys, key])
  }

  function move(key, direction) {
    setNavKeys((current) => {
      const index = current.indexOf(key)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function reset() {
    pickTheme(saved.theme || '')
    setNavStyle(saved.navStyle || 'light')
    setNavKeys(savedKeys)
    setError('')
  }

  async function save() {
    setBusy(true); setError('')
    try {
      const preferences = { navStyle, bottomNav: navKeys.length ? navKeys : DEFAULT_BOTTOM_NAV }
      if (allowUserThemes) preferences.theme = theme
      const result = await apiRequest('/auth/profile', { method: 'PATCH', body: JSON.stringify({ preferences }) })
      updateUser(result.user)
      notify('Your appearance settings were saved.')
    } catch (issue) { setError(issue.message) } finally { setBusy(false) }
  }

  return (
    <Card id="profile-appearance" icon="bi-palette" title="Appearance" intro="Change how the app looks for you. Tap an option to preview it, then press Save.">
      <h3 className="profile-subheading">Colour theme</h3>
      {allowUserThemes ? <div className="profile-theme-grid" role="radiogroup" aria-label="Personal colour theme">
        <button type="button" role="radio" aria-checked={theme === ''} className={`profile-theme-option${theme === '' ? ' is-selected' : ''}`} onClick={() => pickTheme('')} style={{ '--swatch': findTheme(workspaceTheme).primary }}>
          <span className="profile-theme-swatch is-default" aria-hidden="true"><i className="bi bi-building" /></span>
          <span><strong>Workspace</strong><small>{findTheme(workspaceTheme).name}</small></span>
        </button>
        {THEMES.map((option) => (
          <button key={option.id} type="button" role="radio" aria-checked={theme === option.id} className={`profile-theme-option${theme === option.id ? ' is-selected' : ''}`} onClick={() => pickTheme(option.id)} style={{ '--swatch': option.primary }}>
            <span className="profile-theme-swatch" aria-hidden="true" />
            <span><strong>{option.name}</strong><small>{option.description}</small></span>
          </button>
        ))}
      </div> : <p className="profile-hint"><i className="bi bi-lock" aria-hidden="true" /> Your administrator uses one theme for everyone ({findTheme(workspaceTheme).name}).</p>}

      <h3 className="profile-subheading">Mobile bottom bar</h3>
      <p className="profile-hint">On a phone, these screens stay at the bottom of the screen. Pick up to {BOTTOM_NAV_MAX}; everything else is under <strong>More</strong>.</p>
      <div className="bottom-nav-preview-frame" aria-label="Bottom bar preview">
        <span className="bottom-nav-preview-label"><i className="bi bi-eye" aria-hidden="true" /> Preview</span>
        <BottomNav preview items={previewItems} navStyle={navStyle} />
      </div>
      <div className="nav-style-grid" role="radiogroup" aria-label="Bottom bar style">
        {NAV_STYLES.map((style) => (
          <button key={style.id} type="button" role="radio" aria-checked={navStyle === style.id} className={`nav-style-option${navStyle === style.id ? ' is-selected' : ''}`} onClick={() => setNavStyle(style.id)}>
            <span className={`nav-style-sample nav-style-sample-${style.id}`} aria-hidden="true"><i /><b /><i /><i /></span>
            <strong>{style.name}</strong><small>{style.description}</small>
          </button>
        ))}
      </div>
      {error && <p className="api-error" role="alert">{error}</p>}
      <ul className="nav-choice-list">
        {choices.map((item) => {
          const position = navKeys.indexOf(item.key)
          const pinned = position >= 0
          return (
            <li key={item.key} className={pinned ? 'is-pinned' : ''}>
              <label className="nav-choice-toggle">
                <input type="checkbox" checked={pinned} onChange={() => toggleItem(item.key)} />
                <span className="nav-choice-icon" aria-hidden="true"><i className={`bi ${item.icon}`} /></span>
                <span><strong>{item.fullLabel}</strong><small>{item.description}</small></span>
              </label>
              {pinned && <span className="nav-choice-order">
                <span className="nav-choice-position">{position + 1}</span>
                <button type="button" onClick={() => move(item.key, -1)} disabled={position === 0} aria-label={`Move ${item.fullLabel} left`}><i className="bi bi-arrow-left" aria-hidden="true" /></button>
                <button type="button" onClick={() => move(item.key, 1)} disabled={position === navKeys.length - 1} aria-label={`Move ${item.fullLabel} right`}><i className="bi bi-arrow-right" aria-hidden="true" /></button>
              </span>}
            </li>
          )
        })}
      </ul>
      <div className="profile-form-actions">
        {changed && <button type="button" className="back-button" onClick={reset} disabled={busy}>Undo changes</button>}
        <button type="button" className="continue-btn" onClick={save} disabled={busy || !changed}>{busy ? 'Saving…' : <><i className="bi bi-check2" aria-hidden="true" /> Save appearance</>}</button>
      </div>
    </Card>
  )
}

export default function Profile() {
  const { user, updateUser, signOut } = useAuth()
  const navigate = useNavigate()
  const [toast, notify] = useToast(3600)
  const [uploading, setUploading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [everywhere, setEverywhere] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  if (!user) return null

  async function changePhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const body = new FormData()
      body.append('profilePicture', await compressImageFile(file))
      const result = await apiRequest('/auth/profile/photo', { method: 'PATCH', body })
      updateUser(result.user); notify('Profile picture updated.')
    } catch (issue) { notify(issue.message || 'Photo upload failed.', 'danger') } finally { setUploading(false) }
  }

  async function removePhoto() {
    setUploading(true)
    try {
      const result = await apiRequest('/auth/profile', { method: 'PATCH', body: JSON.stringify({ removeProfilePicture: true }) })
      updateUser(result.user); notify('Profile picture removed.', 'info')
    } catch (issue) { notify(issue.message, 'danger') } finally { setUploading(false) }
  }

  async function confirmSignOut() {
    setSigningOut(true)
    await signOut({ everywhere })
    navigate('/login', { replace: true })
  }

  const memberSince = user.createdAt && !Number.isNaN(new Date(user.createdAt).getTime()) ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : ''

  return (
    <div className="profile-page">
      <Toast toast={toast} />
      <section className="profile-hero">
        <div className={`profile-hero-avatar${uploading ? ' is-uploading' : ''}`}>
          <Avatar user={user} className="profile-avatar-large" />
          <label className="profile-photo-button" title="Change photo">
            <i className="bi bi-camera-fill" aria-hidden="true" /><span className="visually-hidden">Change profile picture</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={changePhoto} disabled={uploading} />
          </label>
        </div>
        <div className="profile-hero-text">
          <h1>{user.name}</h1>
          <p>{user.email}</p>
          <div className="profile-hero-tags">
            <span className={`profile-role profile-role-${user.role}`}><i className={`bi ${user.role === 'user' ? 'bi-person' : 'bi-shield-check'}`} aria-hidden="true" /> {roleLabel(user.role)}</span>
            {memberSince && <span className="profile-since">Member since {memberSince}</span>}
          </div>
          {user.profilePicture && <button type="button" className="link-button profile-remove-photo" onClick={removePhoto} disabled={uploading}>Remove photo</button>}
        </div>
        <button type="button" className="profile-signout-button" onClick={() => { setEverywhere(false); setConfirmOpen(true) }}>
          <i className="bi bi-box-arrow-right" aria-hidden="true" /> Sign out
        </button>
      </section>

      <div className="profile-grid">
        <div className="profile-column">
          <DetailsCard key={`details-${user.name}`} user={user} updateUser={updateUser} notify={notify} />
          <PasswordCard user={user} notify={notify} />
        </div>
        <div className="profile-column">
          <LanguageCard user={user} updateUser={updateUser} />
          <AppearanceCard user={user} updateUser={updateUser} notify={notify} />
        </div>
      </div>

      {confirmOpen && <Modal role="alertdialog" busy={signingOut} onClose={() => setConfirmOpen(false)} labelledBy="signout-title" describedBy="signout-description">
        <div className="dealer-delete-icon signout-icon"><i className="bi bi-box-arrow-right" aria-hidden="true" /></div>
        <h2 id="signout-title">Sign out?</h2>
        <p id="signout-description">You will need your email and password to sign in again.</p>
        <label className="profile-check signout-everywhere"><input type="checkbox" checked={everywhere} onChange={(event) => setEverywhere(event.target.checked)} /> Also sign out on all my other devices</label>
        <div className="dealer-delete-actions">
          <button type="button" className="back-button" onClick={() => setConfirmOpen(false)} disabled={signingOut} data-autofocus>Stay signed in</button>
          <button type="button" className="confirm-delete-btn" onClick={confirmSignOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Yes, sign out'}</button>
        </div>
      </Modal>}
    </div>
  )
}

import { useState } from 'react'
import Modal from './Modal.jsx'
import { apiRequest } from '../services/api.js'
import { useAppSettings } from '../settings/appSettingsContext.js'
import { FEATURE_ITEMS, featureAllowed } from '../config/navigation.js'

/**
 * Admins and sub-admins switch screens on or off for one team member.
 * Screens left on "Workspace" follow Settings → Feature access.
 */
export default function UserMenuAccessModal({ user, onClose, onSaved }) {
  const { features } = useAppSettings()
  // value per feature: true / false = set for this person, null = follow the workspace
  const [access, setAccess] = useState(() => Object.fromEntries(FEATURE_ITEMS.map((item) => [item.feature, typeof user.featureAccess?.[item.feature] === 'boolean' ? user.featureAccess[item.feature] : null])))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const enabledCount = FEATURE_ITEMS.filter((item) => featureAllowed(item.feature, access, features)).length
  const hasCustom = Object.values(access).some((value) => value !== null)

  async function save() {
    setBusy(true); setError('')
    try {
      const updated = await apiRequest(`/auth/users/${user._id}/feature-access`, { method: 'PUT', body: JSON.stringify({ featureAccess: access }) })
      onSaved(updated)
    } catch (issue) { setError(issue.message) } finally { setBusy(false) }
  }

  return (
    <Modal className="dealer-delete-dialog user-access-dialog" busy={busy} onClose={onClose} labelledBy="user-access-title">
      <div className="payment-modal-heading">
        <div><span className="payment-eyebrow"><i className="bi bi-toggles" aria-hidden="true" /> MENU ACCESS</span><h2 id="user-access-title">{user.name}</h2></div>
        <button type="button" className="payment-close" aria-label="Close" onClick={onClose} disabled={busy}>×</button>
      </div>
      <div className="user-access-body">
      <p className="user-access-intro">Choose the screens <strong>{user.name}</strong> can open. <strong>Workspace</strong> follows Settings → Feature access. The dashboard and their profile are always available.</p>
      {error && <p className="api-error" role="alert">{error}</p>}
      <div className="feature-summary" role="status"><i className="bi bi-info-circle" aria-hidden="true" /> {user.name} can use <strong>{enabledCount} of {FEATURE_ITEMS.length}</strong> screens.</div>
      <ul className="feature-list">
        {FEATURE_ITEMS.map((item) => {
          const value = access[item.feature]
          const on = featureAllowed(item.feature, access, features)
          const workspaceOn = features?.[item.feature] !== false
          return (
            <li key={item.key} className={`feature-row${on ? '' : ' is-off'}`}>
              <span className="feature-row-icon" aria-hidden="true"><i className={`bi ${item.icon}`} /></span>
              <span className="feature-row-text"><strong>{item.fullLabel}</strong><small>{value === null ? `Workspace setting · ${workspaceOn ? 'On' : 'Off'}` : `Set for ${user.name} · ${value ? 'On' : 'Off'}`}</small></span>
              <span className="user-access-choice" role="radiogroup" aria-label={`${item.fullLabel} for ${user.name}`}>
                {[[null, 'Workspace'], [true, 'On'], [false, 'Off']].map(([choice, label]) => (
                  <button key={label} type="button" role="radio" aria-checked={value === choice} className={`user-access-option${value === choice ? ' is-active' : ''}${choice === false ? ' is-off-choice' : ''}`} onClick={() => setAccess((current) => ({ ...current, [item.feature]: choice }))} disabled={busy}>{label}</button>
                ))}
              </span>
            </li>
          )
        })}
      </ul>
      </div>
      <div className="dealer-delete-actions user-access-actions">
        <button type="button" className="back-button user-access-reset" onClick={() => setAccess(Object.fromEntries(FEATURE_ITEMS.map((item) => [item.feature, null])))} disabled={busy || !hasCustom}><i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> All to workspace</button>
        <button type="button" className="back-button" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="continue-btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save menu access'}</button>
      </div>
    </Modal>
  )
}

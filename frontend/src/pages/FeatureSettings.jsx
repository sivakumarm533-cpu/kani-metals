import { useState } from 'react'
import { useAppSettings } from '../settings/appSettingsContext.js'
import { FEATURE_ITEMS } from '../config/navigation.js'
import { useToast } from '../hooks/useToast.js'
import Toast from '../components/Toast.jsx'
import LoadError from '../components/LoadError.jsx'

export function Switch({ checked, onChange, label, disabled }) {
  return (
    <label className={`feature-switch${checked ? ' is-on' : ''}`}>
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} aria-label={label} />
      <span className="feature-switch-track" aria-hidden="true"><span /></span>
      <span className="feature-switch-state" aria-hidden="true">{checked ? 'On' : 'Off'}</span>
    </label>
  )
}

/** Admins and sub-admins choose which screens regular users can open. */
export default function FeatureSettings() {
  const { features, allowUserThemes, saveSettings, loaded } = useAppSettings()
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, notify] = useToast()
  const current = draft || { features: Object.fromEntries(FEATURE_ITEMS.map((item) => [item.feature, features[item.feature] !== false])), allowUserThemes }
  const enabledCount = FEATURE_ITEMS.filter((item) => current.features[item.feature]).length

  function update(changes) { setDraft({ ...current, ...changes, features: { ...current.features, ...changes.features } }) }

  async function save() {
    setSaving(true); setError('')
    try {
      await saveSettings({ features: current.features, allowUserThemes: current.allowUserThemes })
      setDraft(null); notify('Feature access saved. Users see the change the next time a page loads.')
    } catch (issue) { setError(issue.message) } finally { setSaving(false) }
  }

  return (
    <section className="boarder-box settings-page feature-settings-page">
      <Toast toast={toast} />
      <header className="bill-header settings-page-header">
        <div><h1 className="page-title">Feature access</h1><p>Switch screens on or off for <strong>team members</strong>. Administrators and sub-admins can always use everything.</p></div>
        <div className="theme-header-actions">
          {draft && <button type="button" className="back-button" onClick={() => setDraft(null)} disabled={saving}>Undo changes</button>}
          <button type="button" className="continue-btn" onClick={save} disabled={!draft || saving || !loaded}>{saving ? <><span className="btn-spinner" aria-hidden="true" /> Saving…</> : <><i className="bi bi-check2" aria-hidden="true" /> Save changes</>}</button>
        </div>
      </header>
      <LoadError message={error} />

      <div className="feature-summary" role="status"><i className="bi bi-info-circle" aria-hidden="true" /><span>Team members can use <strong>{enabledCount} of {FEATURE_ITEMS.length}</strong> features. The dashboard and their own profile are always available. To change one person only, use <strong>Menu</strong> next to their name in Users &amp; roles.</span></div>

      <ul className="feature-list">
        {FEATURE_ITEMS.map((item) => {
          const on = current.features[item.feature]
          return (
            <li key={item.key} className={`feature-row${on ? '' : ' is-off'}`}>
              <span className="feature-row-icon" aria-hidden="true"><i className={`bi ${item.icon}`} /></span>
              <span className="feature-row-text"><strong>{item.fullLabel}</strong><small>{item.description}</small></span>
              <Switch checked={on} label={`${item.fullLabel} for team members`} disabled={saving} onChange={(value) => update({ features: { [item.feature]: value } })} />
            </li>
          )
        })}
      </ul>

      <h2 className="feature-section-title">Personal choices</h2>
      <ul className="feature-list">
        <li className={`feature-row${current.allowUserThemes ? '' : ' is-off'}`}>
          <span className="feature-row-icon" aria-hidden="true"><i className="bi bi-palette" /></span>
          <span className="feature-row-text"><strong>Let everyone choose their own colour theme</strong><small>When off, everyone sees the workspace theme.</small></span>
          <Switch checked={current.allowUserThemes} label="Let everyone choose their own colour theme" disabled={saving} onChange={(value) => update({ allowUserThemes: value })} />
        </li>
      </ul>
    </section>
  )
}

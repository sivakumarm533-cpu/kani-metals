import { useEffect, useState } from 'react'
import { useAppSettings } from '../settings/appSettingsContext.js'
import { applyTheme, cachedThemeId, findTheme, isPremiumTheme, patternLayers, THEME_TIERS, THEMES, themeTier } from '../theme/themes.js'
import { Switch } from './FeatureSettings.jsx'
import { PremiumBadge } from '../components/ui.jsx'
import { useToast } from '../hooks/useToast.js'
import Toast from '../components/Toast.jsx'
import LoadError from '../components/LoadError.jsx'

function ThemePreview({ theme }) {
  const pattern = patternLayers(theme.pattern, theme.primary, 0.18)
  return (
    <span className={`theme-preview${theme.darkChrome ? ' is-dark' : ''}${theme.festive ? ' is-festive' : ''}`} aria-hidden="true" style={{ '--preview-accent': theme.primary, '--preview-bar': theme.barColor, '--preview-side': theme.sideColor }}>
      <span className="theme-preview-bar"><i /><b /></span>
      <span className="theme-preview-body">
        <span className="theme-preview-side"><i /><i className="is-active" /><i /><i /></span>
        <span className="theme-preview-main" style={{ backgroundImage: pattern.image, backgroundSize: pattern.size, backgroundPosition: pattern.position || '0 0' }}>
          <span className="theme-preview-card"><i /><i /><b /></span>
        </span>
      </span>
    </span>
  )
}

/** Admins choose which Normal and Premium themes team members may pick on their profile. */
function ThemeAccess() {
  const { userThemes, allowUserThemes, saveSettings, loaded } = useAppSettings()
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, notify] = useToast()
  const current = draft || userThemes

  function setThemes(ids, on) {
    const next = new Set(current)
    for (const id of ids) { if (on) next.add(id); else next.delete(id) }
    setDraft(THEMES.map((theme) => theme.id).filter((id) => next.has(id)))
  }

  async function save() {
    if (!current.length) { setError('Leave at least one theme switched on for team members.'); return }
    setSaving(true); setError('')
    try {
      await saveSettings({ userThemes: current })
      setDraft(null); notify('Theme access saved.')
    } catch (issue) { setError(issue.message) } finally { setSaving(false) }
  }

  return (
    <section className="theme-access" aria-labelledby="theme-access-title">
      <Toast toast={toast} />
      <div className="theme-access-header">
        <div>
          <h2 id="theme-access-title" className="feature-section-title">Themes team members can use</h2>
          <p className="profile-hint">Team members can choose only the themes switched on here, on their profile page. Administrators and sub-admins can always use every theme.</p>
        </div>
        <div className="theme-header-actions">
          {draft && <button type="button" className="back-button" onClick={() => { setDraft(null); setError('') }} disabled={saving}>Undo changes</button>}
          <button type="button" className="continue-btn" onClick={save} disabled={!draft || saving || !loaded}>{saving ? <><span className="btn-spinner" aria-hidden="true" /> Saving…</> : <><i className="bi bi-check2" aria-hidden="true" /> Save access</>}</button>
        </div>
      </div>
      {!allowUserThemes && <p className="profile-hint"><i className="bi bi-lock" aria-hidden="true" /> Personal themes are switched off in Feature access, so everyone sees the workspace theme. These choices apply once you switch personal themes back on.</p>}
      <LoadError message={error} />
      {THEME_TIERS.map((tier) => {
        const themes = THEMES.filter((theme) => themeTier(theme) === tier.id)
        const ids = themes.map((theme) => theme.id)
        const onCount = ids.filter((id) => current.includes(id)).length
        const allOn = onCount === ids.length
        return (
          <div key={tier.id} className={`theme-access-group is-${tier.id}`}>
            <div className="theme-access-group-head">
              <span><strong>{tier.name}</strong> {tier.id === 'premium' && <PremiumBadge />}<small>{onCount} of {ids.length} on · {tier.description}</small></span>
              <button type="button" className="back-button" disabled={saving} onClick={() => setThemes(ids, !allOn)}>{allOn ? 'Switch all off' : 'Switch all on'}</button>
            </div>
            <ul className="feature-list">
              {themes.map((theme) => {
                const on = current.includes(theme.id)
                return (
                  <li key={theme.id} className={`feature-row${on ? '' : ' is-off'}`}>
                    <span className="feature-row-icon theme-access-swatch" aria-hidden="true" style={{ '--swatch': theme.primary }} />
                    <span className="feature-row-text"><strong>{theme.name}</strong><small>{theme.description}</small></span>
                    <Switch checked={on} label={`${theme.name} theme for team members`} disabled={saving} onChange={(value) => setThemes([theme.id], value)} />
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </section>
  )
}

export default function ThemeSettings() {
  const { theme: savedTheme, saveSettings, loaded, personalTheme, effectiveTheme } = useAppSettings()
  const [selected, setSelected] = useState(savedTheme)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, notify] = useToast()
  // Settings may finish loading after the page opens; follow the saved theme until the user picks one.
  const [touched, setTouched] = useState(false)
  const current = touched ? selected : savedTheme

  // Leaving the page without saving restores the saved theme.
  useEffect(() => () => { applyTheme(cachedThemeId()) }, [])

  function preview(id) {
    setTouched(true)
    setSelected(id)
    applyTheme(id, { persist: false })
  }

  async function save() {
    setSaving(true); setError('')
    try {
      await saveSettings({ theme: current })
      setTouched(false)
      notify(`${findTheme(current).name} theme applied for everyone.`)
    } catch (issue) { setError(issue.message) } finally { setSaving(false) }
  }

  function resetPreview() {
    setTouched(false)
    applyTheme(effectiveTheme, { persist: false })
  }

  const changed = current !== savedTheme
  return (
    <section className="boarder-box settings-page theme-settings-page">
      <Toast toast={toast} />
      <header className="bill-header settings-page-header">
        <div><h1 className="page-title">Theme settings</h1><p>Choose the colour and background pattern used across the application. Click a theme to preview it, then apply it for all users.</p>{personalTheme && <p className="profile-hint"><i className="bi bi-info-circle" aria-hidden="true" /> You use a personal theme ({findTheme(personalTheme).name}), so after saving you will keep seeing that. Change it on your profile page.</p>}</div>
        <div className="theme-header-actions">
          {changed && <button type="button" className="back-button" onClick={resetPreview} disabled={saving}>Cancel preview</button>}
          <button type="button" className="continue-btn" onClick={save} disabled={!changed || saving || !loaded}>{saving ? <><span className="btn-spinner" aria-hidden="true" /> Applying…</> : <><i className="bi bi-check2" aria-hidden="true" /> Apply theme</>}</button>
        </div>
      </header>
      <LoadError message={error} />
      {THEME_TIERS.map((tier) => (
      <div key={tier.id} className="theme-tier">
      <h2 className="feature-section-title theme-tier-title">{tier.name} {tier.id === 'premium' && <PremiumBadge />}</h2>
      <div className="theme-grid" role="radiogroup" aria-label={`${tier.name} for the workspace`}>
        {THEMES.filter((theme) => themeTier(theme) === tier.id).map((theme) => {
          const isSelected = theme.id === current
          return (
            <button key={theme.id} type="button" role="radio" aria-checked={isSelected} className={`theme-card${isSelected ? ' is-selected' : ''}`} onClick={() => preview(theme.id)} style={{ '--theme-accent': theme.primary }}>
              <ThemePreview theme={theme} />
              <span className="theme-card-body">
                <span className="theme-swatch" aria-hidden="true" />
                <span className="theme-card-text"><strong>{theme.name}</strong><small>{theme.patternName} pattern · {theme.description}</small></span>
                {isSelected && <i className="bi bi-check-circle-fill theme-check" aria-hidden="true" />}
              </span>
              {theme.id === savedTheme && <span className="theme-current-badge">Current</span>}
              {isPremiumTheme(theme) && <span className="theme-card-premium" aria-label="Premium theme"><i className="bi bi-gem" aria-hidden="true" /></span>}
            </button>
          )
        })}
      </div>
      </div>
      ))}

      <ThemeAccess />
    </section>
  )
}

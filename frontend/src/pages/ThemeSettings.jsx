import { useEffect, useState } from 'react'
import { useAppSettings } from '../settings/appSettingsContext.js'
import { applyTheme, cachedThemeId, findTheme, patternLayers, THEMES } from '../theme/themes.js'
import { useToast } from '../hooks/useToast.js'
import Toast from '../components/Toast.jsx'
import LoadError from '../components/LoadError.jsx'

function ThemePreview({ theme }) {
  const pattern = patternLayers(theme.pattern, theme.primary, 0.18)
  return (
    <span className={`theme-preview${theme.darkChrome ? ' is-dark' : ''}`} aria-hidden="true" style={{ '--preview-accent': theme.primary }}>
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
      <div className="theme-grid" role="radiogroup" aria-label="Application theme">
        {THEMES.map((theme) => {
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
            </button>
          )
        })}
      </div>
    </section>
  )
}

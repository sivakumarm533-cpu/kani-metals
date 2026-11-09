import { useState } from 'react'
import { useAppSettings } from '../settings/appSettingsContext.js'
import { NAV_ITEMS, orderNavItems } from '../config/navigation.js'
import { useToast } from '../hooks/useToast.js'
import Toast from '../components/Toast.jsx'
import LoadError from '../components/LoadError.jsx'

const DEFAULT_ORDER = NAV_ITEMS.map((item) => item.key)
const sameOrder = (a, b) => a.length === b.length && a.every((key, index) => key === b[index])

/** Admins and sub-admins arrange the main menu for everyone. */
export default function MenuSettings() {
  const { menuOrder, saveSettings, loaded } = useAppSettings()
  const saved = orderNavItems(menuOrder).map((item) => item.key)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, notify] = useToast()
  const current = draft || saved
  const items = current.map((key) => NAV_ITEMS.find((item) => item.key === key))

  function move(index, step) {
    const target = index + step
    if (target < 0 || target >= current.length) return
    const next = [...current]
    ;[next[index], next[target]] = [next[target], next[index]]
    setDraft(sameOrder(next, saved) ? null : next)
  }

  function resetToDefault() { setDraft(sameOrder(DEFAULT_ORDER, saved) ? null : DEFAULT_ORDER) }

  async function save() {
    setSaving(true); setError('')
    try {
      await saveSettings({ menuOrder: current })
      setDraft(null); notify('Menu order saved. Everyone sees the new order the next time a page loads.')
    } catch (issue) { setError(issue.message) } finally { setSaving(false) }
  }

  return (
    <section className="boarder-box settings-page feature-settings-page">
      <Toast toast={toast} />
      <header className="bill-header settings-page-header">
        <div><h1 className="page-title">Menu order</h1><p>Arrange the screens in the main menu. The order applies to <strong>everyone</strong> in the workspace.</p></div>
        <div className="theme-header-actions">
          {draft && <button type="button" className="back-button" onClick={() => setDraft(null)} disabled={saving}>Undo changes</button>}
          <button type="button" className="continue-btn" onClick={save} disabled={!draft || saving || !loaded}>{saving ? <><span className="btn-spinner" aria-hidden="true" /> Saving…</> : <><i className="bi bi-check2" aria-hidden="true" /> Save changes</>}</button>
        </div>
      </header>
      <LoadError message={error} />

      <div className="feature-summary" role="status"><i className="bi bi-info-circle" aria-hidden="true" /> Use the arrows to move a screen up or down. Team members only see the screens switched on in Feature access.</div>

      <ol className="feature-list menu-order-list">
        {items.map((item, index) => (
          <li key={item.key} className="feature-row">
            <span className="menu-order-number" aria-hidden="true">{index + 1}</span>
            <span className="feature-row-icon" aria-hidden="true"><i className={`bi ${item.icon}`} /></span>
            <span className="feature-row-text"><strong>{item.fullLabel}</strong><small>{item.description}</small></span>
            <span className="menu-order-actions">
              <button type="button" className="menu-order-button" onClick={() => move(index, -1)} disabled={saving || index === 0} aria-label={`Move ${item.fullLabel} up`}><i className="bi bi-arrow-up" aria-hidden="true" /></button>
              <button type="button" className="menu-order-button" onClick={() => move(index, 1)} disabled={saving || index === items.length - 1} aria-label={`Move ${item.fullLabel} down`}><i className="bi bi-arrow-down" aria-hidden="true" /></button>
            </span>
          </li>
        ))}
      </ol>

      <div className="menu-order-footer">
        <button type="button" className="back-button" onClick={resetToDefault} disabled={saving || sameOrder(current, DEFAULT_ORDER)}><i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Reset to default order</button>
      </div>
    </section>
  )
}

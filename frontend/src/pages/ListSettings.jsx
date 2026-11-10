import { useId, useState } from 'react'
import { useAppSettings } from '../settings/appSettingsContext.js'
import { useToast } from '../hooks/useToast.js'
import Toast from '../components/Toast.jsx'
import { ConfirmDialog } from '../components/ui.jsx'

/*
 * Settings → Dropdown lists. Admins and sub-admins add, rename, reorder and delete the
 * choices offered in form dropdowns. Saved bills, items and dealers keep their values:
 * a renamed or deleted choice only stops being offered for new entries.
 */

const LISTS = [
  { key: 'itemCategories', icon: 'bi-tags', title: 'Item categories', single: 'category', usedIn: 'Bill items (Item entry), Inventory and Item prices', placeholder: 'For example: Copper', max: 60 },
  { key: 'dealerCategories', icon: 'bi-people', title: 'Dealer categories', single: 'dealer category', usedIn: 'Add / edit dealer (Item entry)', placeholder: 'For example: Retail Dealer', max: 60 },
  { key: 'units', icon: 'bi-rulers', title: 'Units', single: 'unit', usedIn: 'Bill items, Inventory and Item prices', placeholder: 'For example: quintal', max: 20 },
]

function ListSection({ list, values, onSave, busy }) {
  const [adding, setAdding] = useState('')
  const [editing, setEditing] = useState(null) // { index, text }
  const [removing, setRemoving] = useState(null) // index
  const [error, setError] = useState('')
  const inputId = useId()

  const exists = (text, except = -1) => values.some((value, index) => index !== except && value.toLowerCase() === text.trim().toLowerCase())

  async function save(next, message) {
    setError('')
    try { await onSave(list.key, next, message); return true } catch (issue) { setError(issue.message); return false }
  }

  async function add(event) {
    event.preventDefault()
    const text = adding.trim().replace(/\s+/g, ' ')
    if (!text) return
    if (exists(text)) { setError(`"${text}" is already in the list.`); return }
    if (await save([...values, text], `"${text}" added to ${list.title.toLowerCase()}.`)) setAdding('')
  }

  async function rename(event) {
    event.preventDefault()
    const text = editing.text.trim().replace(/\s+/g, ' ')
    if (!text) { setError(`Enter a name for the ${list.single}.`); return }
    if (exists(text, editing.index)) { setError(`"${text}" is already in the list.`); return }
    const old = values[editing.index]
    if (text === old) { setEditing(null); return }
    const next = values.map((value, index) => (index === editing.index ? text : value))
    if (await save(next, `"${old}" renamed to "${text}".`)) setEditing(null)
  }

  async function move(index, step) {
    const target = index + step
    if (target < 0 || target >= values.length) return
    const next = [...values]
    ;[next[index], next[target]] = [next[target], next[index]]
    await save(next, 'Order saved.')
  }

  async function remove() {
    const old = values[removing]
    if (await save(values.filter((_, index) => index !== removing), `"${old}" removed from ${list.title.toLowerCase()}.`)) setRemoving(null)
  }

  return (
    <section className="list-section" aria-labelledby={`${inputId}-title`}>
      <header className="list-section-head">
        <span className="feature-row-icon" aria-hidden="true"><i className={`bi ${list.icon}`} /></span>
        <div><h2 id={`${inputId}-title`}>{list.title}</h2><p>Used in: {list.usedIn}</p></div>
        <span className="list-count">{values.length}</span>
      </header>
      {error && <p className="payment-form-error" role="alert">{error}</p>}

      <ol className="list-rows">
        {values.map((value, index) => (
          <li key={`${value}-${index}`} className="list-row">
            {editing?.index === index ? (
              <form className="list-edit" onSubmit={rename}>
                <label className="visually-hidden" htmlFor={`${inputId}-edit`}>New name for {value}</label>
                <input id={`${inputId}-edit`} data-autofocus autoFocus value={editing.text} maxLength={list.max} onChange={(event) => setEditing({ index, text: event.target.value })} onKeyDown={(event) => { if (event.key === 'Escape') setEditing(null) }} />
                <button type="submit" className="continue-btn" disabled={busy}>Save</button>
                <button type="button" className="back-button" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
              </form>
            ) : <>
              <span className="list-row-number" aria-hidden="true">{index + 1}</span>
              <span className="list-row-name">{value}</span>
              <span className="list-row-actions">
                <button type="button" className="list-icon-btn" onClick={() => move(index, -1)} disabled={busy || index === 0} aria-label={`Move ${value} up`}><i className="bi bi-arrow-up" aria-hidden="true" /></button>
                <button type="button" className="list-icon-btn" onClick={() => move(index, 1)} disabled={busy || index === values.length - 1} aria-label={`Move ${value} down`}><i className="bi bi-arrow-down" aria-hidden="true" /></button>
                <button type="button" className="list-icon-btn" onClick={() => { setError(''); setEditing({ index, text: value }) }} disabled={busy} aria-label={`Rename ${value}`}><i className="bi bi-pencil" aria-hidden="true" /></button>
                <button type="button" className="list-icon-btn is-danger" onClick={() => setRemoving(index)} disabled={busy || values.length === 1} aria-label={`Delete ${value}`} title={values.length === 1 ? 'Keep at least one choice' : undefined}><i className="bi bi-trash" aria-hidden="true" /></button>
              </span>
            </>}
          </li>
        ))}
      </ol>

      <form className="list-add" onSubmit={add}>
        <label htmlFor={inputId} className="visually-hidden">New {list.single}</label>
        <input id={inputId} value={adding} maxLength={list.max} onChange={(event) => setAdding(event.target.value)} placeholder={list.placeholder} />
        <button type="submit" className="continue-btn" disabled={busy || !adding.trim()}><i className="bi bi-plus-lg" aria-hidden="true" /> Add</button>
      </form>

      {removing !== null && (
        <ConfirmDialog
          tone="danger"
          title={`Delete "${values[removing]}"?`}
          message={`It will no longer be offered in forms. Bills, items and dealers that already use "${values[removing]}" keep it.`}
          confirmLabel="Delete"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setRemoving(null)}
        />
      )}
    </section>
  )
}

export default function ListSettings() {
  const { lists, saveSettings } = useAppSettings()
  const [busy, setBusy] = useState(false)
  const [toast, notify] = useToast()

  async function saveList(key, values, message) {
    setBusy(true)
    try { await saveSettings({ lists: { [key]: values } }); notify(message) } finally { setBusy(false) }
  }

  return (
    <section className="boarder-box settings-page list-settings-page">
      <Toast toast={toast} />
      <header className="bill-header settings-page-header">
        <div><h1 className="page-title">Dropdown lists</h1><p>Choose the categories and units people can pick in forms. Changes apply to <strong>everyone</strong>.</p></div>
      </header>
      <div className="feature-summary" role="status"><i className="bi bi-info-circle" aria-hidden="true" /><span>Renaming or deleting a choice does not change saved bills, items or dealers. They keep the name they were saved with.</span></div>
      <div className="list-sections">
        {LISTS.map((list) => <ListSection key={list.key} list={list} values={lists[list.key]} onSave={saveList} busy={busy} />)}
      </div>
    </section>
  )
}

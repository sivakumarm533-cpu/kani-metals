import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import { LOW_STOCK_LIMIT, useProducts } from '../hooks/useProducts.js'
import LoadError from '../components/LoadError.jsx'
import Modal from '../components/Modal.jsx'
import Toast from '../components/Toast.jsx'
import { useToast } from '../hooks/useToast.js'
import { compressImage } from '../utils/image.js'
import { formatRupees } from '../utils/format.js'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
import { FloatingActionButton, StatusBadge } from '../components/ui.jsx'
import './Inventory.css'

/*
 * Inventory: items added here can be picked when creating a bill.
 * Stock changes only by hand here: select items, then "Update stock".
 * Saving a bill never changes stock.
 */

const UNITS = ['kg', 'pcs', 'ton', 'g', 'litre', 'metre', 'bundle']
const CATEGORIES = ['Metal', 'Plastic', 'Paper', 'Electronics']
const qty = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })
const shortDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const isLow = (item) => item.quantity <= LOW_STOCK_LIMIT
const MODES = [['add', 'Add', 'bi-plus-lg'], ['remove', 'Remove', 'bi-dash-lg'], ['set', 'Set to', 'bi-pencil']]

function AddItemModal({ categories, onClose, onAdded, notify }) {
  const [form, setForm] = useState({ name: '', category: 'Metal', unit: 'kg', quantity: '', price: '', image: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function choosePhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try { const image = await compressImage(file, { maxSize: 800 }); setForm((current) => ({ ...current, image })) }
    catch (readError) { event.target.value = ''; setError(readError.message) }
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await apiRequest('/inventory/items', { method: 'POST', body: JSON.stringify(form) })
      notify(result.message)
      onAdded()
    } catch (saveError) { setError(saveError.message); setBusy(false) }
  }

  return (
    <Modal className="payment-modal stock-modal" backdropClassName="payment-modal-backdrop" busy={busy} onClose={onClose} labelledBy="inv-add-title">
      <div className="payment-modal-heading">
        <div><span className="payment-eyebrow">INVENTORY</span><h2 id="inv-add-title">Add an item</h2></div>
        <button type="button" className="payment-close" aria-label="Close dialog" onClick={onClose}>×</button>
      </div>
      <p className="stock-help">This item can then be picked when you create a bill. Bills do not change stock.</p>
      <form className="stock-form" onSubmit={submit}>
        <div className="stock-photo">
          {form.image ? <img src={form.image} alt="Selected item" /> : <span><i className="bi bi-image" aria-hidden="true" />No photo</span>}
          <div>
            <label className="stock-photo-button"><i className="bi bi-camera" aria-hidden="true" />{form.image ? 'Change photo' : 'Add photo'}
              <input className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={choosePhoto} />
            </label>
            {form.image && <button type="button" className="stock-photo-button" onClick={() => setForm((current) => ({ ...current, image: '' }))}><i className="bi bi-x-lg" aria-hidden="true" />Remove</button>}
            <small>Optional. It is used on bills too.</small>
          </div>
        </div>
        <label>Item name<input data-autofocus required maxLength="120" value={form.name} onChange={set('name')} placeholder="For example: Copper wire scrap" /></label>
        <div className="stock-grid">
          <label>Category<input list="inv-categories" required maxLength="60" value={form.category} onChange={set('category')} /></label>
          <datalist id="inv-categories">{categories.map((name) => <option key={name} value={name} />)}</datalist>
          <label>Unit<select value={form.unit} onChange={set('unit')}>{UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label>
        </div>
        <div className="stock-grid">
          <label>Opening stock ({form.unit})<input type="number" inputMode="decimal" min="0" step="any" value={form.quantity} onChange={set('quantity')} placeholder="0" /></label>
          <label>Price per {form.unit} (₹)<input type="number" inputMode="decimal" min="0" step="0.01" value={form.price} onChange={set('price')} placeholder="0.00" /><small className="stock-field-help">Filled in on the bill; you can change it there.</small></label>
        </div>
        {error && <p className="payment-form-error" role="alert">{error}</p>}
        <div className="payment-modal-actions">
          <button type="button" className="back-button" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="continue-btn" disabled={busy}>{busy ? 'Adding…' : 'Add item'}</button>
        </div>
      </form>
    </Modal>
  )
}

/** Changes only the stock quantity of the selected items. */
function StockModal({ items, onClose, onSaved, notify, initialMode = 'add' }) {
  const [rows, setRows] = useState(() => items.map((item) => ({ id: item._id, mode: initialMode, amount: '' })))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = (id, patch) => setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))

  const preview = rows.map((row) => {
    const item = items.find((entry) => entry._id === row.id)
    const amount = Number(row.amount)
    const valid = row.amount !== '' && Number.isFinite(amount) && amount >= 0 && (row.mode === 'set' || amount > 0)
    const after = !valid ? null : row.mode === 'set' ? amount : row.mode === 'add' ? item.quantity + amount : item.quantity - amount
    return { row, item, valid, after: after === null ? null : Math.round(after * 1000) / 1000 }
  })
  const ready = preview.every((entry) => entry.valid && entry.after >= 0)

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await apiRequest('/inventory/stock', { method: 'PATCH', body: JSON.stringify({ changes: rows, note }) })
      notify(result.message, 'success', 'bi-boxes')
      onSaved()
    } catch (saveError) { setError(saveError.message); setBusy(false) }
  }

  return (
    <Modal className="payment-modal stock-modal stock-update" backdropClassName="payment-modal-backdrop" busy={busy} onClose={onClose} labelledBy="inv-stock-title">
      <div className="payment-modal-heading">
        <div><span className="payment-eyebrow">UPDATE STOCK</span><h2 id="inv-stock-title">{items.length === 1 ? items[0].name : `${items.length} items`}</h2></div>
        <button type="button" className="payment-close" aria-label="Close dialog" onClick={onClose}>×</button>
      </div>
      <p className="stock-help">Only the stock quantity changes. Name, price and photo stay the same.</p>
      <form className="stock-form" onSubmit={save}>
        <ul className="stock-rows">
          {preview.map(({ row, item, valid, after }) => (
            <li key={row.id} className="stock-row">
              <div className="stock-row-head">
                <strong>{item.name}</strong>
                <span>Now <b>{qty(item.quantity)} {item.unit}</b></span>
              </div>
              <div className="stock-row-controls">
                <div className="stock-mode" role="radiogroup" aria-label={`How to change ${item.name}`}>
                  {MODES.map(([mode, label, icon]) => (
                    <button key={mode} type="button" role="radio" aria-checked={row.mode === mode} className={row.mode === mode ? 'is-active' : ''} onClick={() => update(row.id, { mode })}>
                      <i className={`bi ${icon}`} aria-hidden="true" />{label}
                    </button>
                  ))}
                </div>
                <label className="stock-amount">
                  <span className="visually-hidden">Quantity for {item.name}</span>
                  <input type="number" inputMode="decimal" min="0" step="any" required value={row.amount} onChange={(event) => update(row.id, { amount: event.target.value })} placeholder="0" />
                  <span>{item.unit}</span>
                </label>
              </div>
              <p className={`stock-result${valid && after < 0 ? ' is-error' : ''}`} aria-live="polite">
                {!valid ? 'Enter a quantity' : after < 0 ? `Only ${qty(item.quantity)} ${item.unit} in stock` : <>New stock: <b>{qty(after)} {item.unit}</b>{after <= LOW_STOCK_LIMIT && <span className="stock-pill is-low">Low</span>}</>}
              </p>
            </li>
          ))}
        </ul>
        <label>Note (optional)<input maxLength="200" value={note} onChange={(event) => setNote(event.target.value)} placeholder="For example: counted on 9 Nov" /></label>
        {error && <p className="payment-form-error" role="alert">{error}</p>}
        <div className="payment-modal-actions">
          <button type="button" className="back-button" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="continue-btn" disabled={busy || !ready}>{busy ? 'Saving…' : 'Save stock'}</button>
        </div>
      </form>
    </Modal>
  )
}

function HistoryModal({ item, onClose }) {
  const [state, setState] = useState({ loading: true, error: '', history: [] })
  useEffect(() => {
    let active = true
    apiRequest(`/inventory/items/${item._id}/history`)
      .then((data) => { if (active) setState({ loading: false, error: '', history: data.history || [] }) })
      .catch((error) => { if (active) setState({ loading: false, error: error.message, history: [] }) })
    return () => { active = false }
  }, [item._id])
  const label = { opening: 'Opening stock', add: 'Added', remove: 'Removed', set: 'Set to' }
  return (
    <Modal className="payment-modal stock-modal" backdropClassName="payment-modal-backdrop" onClose={onClose} labelledBy="inv-history-title">
      <div className="payment-modal-heading">
        <div><span className="payment-eyebrow">STOCK HISTORY</span><h2 id="inv-history-title">{item.name}</h2></div>
        <button type="button" className="payment-close" aria-label="Close dialog" onClick={onClose}>×</button>
      </div>
      <LoadError message={state.error} />
      {state.loading && <span className="payment-skeleton stock-history-skeleton" />}
      {!state.loading && !state.error && (state.history.length
        ? <ul className="stock-history">{state.history.map((entry, index) => (
            <li key={`${entry.changedAt}-${index}`}>
              <span className={`stock-history-icon is-${entry.mode}`} aria-hidden="true"><i className={`bi ${entry.mode === 'remove' ? 'bi-dash-lg' : entry.mode === 'set' ? 'bi-pencil' : 'bi-plus-lg'}`} /></span>
              <span className="stock-history-text">
                <strong>{label[entry.mode]} {entry.mode === 'set' ? `${qty(entry.after)} ${item.unit}` : `${qty(entry.amount)} ${item.unit}`}</strong>
                <small>{qty(entry.before)} → {qty(entry.after)} {item.unit} · {shortDate(entry.changedAt)}{entry.changedByName ? ` · ${entry.changedByName}` : ''}{entry.note && entry.mode !== 'opening' ? ` · “${entry.note}”` : ''}</small>
              </span>
            </li>
          ))}</ul>
        : <p className="stock-help">No stock changes recorded yet. Changes made from now on are listed here.</p>)}
    </Modal>
  )
}

/** Phone card for one inventory item. */
function InventoryCard({ item, max, checked, onToggle, onStock, onHistory }) {
  const low = isLow(item)
  const percent = max > 0 ? Math.max(item.quantity > 0 ? 3 : 0, Math.round((item.quantity / max) * 100)) : 0
  return (
    <li className={`inv-card${checked ? ' is-selected' : ''}${low ? ' is-low' : ''}`}>
      <div className="inv-card-top">
        <label className="inv-card-check">
          <input type="checkbox" checked={checked} onChange={onToggle} />
          <span className="visually-hidden">Select {item.name}</span>
        </label>
        <span className="inventory-thumb" aria-hidden="true">{item.image ? <img src={item.image} alt="" loading="lazy" /> : <i className="bi bi-box-seam" />}</span>
        <span className="inv-card-name"><strong>{item.name}</strong><small>{item.category}{item.price ? ` · ${formatRupees(item.price)} / ${item.unit}` : ''}</small></span>
        <button type="button" className="inv-card-history" onClick={onHistory} aria-label={`Stock history of ${item.name}`}><i className="bi bi-clock-history" aria-hidden="true" /></button>
      </div>
      <div className="inv-card-stock">
        <span className="inv-card-qty"><b>{qty(item.quantity)}</b> {item.unit}</span>
        {low ? <StatusBadge tone="warning" icon="bi-exclamation-triangle">Low stock</StatusBadge> : <StatusBadge tone="success" icon="bi-check2">In stock</StatusBadge>}
      </div>
      <span className={`stock-bar${low ? ' is-low' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={max || 0} aria-valuenow={item.quantity} aria-label={`${item.name} stock compared with the largest ${item.unit} stock`}><span style={{ width: `${percent}%` }} /></span>
      <div className="inv-card-actions">
        <button type="button" onClick={() => onStock('add')}><i className="bi bi-plus-lg" aria-hidden="true" />Add</button>
        <button type="button" onClick={() => onStock('remove')}><i className="bi bi-dash-lg" aria-hidden="true" />Remove</button>
        <button type="button" onClick={() => onStock('set')}><i className="bi bi-pencil" aria-hidden="true" />Set</button>
      </div>
      <small className="inv-card-updated">Stock updated {shortDate(item.stockUpdatedAt || item.updatedAt)}{item.stockUpdatedByName ? ` · ${item.stockUpdatedByName}` : ''}</small>
    </li>
  )
}

function Inventory() {
  const isPhone = useMediaQuery('(max-width: 720px)')
  const { products, loading, error, retry } = useProducts()
  const [search, setSearch] = useState('')
  const [searchParams] = useSearchParams()
  // ?filter=low opens the list on low-stock items (used by the dashboard alerts).
  const [filter, setFilter] = useState(() => (searchParams.get('filter') === 'low' ? 'low' : 'all'))
  const [selected, setSelected] = useState(() => new Set())
  const [modal, setModal] = useState(null)
  const [toast, notify] = useToast()

  const categories = useMemo(() => [...new Set([...CATEGORIES, ...products.map((item) => item.category).filter(Boolean)])], [products])
  const lowCount = products.filter(isLow).length
  // Phone stock bars compare items that use the same unit.
  const maxByUnit = useMemo(() => {
    const map = new Map()
    for (const item of products) map.set(item.unit, Math.max(map.get(item.unit) || 0, item.quantity || 0))
    return map
  }, [products])
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter((item) => (filter === 'all' || isLow(item)) && (!term || `${item.name} ${item.category}`.toLowerCase().includes(term)))
  }, [products, search, filter])
  // Only items that still exist count as selected.
  const selectedItems = products.filter((item) => selected.has(item._id))
  const allShownSelected = shown.length > 0 && shown.every((item) => selected.has(item._id))

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current)
      for (const item of shown) { if (allShownSelected) next.delete(item._id); else next.add(item._id) }
      return next
    })
  }
  function afterSave() {
    setModal(null)
    setSelected(new Set())
    retry()
  }

  return (
    <section className="page-container inventory-page">
      <Toast toast={toast} />
      <header className="page-header inventory-head">
        <div>
          <p className="eyebrow">STOCK MANAGEMENT</p>
          <h1 className="page-title">Inventory</h1>
          <p className="page-description">Add items to use on bills. Select items to update their stock — bills do not change stock.</p>
        </div>
        <button type="button" className="continue-btn inventory-add" onClick={() => setModal({ type: 'add' })}><i className="bi bi-plus-lg" aria-hidden="true" />Add item</button>
      </header>

      <div className="inventory-toolbar">
        <label className="dealer-pick-search">
          <i className="bi bi-search" aria-hidden="true" />
          <span className="visually-hidden">Search inventory</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item or category" />
        </label>
        <div className="dealer-pick-chips" role="radiogroup" aria-label="Show">
          {[['all', `All (${products.length})`], ['low', `Low stock (${lowCount})`]].map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={filter === id} className={`dealer-pick-chip${filter === id ? ' is-active' : ''}`} onClick={() => setFilter(id)}>{label}</button>)}
        </div>
      </div>

      <LoadError message={error} onRetry={retry} />
      {isPhone ? <>
        {shown.length > 0 && <label className="inv-select-all"><input type="checkbox" checked={allShownSelected} onChange={toggleAll} /> Select all shown ({shown.length})</label>}
        {loading && <ul className="inv-cards" aria-hidden="true">{Array.from({ length: 3 }, (_, index) => <li key={index}><span className="skeleton inv-card-skeleton" /></li>)}</ul>}
        {!loading && shown.length > 0 && <ul className="inv-cards">
          {shown.map((item) => <InventoryCard key={item._id} item={item} max={maxByUnit.get(item.unit)} checked={selected.has(item._id)} onToggle={() => toggle(item._id)} onStock={(mode) => setModal({ type: 'stock', items: [item], mode })} onHistory={() => setModal({ type: 'history', item })} />)}
        </ul>}
        {!loading && !error && products.length === 0 && <div className="empty-state empty-state-panel"><i className="bi bi-box-seam" aria-hidden="true" /><strong>No inventory items yet</strong><span>Add an item to track its stock and pick it on bills.</span></div>}
        {!loading && products.length > 0 && !shown.length && <p className="stock-help">No items match.</p>}
      </> : <div className="table-responsive inventory-table-wrap">
        <table className="table align-middle inventory-table responsive-card-table">
          <thead>
            <tr>
              <th scope="col" className="inventory-check-col"><input type="checkbox" aria-label="Select all shown items" checked={allShownSelected} disabled={!shown.length} onChange={toggleAll} /></th>
              <th scope="col">Item</th><th scope="col">Stock</th><th scope="col">Price</th><th scope="col">Status</th><th scope="col">Last stock update</th><th scope="col"><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 4 }, (_, index) => (
              <tr key={index} className="table-skeleton-row"><td colSpan="7"><span className="skeleton skeleton-line" /></td></tr>
            ))}
            {!loading && shown.map((item) => {
              const low = isLow(item)
              const checked = selected.has(item._id)
              return (
                <tr key={item._id} className={checked ? 'is-selected' : ''}>
                  <td className="inventory-check-col"><input type="checkbox" checked={checked} onChange={() => toggle(item._id)} aria-label={`Select ${item.name}`} /></td>
                  <td data-label="Item">
                    <span className="inventory-item">
                      <span className="inventory-thumb" aria-hidden="true">{item.image ? <img src={item.image} alt="" loading="lazy" /> : <i className="bi bi-box-seam" />}</span>
                      <span><strong>{item.name}</strong><small>{item.category}</small></span>
                    </span>
                  </td>
                  <td data-label="Stock" className="inventory-qty"><span className="stock-value"><b>{qty(item.quantity)}</b> {item.unit}</span></td>
                  <td data-label="Price">{item.price ? `${formatRupees(item.price)} / ${item.unit}` : '—'}</td>
                  <td data-label="Status"><span className={`stock-pill${low ? ' is-low' : ''}`}>{low ? 'Low stock' : 'In stock'}</span></td>
                  <td data-label="Last stock update"><span className="inventory-updated">{shortDate(item.stockUpdatedAt || item.updatedAt)}{item.stockUpdatedByName && <small>{item.stockUpdatedByName}</small>}</span></td>
                  <td className="inventory-actions">
                    <button type="button" className="inventory-icon-btn" onClick={() => setModal({ type: 'stock', items: [item] })} aria-label={`Update stock of ${item.name}`} title="Update stock"><i className="bi bi-pencil-square" aria-hidden="true" /></button>
                    <button type="button" className="inventory-icon-btn" onClick={() => setModal({ type: 'history', item })} aria-label={`Stock history of ${item.name}`} title="Stock history"><i className="bi bi-clock-history" aria-hidden="true" /></button>
                  </td>
                </tr>
              )
            })}
            {!loading && !error && products.length === 0 && (
              <tr className="table-empty-row"><td colSpan="7"><div className="empty-state"><i className="bi bi-box-seam" aria-hidden="true" /><strong>No inventory items yet</strong><span>Add an item to track its stock and pick it on bills.</span><button type="button" className="continue-btn" onClick={() => setModal({ type: 'add' })}>Add item</button></div></td></tr>
            )}
            {!loading && products.length > 0 && !shown.length && (
              <tr className="table-empty-row"><td colSpan="7"><p className="stock-help">No items match.</p></td></tr>
            )}
          </tbody>
        </table>
      </div>}

      {isPhone && !selectedItems.length && !modal && <FloatingActionButton icon="bi-plus-lg" label="Add item" onClick={() => setModal({ type: 'add' })} />}
      {selectedItems.length > 0 && (
        <div className="inventory-selection" role="region" aria-label="Selected items">
          <span><b>{selectedItems.length}</b> selected</span>
          <button type="button" className="back-button" onClick={() => setSelected(new Set())}>Clear</button>
          <button type="button" className="continue-btn" onClick={() => setModal({ type: 'stock', items: selectedItems })}><i className="bi bi-boxes" aria-hidden="true" />Update stock</button>
        </div>
      )}

      {modal?.type === 'add' && <AddItemModal categories={categories} notify={notify} onClose={() => setModal(null)} onAdded={afterSave} />}
      {modal?.type === 'stock' && <StockModal items={modal.items} initialMode={modal.mode} notify={notify} onClose={() => setModal(null)} onSaved={afterSave} />}
      {modal?.type === 'history' && <HistoryModal item={modal.item} onClose={() => setModal(null)} />}
    </section>
  )
}

export default Inventory

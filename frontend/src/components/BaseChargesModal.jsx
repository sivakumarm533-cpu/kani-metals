import { useState } from 'react'
import Modal from './Modal.jsx'
import { apiRequest } from '../services/api.js'
import { formatPaise, paiseToInput } from '../utils/staff.js'
import { BASE_CHARGE_PRESETS } from '../utils/vehicles.js'

let nextKey = 0
const newRow = (month, label = '') => ({ key: `new-${(nextKey += 1)}`, label, amount: '', period: label === 'EMI' || label === 'Parking rent' ? 'month' : 'year', from: month, to: '' })

/**
 * Edit a vehicle's base charges: fixed costs such as insurance, EMI, road tax, permit and FC.
 * Yearly amounts count 1/12 in each month's running cost.
 */
export default function BaseChargesModal({ vehicle, month, onClose, onSaved }) {
  const [rows, setRows] = useState(() => (vehicle.baseCharges || []).map((charge) => ({ key: charge._id, label: charge.label, amount: paiseToInput(charge.amountPaise), period: charge.period, from: charge.from, to: charge.to || '' })))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = (key, patch) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  const remove = (key) => setRows((current) => current.filter((row) => row.key !== key))
  const add = (label = '') => setRows((current) => [...current, newRow(month, label)])
  const used = new Set(rows.map((row) => row.label.trim().toLowerCase()))
  const monthly = rows.reduce((total, row) => {
    const paise = Math.round((Number(row.amount) || 0) * 100)
    const active = row.from <= month && (!row.to || month <= row.to)
    return active ? total + (row.period === 'year' ? Math.round(paise / 12) : paise) : total
  }, 0)

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const baseCharges = rows.map(({ label, amount, period, from, to }) => ({ label, amount, period, from, to }))
      await apiRequest(`/vehicles/${vehicle._id}/base-charges`, { method: 'PUT', body: JSON.stringify({ baseCharges }) })
      onSaved('Base charges saved.')
    } catch (saveError) { setError(saveError.message); setBusy(false) }
  }

  return (
    <Modal className="payment-modal stock-modal staff-modal base-charges-modal" backdropClassName="payment-modal-backdrop" busy={busy} onClose={onClose} labelledBy="base-charges-title">
      <div className="payment-modal-heading">
        <div><span className="payment-eyebrow">{vehicle.name.toUpperCase()}{vehicle.number ? ` · ${vehicle.number}` : ''}</span><h2 id="base-charges-title">Base charges</h2></div>
        <button type="button" className="payment-close" aria-label="Close dialog" onClick={onClose}>×</button>
      </div>
      <p className="stock-help">Fixed costs the vehicle has even when it is not driven. Each month's share is added to the running cost and cost per km. Yearly amounts count 1/12 every month.</p>
      <form className="stock-form" onSubmit={save}>
        {rows.length === 0 && <p className="base-charges-empty">No base charges yet. Add one below.</p>}
        <ul className="base-charge-rows">
          {rows.map((row, index) => (
            <li key={row.key} className="base-charge-row">
              <div className="base-charge-row-head">
                <label className="base-charge-name">Charge<input required maxLength="60" value={row.label} onChange={(event) => update(row.key, { label: event.target.value })} placeholder="e.g. Insurance" data-autofocus={index === rows.length - 1 && !row.label ? true : undefined} /></label>
                <button type="button" className="inventory-icon-btn" aria-label={`Remove ${row.label || 'this charge'}`} onClick={() => remove(row.key)}><i className="bi bi-trash" aria-hidden="true" /></button>
              </div>
              <div className="stock-grid">
                <label>Amount (₹)<input type="number" inputMode="decimal" required min="0.01" step="0.01" value={row.amount} onChange={(event) => update(row.key, { amount: event.target.value })} placeholder="0" /></label>
                <div className="base-charge-period">
                  <span>Paid</span>
                  <div className="stock-mode" role="radiogroup" aria-label={`How often ${row.label || 'this charge'} is paid`}>
                    {[['month', 'Monthly'], ['year', 'Yearly']].map(([id, label]) => (
                      <button key={id} type="button" role="radio" aria-checked={row.period === id} className={row.period === id ? 'is-active' : ''} onClick={() => update(row.key, { period: id })}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="stock-grid">
                <label>From month<input type="month" required value={row.from} onChange={(event) => update(row.key, { from: event.target.value })} /></label>
                <label>Until month<input type="month" min={row.from} value={row.to} onChange={(event) => update(row.key, { to: event.target.value })} /><small className="stock-field-help">Leave empty if still paying.</small></label>
              </div>
              {row.period === 'year' && Number(row.amount) > 0 && <small className="stock-field-help">{formatPaise(Math.round((Number(row.amount) * 100) / 12))} a month</small>}
            </li>
          ))}
        </ul>
        <div className="base-charge-presets" aria-label="Add a base charge">
          {BASE_CHARGE_PRESETS.filter((label) => !used.has(label.toLowerCase())).map((label) => (
            <button key={label} type="button" className="ui-chip" onClick={() => add(label)}><i className="bi bi-plus" aria-hidden="true" />{label}</button>
          ))}
          <button type="button" className="ui-chip" onClick={() => add()}><i className="bi bi-plus" aria-hidden="true" />Other</button>
        </div>
        <p className="base-charge-total"><span>Base charges this month</span><b>{formatPaise(monthly)}</b></p>
        {error && <p className="payment-form-error" role="alert">{error}</p>}
        <div className="payment-modal-actions">
          <button type="button" className="back-button" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="continue-btn" disabled={busy}>{busy ? 'Saving…' : 'Save base charges'}</button>
        </div>
      </form>
    </Modal>
  )
}

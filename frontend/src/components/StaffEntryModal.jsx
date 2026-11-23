import { useState } from 'react'
import Modal from './Modal.jsx'
import { apiRequest } from '../services/api.js'
import { localDateInputValue } from '../utils/format.js'
import { entryInfo, formatPaise, PAYMENT_METHODS } from '../utils/staff.js'
import { readChoice, saveChoice } from '../utils/remember.js'

/** Payment, advance, bonus or deduction. */
export default function EntryModal({ employee, type, balanceDuePaise, date, amountPaise, onClose, onSaved }) {
  const info = entryInfo(type)
  const paidOut = type === 'payment' || type === 'advance'
  const [form, setForm] = useState({ amount: amountPaise > 0 ? String(amountPaise / 100) : type === 'payment' && balanceDuePaise > 0 ? String(balanceDuePaise / 100) : '', date: date || localDateInputValue(), paymentMethod: readChoice('wagePaymentMethod', 'cash', PAYMENT_METHODS.map(([id]) => id)), notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/employees/${employee._id}/entries`, { method: 'POST', body: JSON.stringify({ ...form, type, paymentMethod: paidOut ? form.paymentMethod : undefined }) })
      onSaved(`${info.label} of ${formatPaise(Math.round(Number(form.amount) * 100))} saved.`, { amountPaise: Math.round(Number(form.amount) * 100), date: form.date, type })
    } catch (saveError) { setError(saveError.message); setBusy(false) }
  }

  return (
    <Modal className="payment-modal stock-modal staff-modal" backdropClassName="payment-modal-backdrop" busy={busy} onClose={onClose} labelledBy="staff-entry-title">
      <div className="payment-modal-heading">
        <div><span className="payment-eyebrow">{employee.name.toUpperCase()}</span><h2 id="staff-entry-title">{info.verb}</h2></div>
        <button type="button" className="payment-close" aria-label="Close dialog" onClick={onClose}>×</button>
      </div>
      <p className="stock-help">{info.help}{balanceDuePaise !== undefined && <> Balance to pay now: <b>{formatPaise(balanceDuePaise)}</b>.</>}</p>
      <form className="stock-form" onSubmit={submit}>
        <div className="stock-grid">
          <label>Amount (₹)<input data-autofocus type="number" inputMode="decimal" required min="0.01" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0" /></label>
          <label>Date<input type="date" required max={localDateInputValue()} value={form.date} onChange={set('date')} /></label>
        </div>
        {paidOut && <label>Paid by<select value={form.paymentMethod} onChange={(event) => { saveChoice('wagePaymentMethod', event.target.value); set('paymentMethod')(event) }}>{PAYMENT_METHODS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
        <label>Note<input maxLength="500" value={form.notes} onChange={set('notes')} placeholder={type === 'deduction' ? 'Reason' : 'Optional'} /></label>
        {error && <p className="payment-form-error" role="alert">{error}</p>}
        <div className="payment-modal-actions">
          <button type="button" className="back-button" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="continue-btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

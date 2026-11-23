import { useState } from 'react'
import Modal from './Modal.jsx'
import { apiRequest } from '../services/api.js'
import { localDateInputValue } from '../utils/format.js'
import { formatPaise } from '../utils/staff.js'
import { formatKm, vehicleEntryInfo } from '../utils/vehicles.js'

/** Fuel fill, service / repair or other expense for one vehicle. */
export default function VehicleEntryModal({ vehicle, type, lastOdometerKm = 0, onClose, onSaved }) {
  const info = vehicleEntryInfo(type)
  const fuel = type === 'fuel'
  const today = localDateInputValue()
  const [form, setForm] = useState({ amount: type === 'daily' && vehicle.dailyChargePaise ? String(vehicle.dailyChargePaise / 100) : '', litres: '', odometerKm: '', date: today, notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const pricePerLitre = fuel && Number(form.amount) > 0 && Number(form.litres) > 0 ? Math.round((Number(form.amount) / Number(form.litres)) * 100) : 0
  const sinceLast = lastOdometerKm && Number(form.odometerKm) > lastOdometerKm ? Number(form.odometerKm) - lastOdometerKm : 0

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/vehicles/${vehicle._id}/entries`, { method: 'POST', body: JSON.stringify({ ...form, type }) })
      onSaved(`${info.label} of ${formatPaise(Math.round(Number(form.amount) * 100))} saved.`)
    } catch (saveError) { setError(saveError.message); setBusy(false) }
  }

  return (
    <Modal className="payment-modal stock-modal staff-modal" backdropClassName="payment-modal-backdrop" busy={busy} onClose={onClose} labelledBy="vehicle-entry-title">
      <div className="payment-modal-heading">
        <div><span className="payment-eyebrow">{vehicle.name.toUpperCase()}{vehicle.number ? ` · ${vehicle.number}` : ''}</span><h2 id="vehicle-entry-title">{info.verb}</h2></div>
        <button type="button" className="payment-close" aria-label="Close dialog" onClick={onClose}>×</button>
      </div>
      <p className="stock-help">{info.help}</p>
      <form className="stock-form" onSubmit={submit}>
        <div className="stock-grid">
          <label>Amount (₹)<input data-autofocus type="number" inputMode="decimal" required min="0.01" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0" /></label>
          {fuel && <label>Litres<input type="number" inputMode="decimal" required min="0.01" step="0.01" value={form.litres} onChange={set('litres')} placeholder="0" /></label>}
          {!fuel && <label>Date<input type="date" required max={today} value={form.date} onChange={set('date')} /></label>}
        </div>
        {pricePerLitre > 0 && <small className="stock-field-help">{formatPaise(pricePerLitre)} per litre</small>}
        <div className="stock-grid">
          <label>Odometer (km)<input type="number" inputMode="numeric" min="0" step="1" required={fuel} value={form.odometerKm} onChange={set('odometerKm')} placeholder={lastOdometerKm ? `Last: ${lastOdometerKm}` : fuel ? 'Reading now' : 'Optional'} /></label>
          {fuel && <label>Date<input type="date" required max={today} value={form.date} onChange={set('date')} /></label>}
        </div>
        {sinceLast > 0 && <small className="stock-field-help">{formatKm(sinceLast)} since the last reading.</small>}
        <label>{info.suggestions ? 'What for' : 'Note'}<input maxLength="500" value={form.notes} onChange={set('notes')} placeholder={type === 'service' ? 'e.g. Oil change, new tyre' : type === 'daily' ? 'e.g. Driver bata, toll' : type === 'expense' ? 'e.g. Fine, permit renewal' : 'Optional, e.g. fuel station'} /></label>
        {info.suggestions && (
          <div className="vehicle-note-chips" aria-label="Quick choices">
            {info.suggestions.map((text) => <button key={text} type="button" className={`ui-chip${form.notes === text ? ' is-active' : ''}`} aria-pressed={form.notes === text} onClick={() => setForm((current) => ({ ...current, notes: current.notes === text ? '' : text }))}>{text}</button>)}
          </div>
        )}
        {error && <p className="payment-form-error" role="alert">{error}</p>}
        <div className="payment-modal-actions">
          <button type="button" className="back-button" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="continue-btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

import { useState } from 'react'
import Modal from './Modal.jsx'
import { apiRequest } from '../services/api.js'
import { compressImage } from '../utils/image.js'
import { FUEL_TYPES } from '../utils/vehicles.js'
import { paiseToInput } from '../utils/staff.js'

/** Add a vehicle, or edit one (`vehicle` given). */
export default function VehicleFormModal({ vehicle, onClose, onSaved }) {
  const editing = Boolean(vehicle)
  const [form, setForm] = useState(() => ({
    name: vehicle?.name || '',
    number: vehicle?.number || '',
    kind: vehicle?.kind || '',
    fuelType: vehicle?.fuelType || 'diesel',
    photo: vehicle?.photo || '',
    notes: vehicle?.notes || '',
    dailyCharge: paiseToInput(vehicle?.dailyChargePaise),
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function choosePhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try { const photo = await compressImage(file, { maxSize: 640 }); setForm((current) => ({ ...current, photo })) }
    catch (readError) { event.target.value = ''; setError(readError.message) }
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const saved = await apiRequest(editing ? `/vehicles/${vehicle._id}` : '/vehicles', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(form) })
      onSaved(saved, editing ? `${saved.name} updated.` : `${saved.name} added.`)
    } catch (saveError) { setError(saveError.message); setBusy(false) }
  }

  return (
    <Modal className="payment-modal stock-modal staff-modal" backdropClassName="payment-modal-backdrop" busy={busy} onClose={onClose} labelledBy="vehicle-form-title">
      <div className="payment-modal-heading">
        <div><span className="payment-eyebrow">VEHICLES</span><h2 id="vehicle-form-title">{editing ? `Edit ${vehicle.name}` : 'Add a vehicle'}</h2></div>
        <button type="button" className="payment-close" aria-label="Close dialog" onClick={onClose}>×</button>
      </div>
      <form className="stock-form" onSubmit={submit}>
        <div className="stock-photo">
          {form.photo ? <img src={form.photo} alt="Selected" /> : <span><i className="bi bi-truck" aria-hidden="true" />No photo</span>}
          <div>
            <label className="stock-photo-button"><i className="bi bi-camera" aria-hidden="true" />{form.photo ? 'Change photo' : 'Add photo'}
              <input className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={choosePhoto} />
            </label>
            {form.photo && <button type="button" className="stock-photo-button" onClick={() => setForm((current) => ({ ...current, photo: '' }))}><i className="bi bi-x-lg" aria-hidden="true" />Remove</button>}
            <small>Optional.</small>
          </div>
        </div>
        <label>Name<input data-autofocus required maxLength="80" value={form.name} onChange={set('name')} placeholder="e.g. Pickup van" /></label>
        <div className="stock-grid">
          <label>Vehicle number<input maxLength="20" value={form.number} onChange={set('number')} placeholder="TN 38 AB 1234" className="vehicle-number-input" /></label>
          <label>Type<input maxLength="60" value={form.kind} onChange={set('kind')} placeholder="e.g. Tata Ace, Bike, Lorry" /></label>
        </div>
        <fieldset className="staff-pay">
          <legend>Fuel</legend>
          <div className="stock-mode vehicle-fuel-choice" role="radiogroup" aria-label="Fuel">
            {FUEL_TYPES.map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={form.fuelType === id} className={form.fuelType === id ? 'is-active' : ''} onClick={() => setForm((current) => ({ ...current, fuelType: id }))}>{label}</button>
            ))}
          </div>
        </fieldset>
        <label>Daily use charge (₹ per day)<input type="number" inputMode="decimal" min="0" step="0.01" value={form.dailyCharge} onChange={set('dailyCharge')} placeholder="e.g. 300" /><small className="stock-field-help">Driver bata, toll and similar costs paid each day the vehicle runs. Add it with one tap from the vehicle list.</small></label>
        <label>Notes<input maxLength="1000" value={form.notes} onChange={set('notes')} placeholder="Optional" /></label>
        {error && <p className="payment-form-error" role="alert">{error}</p>}
        <div className="payment-modal-actions">
          <button type="button" className="back-button" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="continue-btn" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add vehicle'}</button>
        </div>
      </form>
    </Modal>
  )
}

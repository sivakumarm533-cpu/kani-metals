import { useState } from 'react'
import Modal from './Modal.jsx'
import { apiRequest } from '../services/api.js'
import { compressImage } from '../utils/image.js'
import { localDateInputValue } from '../utils/format.js'
import { paiseToInput, WEEKDAYS } from '../utils/staff.js'

/** Add a new employee, or edit one (`employee` given). Pay changes start from a chosen date. */
export default function EmployeeFormModal({ employee, onClose, onSaved }) {
  const editing = Boolean(employee)
  const pay = employee?.currentPay
  const today = localDateInputValue()
  const [form, setForm] = useState(() => ({
    name: employee?.name || '',
    phone: employee?.phone || '',
    designation: employee?.designation || '',
    photo: employee?.photo || '',
    joinDate: employee?.joinDate || today,
    weeklyOff: String(employee?.weeklyOff ?? 0),
    payType: pay?.payType || 'daily',
    rate: paiseToInput(pay?.ratePaise),
    overtimeRate: paiseToInput(pay?.overtimeRatePaise),
    payFrom: today,
    notes: employee?.notes || '',
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const payChanged = editing && (form.payType !== pay?.payType || form.rate !== paiseToInput(pay?.ratePaise) || form.overtimeRate !== paiseToInput(pay?.overtimeRatePaise))

  async function choosePhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try { const photo = await compressImage(file, { maxSize: 480 }); setForm((current) => ({ ...current, photo })) }
    catch (readError) { event.target.value = ''; setError(readError.message) }
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { payFrom, ...fields } = form
    const body = { ...fields, weeklyOff: Number(form.weeklyOff), overtimeRate: form.overtimeRate || 0 }
    if (editing && !payChanged) { delete body.payType; delete body.rate; delete body.overtimeRate }
    if (payChanged) body.payFrom = payFrom
    try {
      const saved = await apiRequest(editing ? `/employees/${employee._id}` : '/employees', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) })
      onSaved(saved, editing ? `${saved.name} updated.` : `${saved.name} added.`)
    } catch (saveError) { setError(saveError.message); setBusy(false) }
  }

  return (
    <Modal className="payment-modal stock-modal staff-modal" backdropClassName="payment-modal-backdrop" busy={busy} onClose={onClose} labelledBy="staff-form-title">
      <div className="payment-modal-heading">
        <div><span className="payment-eyebrow">STAFF</span><h2 id="staff-form-title">{editing ? `Edit ${employee.name}` : 'Add an employee'}</h2></div>
        <button type="button" className="payment-close" aria-label="Close dialog" onClick={onClose}>×</button>
      </div>
      <form className="stock-form" onSubmit={submit}>
        <div className="stock-photo">
          {form.photo ? <img src={form.photo} alt="Selected" /> : <span><i className="bi bi-person" aria-hidden="true" />No photo</span>}
          <div>
            <label className="stock-photo-button"><i className="bi bi-camera" aria-hidden="true" />{form.photo ? 'Change photo' : 'Add photo'}
              <input className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={choosePhoto} />
            </label>
            {form.photo && <button type="button" className="stock-photo-button" onClick={() => setForm((current) => ({ ...current, photo: '' }))}><i className="bi bi-x-lg" aria-hidden="true" />Remove</button>}
            <small>Optional.</small>
          </div>
        </div>
        <label>Name<input data-autofocus required maxLength="120" value={form.name} onChange={set('name')} placeholder="Employee name" /></label>
        <div className="stock-grid">
          <label>Phone<input type="tel" inputMode="tel" maxLength="30" value={form.phone} onChange={set('phone')} placeholder="Optional" /></label>
          <label>Job / work<input maxLength="80" value={form.designation} onChange={set('designation')} placeholder="e.g. Loader, Driver" /></label>
        </div>
        <div className="stock-grid">
          <label>Joining date<input type="date" required max={today} value={form.joinDate} onChange={set('joinDate')} /></label>
          <label>Weekly day off<select value={form.weeklyOff} onChange={set('weeklyOff')}>
            <option value="-1">No fixed day off</option>
            {WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
          </select></label>
        </div>

        <fieldset className="staff-pay">
          <legend>Pay</legend>
          <div className="stock-mode" role="radiogroup" aria-label="Pay type">
            {[['daily', 'Daily wage', 'bi-calendar-day'], ['monthly', 'Monthly salary', 'bi-calendar-month']].map(([id, label, icon]) => (
              <button key={id} type="button" role="radio" aria-checked={form.payType === id} className={form.payType === id ? 'is-active' : ''} onClick={() => setForm((current) => ({ ...current, payType: id }))}>
                <i className={`bi ${icon}`} aria-hidden="true" />{label}
              </button>
            ))}
          </div>
          <div className="stock-grid">
            <label>{form.payType === 'monthly' ? 'Salary per month (₹)' : 'Wage per day (₹)'}<input type="number" inputMode="decimal" required min="0" step="0.01" value={form.rate} onChange={set('rate')} placeholder="0" /></label>
            <label>Overtime per hour (₹)<input type="number" inputMode="decimal" min="0" step="0.01" value={form.overtimeRate} onChange={set('overtimeRate')} placeholder="0" /></label>
          </div>
          <small className="stock-field-help">
            {form.payType === 'monthly'
              ? 'Salary ÷ days in the month is taken off for each absent day (half for a half day). Leave, holidays and the weekly off are paid.'
              : 'Paid for present days (half for a half day). Absent, leave and holidays are not paid.'}
          </small>
          {payChanged && <label className="staff-pay-from">New pay starts from<input type="date" required min={form.joinDate} value={form.payFrom} onChange={set('payFrom')} /><small className="stock-field-help">Days before this keep the old pay.</small></label>}
        </fieldset>

        <label>Notes<input maxLength="1000" value={form.notes} onChange={set('notes')} placeholder="Optional" /></label>
        {error && <p className="payment-form-error" role="alert">{error}</p>}
        <div className="payment-modal-actions">
          <button type="button" className="back-button" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="continue-btn" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add employee'}</button>
        </div>
      </form>
    </Modal>
  )
}

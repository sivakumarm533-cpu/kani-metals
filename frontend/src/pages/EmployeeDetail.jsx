import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import LoadError from '../components/LoadError.jsx'
import Modal from '../components/Modal.jsx'
import Toast from '../components/Toast.jsx'
import EmployeeFormModal from '../components/EmployeeFormModal.jsx'
import Avatar from '../components/StaffAvatar.jsx'
import { useToast } from '../hooks/useToast.js'
import { useApiData } from '../hooks/useApiData.js'
import { ConfirmDialog, SkeletonLoader, StatCard, StatusBadge } from '../components/ui.jsx'
import { localDateInputValue } from '../utils/format.js'
import { daysWorked, ENTRY_TYPES, entryInfo, formatPaise, methodLabel, monthLabel, PAYMENT_METHODS, payLabel, shiftMonth, shortDate, STATUSES, statusInfo, WEEKDAYS } from '../utils/staff.js'
import { readChoice, saveChoice } from '../utils/remember.js'
import './Employees.css'

/** Mark or change one day from the calendar. */
function DayModal({ employee, date, record, onClose, onSaved }) {
  const [status, setStatus] = useState(record?.status || null)
  const [overtimeHours, setOvertimeHours] = useState(record?.overtimeHours || '')
  const [note, setNote] = useState(record?.note || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(nextStatus = status) {
    setBusy(true)
    setError('')
    try {
      const worked = nextStatus === 'present' || nextStatus === 'half_day'
      await apiRequest('/employees/attendance', { method: 'PUT', body: JSON.stringify({ date, entries: [{ employee: employee._id, status: nextStatus, overtimeHours: worked ? Number(overtimeHours) || 0 : 0, note }] }) })
      onSaved(nextStatus ? `${shortDate(date)} marked ${statusInfo(nextStatus).label.toLowerCase()}.` : `${shortDate(date)} cleared.`)
    } catch (saveError) { setError(saveError.message); setBusy(false) }
  }

  return (
    <Modal className="payment-modal stock-modal staff-modal" backdropClassName="payment-modal-backdrop" busy={busy} onClose={onClose} labelledBy="staff-day-title">
      <div className="payment-modal-heading">
        <div><span className="payment-eyebrow">{employee.name.toUpperCase()}</span><h2 id="staff-day-title">{new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</h2></div>
        <button type="button" className="payment-close" aria-label="Close dialog" onClick={onClose}>×</button>
      </div>
      <form className="stock-form" onSubmit={(event) => { event.preventDefault(); save() }}>
        <div className="staff-day-choices" role="radiogroup" aria-label="Attendance">
          {STATUSES.map((choice) => (
            <button key={choice.id} type="button" role="radio" aria-checked={status === choice.id} className={`staff-day-choice is-${choice.tone}${status === choice.id ? ' is-active' : ''}`} onClick={() => setStatus(choice.id)} data-autofocus={status === choice.id || (!status && choice.id === 'present') ? true : undefined}>
              <i className={`bi ${choice.icon}`} aria-hidden="true" />{choice.label}
            </button>
          ))}
        </div>
        {(status === 'present' || status === 'half_day') && <label>Overtime hours<input type="number" inputMode="decimal" min="0" max="24" step="0.5" value={overtimeHours} onChange={(event) => setOvertimeHours(event.target.value)} placeholder="0" /></label>}
        <label>Note<input maxLength="200" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" /></label>
        {error && <p className="payment-form-error" role="alert">{error}</p>}
        <div className="payment-modal-actions">
          {record ? <button type="button" className="back-button" disabled={busy} onClick={() => save(null)}>Clear mark</button> : <button type="button" className="back-button" disabled={busy} onClick={onClose}>Cancel</button>}
          <button className="continue-btn" disabled={busy || !status}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

/** Payment, advance, bonus or deduction. */
function EntryModal({ employee, type, balanceDuePaise, onClose, onSaved }) {
  const info = entryInfo(type)
  const paidOut = type === 'payment' || type === 'advance'
  const [form, setForm] = useState({ amount: type === 'payment' && balanceDuePaise > 0 ? String(balanceDuePaise / 100) : '', date: localDateInputValue(), paymentMethod: readChoice('wagePaymentMethod', 'cash', PAYMENT_METHODS.map(([id]) => id)), notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/employees/${employee._id}/entries`, { method: 'POST', body: JSON.stringify({ ...form, type, paymentMethod: paidOut ? form.paymentMethod : undefined }) })
      onSaved(`${info.label} of ${formatPaise(Math.round(Number(form.amount) * 100))} saved.`)
    } catch (saveError) { setError(saveError.message); setBusy(false) }
  }

  return (
    <Modal className="payment-modal stock-modal staff-modal" backdropClassName="payment-modal-backdrop" busy={busy} onClose={onClose} labelledBy="staff-entry-title">
      <div className="payment-modal-heading">
        <div><span className="payment-eyebrow">{employee.name.toUpperCase()}</span><h2 id="staff-entry-title">{info.verb}</h2></div>
        <button type="button" className="payment-close" aria-label="Close dialog" onClick={onClose}>×</button>
      </div>
      <p className="stock-help">{info.help} Balance to pay now: <b>{formatPaise(balanceDuePaise)}</b>.</p>
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

/** Month grid, Sunday first. Days outside the working period cannot be tapped. */
function MonthCalendar({ month, today, employee, records, onPick }) {
  const [year, monthNumber] = month.split('-').map(Number)
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay()
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const byDate = new Map(records.map((record) => [record.date, record]))
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)]

  return (
    <div className="staff-calendar">
      {WEEKDAYS.map((day) => <span key={day} className="staff-cal-head" aria-hidden="true">{day.slice(0, 3)}</span>)}
      {cells.map((date, index) => {
        if (!date) return <span key={`blank-${index}`} />
        const record = byDate.get(date)
        const status = record && statusInfo(record.status)
        const outside = date > today || date < employee.joinDate || (employee.leftDate && date > employee.leftDate)
        const weeklyOff = employee.weeklyOff === new Date(`${date}T00:00:00Z`).getUTCDay()
        const label = `${shortDate(date)}: ${status ? status.label : outside ? 'not working' : 'not marked'}${record?.overtimeHours ? `, ${record.overtimeHours} h overtime` : ''}`
        return (
          <button
            key={date}
            type="button"
            disabled={outside}
            aria-label={label}
            title={record?.note || label}
            className={`staff-cal-day${status ? ` is-${status.tone} is-marked` : ''}${date === today ? ' is-today' : ''}${weeklyOff && !status ? ' is-off' : ''}`}
            onClick={() => onPick(date, record)}
          >
            <span className="staff-cal-num">{Number(date.slice(8))}</span>
            <span className="staff-cal-mark" aria-hidden="true">{status ? status.short : weeklyOff && !outside ? 'off' : ''}</span>
            {record?.overtimeHours > 0 && <span className="staff-cal-ot" aria-hidden="true">+{record.overtimeHours}h</span>}
          </button>
        )
      })}
    </div>
  )
}

export default function EmployeeDetail() {
  const { employeeId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [modal, setModal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [leftDate, setLeftDate] = useState(localDateInputValue())
  const [allEntries, setAllEntries] = useState(false)
  const [toast, notify] = useToast()
  const month = searchParams.get('month') || ''

  const { data: loaded, loading, error, reload: load } = useApiData(`/employees/${employeeId}${month ? `?month=${month}` : ''}`)
  // Another employee's figures must not show while this one loads.
  const data = loaded && String(loaded.employee._id) === employeeId ? loaded : null

  const done = (message) => { setModal(null); setBusy(false); if (message) notify(message); load() }

  async function setActive(active) {
    setBusy(true)
    try {
      await apiRequest(`/employees/${employeeId}`, { method: 'PUT', body: JSON.stringify(active ? { active: true } : { active: false, leftDate }) })
      done(active ? `${data.employee.name} is working again.` : `${data.employee.name} marked as left.`)
    } catch (saveError) { setBusy(false); notify(saveError.message, 'danger') }
  }

  async function remove() {
    setBusy(true)
    try {
      const result = await apiRequest(`/employees/${employeeId}`, { method: 'DELETE' })
      navigate('/employees?tab=wages', { replace: true, state: { message: result.message } })
    } catch (removeError) { setBusy(false); notify(removeError.message, 'danger') }
  }

  async function removeEntry(entry) {
    setBusy(true)
    try { const result = await apiRequest(`/employees/entries/${entry._id}`, { method: 'DELETE' }); done(result.message) }
    catch (removeError) { setBusy(false); notify(removeError.message, 'danger') }
  }

  if (!data) {
    return (
      <section className="page-container staff-page">
        <LoadError message={error} onRetry={load} />
        {loading && <SkeletonLoader rows={4} />}
        {error && <Link className="back-button" to="/employees?tab=wages">Back to staff</Link>}
      </section>
    )
  }

  const { employee, monthSummary: summary, monthEntries, entryTotals, earnedTotalPaise, balanceDuePaise, today } = data
  const shownMonth = data.month
  const currentMonth = today.slice(0, 7)
  const entries = allEntries ? data.entries : data.entries.filter((entry) => entry.date.startsWith(shownMonth))
  const goMonth = (value) => setSearchParams({ month: value }, { replace: true })

  return (
    <section className="page-container staff-page staff-detail">
      <Toast toast={toast} />
      <header className="staff-profile">
        <Avatar employee={employee} size={64} />
        <div className="staff-profile-text">
          <h1 className="page-title">{employee.name}</h1>
          <p>
            {[employee.designation, payLabel(employee.currentPay), employee.phone].filter(Boolean).join(' · ')}
          </p>
          <div className="staff-profile-badges">
            {employee.active ? <StatusBadge tone="success" icon="bi-briefcase">Working since {shortDate(employee.joinDate)}</StatusBadge> : <StatusBadge tone="neutral" icon="bi-box-arrow-right">Left on {shortDate(employee.leftDate)}</StatusBadge>}
            {employee.weeklyOff >= 0 && <StatusBadge tone="neutral" icon="bi-calendar-x">{WEEKDAYS[employee.weeklyOff]} off</StatusBadge>}
            {employee.currentPay?.overtimeRatePaise > 0 && <StatusBadge tone="info" icon="bi-clock">OT {formatPaise(employee.currentPay.overtimeRatePaise)}/hr</StatusBadge>}
          </div>
        </div>
        <div className="staff-profile-actions">
          <button type="button" className="back-button" onClick={() => setModal({ type: 'edit' })}><i className="bi bi-pencil" aria-hidden="true" />Edit</button>
          {employee.active
            ? <button type="button" className="back-button" onClick={() => setModal({ type: 'leave' })}><i className="bi bi-box-arrow-right" aria-hidden="true" />Mark as left</button>
            : <button type="button" className="back-button" disabled={busy} onClick={() => setActive(true)}><i className="bi bi-arrow-counterclockwise" aria-hidden="true" />Working again</button>}
          <button type="button" className="back-button staff-danger" onClick={() => setModal({ type: 'delete' })}><i className="bi bi-trash" aria-hidden="true" /><span className="visually-hidden">Delete employee</span></button>
        </div>
      </header>

      <div className="staff-stats">
        <StatCard icon="bi-hourglass-split" tone={balanceDuePaise > 0 ? 'warning' : 'success'} label={balanceDuePaise < 0 ? 'Paid ahead' : 'Balance to pay'} value={formatPaise(Math.abs(balanceDuePaise))} note="All months, as of today" />
        <StatCard icon="bi-graph-up-arrow" label={`Earned in ${monthLabel(shownMonth).split(' ')[0].slice(0, 3)}`} value={formatPaise(summary.earnedPaise)} note={`${daysWorked(summary)} days worked${summary.overtimeHours ? ` · ${summary.overtimeHours} h OT` : ''}`} />
        <StatCard icon="bi-cash-coin" tone="success" label="Paid this month" value={formatPaise(monthEntries.payment + monthEntries.advance)} note={monthEntries.advance ? `incl. ${formatPaise(monthEntries.advance)} advance` : 'Wages and advances'} />
      </div>

      <div className="staff-quick-actions">
        {ENTRY_TYPES.map((type) => <button key={type.id} type="button" className={type.id === 'payment' ? 'continue-btn' : 'back-button'} onClick={() => setModal({ type: 'entry', entryType: type.id })}><i className={`bi ${type.icon}`} aria-hidden="true" />{type.verb}</button>)}
      </div>

      <div className="staff-columns">
        <section className="staff-panel" aria-labelledby="staff-cal-title">
          <div className="staff-panel-head">
            <h2 id="staff-cal-title">Attendance</h2>
            <div className="staff-daybar is-compact">
              <button type="button" className="inventory-icon-btn" aria-label="Previous month" onClick={() => goMonth(shiftMonth(shownMonth, -1))}><i className="bi bi-chevron-left" aria-hidden="true" /></button>
              <span className="staff-month-label">{monthLabel(shownMonth)}</span>
              <button type="button" className="inventory-icon-btn" aria-label="Next month" disabled={shiftMonth(shownMonth, 1) > currentMonth} onClick={() => goMonth(shiftMonth(shownMonth, 1))}><i className="bi bi-chevron-right" aria-hidden="true" /></button>
            </div>
          </div>
          {loading && <span className="visually-hidden" role="status">Loading</span>}
          <MonthCalendar month={shownMonth} today={today} employee={employee} records={data.attendance} onPick={(date, record) => setModal({ type: 'day', date, record })} />
          <p className="stock-help">Tap a day to mark or change it.</p>
          <dl className="staff-breakdown">
            {STATUSES.map((status) => <div key={status.id}><dt>{status.label}</dt><dd>{summary[status.id === 'half_day' ? 'halfDay' : status.id]}</dd></div>)}
            <div><dt>Not marked</dt><dd>{summary.unmarked}</dd></div>
          </dl>
        </section>

        <section className="staff-panel" aria-labelledby="staff-pay-title">
          <div className="staff-panel-head"><h2 id="staff-pay-title">Wages for {monthLabel(shownMonth)}</h2></div>
          <dl className="staff-ledger">
            <div><dt>{employee.currentPay?.payType === 'monthly' ? 'Salary for days counted' : `Wages for ${daysWorked(summary)} days`}</dt><dd>{formatPaise(summary.basePaise)}</dd></div>
            <div><dt>Overtime ({summary.overtimeHours} h)</dt><dd>{formatPaise(summary.overtimePaise)}</dd></div>
            {monthEntries.bonus > 0 && <div><dt>Bonus</dt><dd>+ {formatPaise(monthEntries.bonus)}</dd></div>}
            {monthEntries.deduction > 0 && <div><dt>Deductions</dt><dd>− {formatPaise(monthEntries.deduction)}</dd></div>}
            <div className="is-total"><dt>Earned this month</dt><dd>{formatPaise(summary.earnedPaise + monthEntries.bonus - monthEntries.deduction)}</dd></div>
          </dl>

          <h3 className="staff-subhead">Account since joining</h3>
          <dl className="staff-ledger">
            <div><dt>Total earned</dt><dd>{formatPaise(earnedTotalPaise)}</dd></div>
            {entryTotals.bonus > 0 && <div><dt>Bonuses</dt><dd>+ {formatPaise(entryTotals.bonus)}</dd></div>}
            {entryTotals.deduction > 0 && <div><dt>Deductions</dt><dd>− {formatPaise(entryTotals.deduction)}</dd></div>}
            <div><dt>Wages paid</dt><dd>− {formatPaise(entryTotals.payment)}</dd></div>
            {entryTotals.advance > 0 && <div><dt>Advances</dt><dd>− {formatPaise(entryTotals.advance)}</dd></div>}
            <div className="is-total"><dt>{balanceDuePaise < 0 ? 'Paid ahead' : 'Balance to pay'}</dt><dd className={balanceDuePaise > 0 ? 'is-due' : ''}>{formatPaise(Math.abs(balanceDuePaise))}</dd></div>
          </dl>

          <div className="staff-panel-head staff-entries-head">
            <h3 className="staff-subhead">Payments & adjustments</h3>
            <button type="button" className="ui-chip" aria-pressed={allEntries} onClick={() => setAllEntries((value) => !value)}>{allEntries ? 'This month only' : 'All months'}</button>
          </div>
          {entries.length === 0 && <p className="stock-help">{allEntries ? 'Nothing recorded yet.' : 'Nothing recorded this month.'}</p>}
          <ul className="staff-entries">
            {entries.map((entry) => {
              const info = entryInfo(entry.type)
              return (
                <li key={entry._id}>
                  <span className={`staff-entry-icon is-${entry.type}`} aria-hidden="true"><i className={`bi ${info.icon}`} /></span>
                  <span className="staff-entry-text"><strong>{info.label}</strong><small>{[shortDate(entry.date), methodLabel(entry.paymentMethod), entry.notes].filter(Boolean).join(' · ')}</small></span>
                  <b className="staff-entry-amount">{info.sign > 0 ? '+' : '−'} {formatPaise(entry.amountPaise)}</b>
                  <button type="button" className="inventory-icon-btn" aria-label={`Remove ${info.label.toLowerCase()} of ${formatPaise(entry.amountPaise)}`} onClick={() => setModal({ type: 'removeEntry', entry })}><i className="bi bi-x-lg" aria-hidden="true" /></button>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      {modal?.type === 'edit' && <EmployeeFormModal employee={employee} onClose={() => setModal(null)} onSaved={(_saved, message) => done(message)} />}
      {modal?.type === 'day' && <DayModal employee={employee} date={modal.date} record={modal.record} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.type === 'entry' && <EntryModal employee={employee} type={modal.entryType} balanceDuePaise={balanceDuePaise} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.type === 'leave' && (
        <ConfirmDialog title={`Mark ${employee.name} as left?`} message="Wages stop after the last working day. Their history and balance stay; you can still record a final payment." confirmLabel="Mark as left" busy={busy} onConfirm={() => setActive(false)} onCancel={() => setModal(null)}>
          <label className="staff-confirm-field">Last working day<input type="date" value={leftDate} min={employee.joinDate} max={today} onChange={(event) => setLeftDate(event.target.value)} /></label>
        </ConfirmDialog>
      )}
      {modal?.type === 'delete' && <ConfirmDialog tone="danger" title={`Delete ${employee.name}?`} message="This permanently removes the employee with all their attendance and wage records. To keep the history, use “Mark as left” instead." confirmLabel="Delete for good" busy={busy} onConfirm={remove} onCancel={() => setModal(null)} />}
      {modal?.type === 'removeEntry' && <ConfirmDialog tone="danger" title="Remove this entry?" message={`${entryInfo(modal.entry.type).label} of ${formatPaise(modal.entry.amountPaise)} on ${shortDate(modal.entry.date)} will be removed and the balance recalculated.`} confirmLabel="Remove" busy={busy} onConfirm={() => removeEntry(modal.entry)} onCancel={() => setModal(null)} />}
    </section>
  )
}

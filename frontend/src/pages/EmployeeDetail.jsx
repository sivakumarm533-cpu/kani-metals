import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import LoadError from '../components/LoadError.jsx'
import Modal from '../components/Modal.jsx'
import Toast from '../components/Toast.jsx'
import EmployeeFormModal from '../components/EmployeeFormModal.jsx'
import StaffReportModal from '../components/StaffReportModal.jsx'
import EntryModal from '../components/StaffEntryModal.jsx'
import Avatar from '../components/StaffAvatar.jsx'
import { useToast } from '../hooks/useToast.js'
import { useApiData } from '../hooks/useApiData.js'
import { ConfirmDialog, SkeletonLoader, StatCard, StatusBadge } from '../components/ui.jsx'
import { localDateInputValue } from '../utils/format.js'
import { daysWorked, ENTRY_TYPES, entryInfo, formatPaise, methodLabel, monthLabel, payLabel, shiftMonth, shortDate, STATUSES, statusInfo, WEEKDAYS } from '../utils/staff.js'
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

/** Month grid, Sunday first. Days outside the working period cannot be tapped. */
function MonthCalendar({ month, today, employee, records, paidByDate = new Map(), onPick }) {
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
        const paid = paidByDate.get(date) || 0
        const label = `${shortDate(date)}: ${status ? status.label : outside ? 'not working' : 'not marked'}${record?.overtimeHours ? `, ${record.overtimeHours} h overtime` : ''}${paid ? `, paid ${formatPaise(paid)}` : ''}`
        return (
          <button
            key={date}
            type="button"
            disabled={outside}
            aria-label={label}
            title={record?.note || label}
            className={`staff-cal-day${status ? ` is-${status.tone} is-marked` : ''}${date === today ? ' is-today' : ''}${weeklyOff && !status ? ' is-off' : ''}${paid ? ' is-paid' : ''}`}
            onClick={() => onPick(date, record)}
          >
            {paid > 0 && <span className="staff-cal-paid" aria-hidden="true"><i className="bi bi-check-lg" /></span>}
            <span className="staff-cal-num">{Number(date.slice(8))}</span>
            <span className="staff-cal-mark" aria-hidden="true">{status ? status.short : weeklyOff && !outside ? 'off' : ''}</span>
            {record?.overtimeHours > 0 && <span className="staff-cal-ot" aria-hidden="true">+{record.overtimeHours}h</span>}
          </button>
        )
      })}
    </div>
  )
}

/** All-time attendance since joining: days worked, a stacked bar of every status, and the counts. */
function TotalDays({ employee, total }) {
  const worked = daysWorked(total)
  const marked = total.present + total.halfDay + total.absent
  const rate = marked ? Math.round((worked / marked) * 100) : null
  const parts = [
    ...STATUSES.map((status) => ({ id: status.id, label: status.label, tone: status.tone, icon: status.icon, count: total[status.id === 'half_day' ? 'halfDay' : status.id] })),
    { id: 'unmarked', label: 'Not marked', tone: 'empty', icon: 'bi-dash-circle', count: total.unmarked },
  ]
  return (
    <section className="staff-panel staff-total" aria-labelledby="staff-total-title">
      <div className="staff-panel-head">
        <h2 id="staff-total-title">Total days working</h2>
        <span className="staff-total-since">Since {shortDate(employee.joinDate)}{employee.leftDate ? ` to ${shortDate(employee.leftDate)}` : ''}</span>
      </div>
      <div className="staff-total-hero">
        <div className="staff-total-main">
          <strong>{worked}</strong>
          <span>days worked<small>of {total.calendarDays} days · {total.months} {total.months === 1 ? 'month' : 'months'}</small></span>
        </div>
        {rate !== null && <div className="staff-total-rate"><b>{rate}%</b><small>attendance</small></div>}
      </div>
      {total.calendarDays > 0 && (
        <div className="staff-total-bar" aria-hidden="true">
          {parts.filter((part) => part.count > 0).map((part) => <span key={part.id} className={`is-${part.tone}`} style={{ flexGrow: part.count }} title={`${part.label}: ${part.count}`} />)}
        </div>
      )}
      <ul className="staff-total-grid">
        {parts.map((part) => (
          <li key={part.id} className={`is-${part.tone}`}>
            <i className={`bi ${part.icon}`} aria-hidden="true" />
            <span><small>{part.label}</small><b>{part.count}</b></span>
          </li>
        ))}
        <li className="is-ot">
          <i className="bi bi-clock-history" aria-hidden="true" />
          <span><small>Overtime</small><b>{total.overtimeHours} h</b></span>
        </li>
      </ul>
    </section>
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
  // Days with money paid out (wages or advance), for the calendar ticks.
  const paidByDate = data.entries.filter((entry) => entry.type === 'payment' || entry.type === 'advance').reduce((map, entry) => map.set(entry.date, (map.get(entry.date) || 0) + entry.amountPaise), new Map())
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
          <button type="button" className="continue-btn whatsapp-btn staff-report-btn" onClick={() => setModal({ type: 'report' })}><i className="bi bi-whatsapp" aria-hidden="true" />Send report</button>
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

      {data.totalSummary && <TotalDays employee={employee} total={data.totalSummary} />}

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
          <MonthCalendar month={shownMonth} today={today} employee={employee} records={data.attendance} paidByDate={paidByDate} onPick={(date, record) => setModal({ type: 'day', date, record })} />
          <p className="stock-help staff-cal-help">Tap a day to mark or change it.<span><span className="staff-cal-paid is-legend" aria-hidden="true"><i className="bi bi-check-lg" /></span> Wages paid that day</span></p>
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

      {modal?.type === 'report' && <StaffReportModal data={data} onClose={() => setModal(null)} />}
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

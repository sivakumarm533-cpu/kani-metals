import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import LoadError from './LoadError.jsx'
import Avatar from './StaffAvatar.jsx'
import { EmptyState, SkeletonLoader, StatusBadge } from './ui.jsx'
import { dayLabel, formatPaise, PAYMENT_METHODS, shiftDate, STATUSES, WEEKDAYS, weekdayOf } from '../utils/staff.js'
import { useApiData } from '../hooks/useApiData.js'
import { readChoice } from '../utils/remember.js'
import '../pages/Employees.css'

/** Name block of a row: a link to the employee page for managers, plain text for team members. */
function WhoTag({ employee, canOpen, className, children }) {
  return canOpen ? <Link to={`/employees/${employee._id}`} className={className}>{children}</Link> : <div className={className}>{children}</div>
}

/* Daily attendance sheet, shared by Staff & wages (managers) and Employee attendance (team members). */

const NO_DRAFT = {}

export default function AttendanceSheet({ notify, onAddEmployee, reloadKey }) {
  const [requested, setRequested] = useState('')
  const { data, loading: fetching, error, reload } = useApiData(`/employees/attendance${requested ? `?date=${requested}` : ''}`, reloadKey)
  // Unsaved marks belong to the data they were made on; fresh data (another day, or after saving) starts clean.
  const [draftState, setDraftState] = useState({ base: null, values: {} })
  const draft = draftState.base === data ? draftState.values : NO_DRAFT
  const setDraft = (update) => setDraftState((current) => ({ base: data, values: update(current.base === data ? current.values : {}) }))
  const [saving, setSaving] = useState(false)
  // Payments made from this sheet, added on top of what the server sent (keyed by day and employee).
  const [paidHere, setPaidHere] = useState({})
  const [paying, setPaying] = useState('')
  const date = data?.date || ''
  const loading = fetching && (!data || (requested && data.date !== requested))

  const dirty = Object.keys(draft).length > 0
  function goTo(day) {
    if (dirty && !window.confirm('You have unsaved attendance. Leave this day without saving?')) return
    setRequested(day)
  }

  const rows = useMemo(() => (data?.employees || []).map((employee) => {
    const saved = employee.record ? { status: employee.record.status, overtimeHours: employee.record.overtimeHours || 0 } : { status: null, overtimeHours: 0 }
    const current = draft[employee._id] || saved
    return { employee, saved, current, changed: Boolean(draft[employee._id]) }
  }), [data, draft])

  function change(employee, saved, patch) {
    setDraft((currentDraft) => {
      const next = { ...(currentDraft[employee._id] || saved), ...patch }
      const copy = { ...currentDraft }
      if (next.status === saved.status && Number(next.overtimeHours || 0) === Number(saved.overtimeHours || 0)) delete copy[employee._id]
      else copy[employee._id] = next
      return copy
    })
  }

  function markAllPresent() {
    const day = weekdayOf(date)
    setDraft((currentDraft) => {
      const copy = { ...currentDraft }
      for (const { employee, saved, current } of rows) {
        if (current.status) continue
        const status = employee.weeklyOff === day ? 'holiday' : 'present'
        if (status !== saved.status) copy[employee._id] = { ...current, status }
      }
      return copy
    })
  }

  async function save() {
    setSaving(true)
    try {
      const entries = Object.entries(draft).map(([employee, value]) => ({ employee, status: value.status, overtimeHours: value.overtimeHours || 0 }))
      const result = await apiRequest('/employees/attendance', { method: 'PUT', body: JSON.stringify({ date, entries }) })
      notify(result.message, 'success', 'bi-calendar-check')
      reload()
    } catch (saveError) { notify(saveError.message, 'danger') }
    finally { setSaving(false) }
  }

  /** The assigned amount for the day: daily wage (half for a half day) plus overtime. 0 when there is nothing set to pay. */
  function dueFor(employee, current) {
    const factor = current.status === 'present' ? 1 : current.status === 'half_day' ? 0.5 : 0
    if (!factor || !employee.dailyRatePaise) return 0
    return Math.round(employee.dailyRatePaise * factor + (Number(current.overtimeHours) || 0) * (employee.overtimeRatePaise || 0))
  }

  /** Records the payment straight away, with the payment method used last time. */
  async function payNow(employee, amountPaise) {
    setPaying(employee._id)
    try {
      const paymentMethod = readChoice('wagePaymentMethod', 'cash', PAYMENT_METHODS.map(([id]) => id))
      await apiRequest(`/employees/${employee._id}/entries`, { method: 'POST', body: JSON.stringify({ type: 'payment', amount: amountPaise / 100, date, paymentMethod }) })
      const key = `${date}:${employee._id}`
      setPaidHere((current) => ({ ...current, [key]: (current[key] || 0) + amountPaise }))
      notify(`${formatPaise(amountPaise)} paid to ${employee.name}.`, 'success', 'bi-cash-coin')
    } catch (payError) { notify(payError.message, 'danger') }
    finally { setPaying('') }
  }

  const counts = rows.reduce((map, row) => ({ ...map, [row.current.status || 'none']: (map[row.current.status || 'none'] || 0) + 1 }), {})
  const today = data?.today || ''
  // Team members can mark attendance only; paying and employee pages are for managers.
  const canPay = data?.canPay !== false
  const isFuture = (day) => today && day > today

  return (
    <div className="staff-attendance">
      <div className="staff-daybar">
        <button type="button" className="inventory-icon-btn" aria-label="Previous day" onClick={() => goTo(shiftDate(date, -1))} disabled={!date || loading}><i className="bi bi-chevron-left" aria-hidden="true" /></button>
        <label className="staff-daypick">
          <i className="bi bi-calendar3 staff-phone-only" aria-hidden="true" />
          <span>{date ? dayLabel(date, today) : 'Loading…'}</span>
          <input type="date" value={date} max={today} onChange={(event) => event.target.value && goTo(event.target.value)} aria-label="Attendance date" />
        </label>
        <button type="button" className="inventory-icon-btn" aria-label="Next day" onClick={() => goTo(shiftDate(date, 1))} disabled={!date || loading || isFuture(shiftDate(date, 1))}><i className="bi bi-chevron-right" aria-hidden="true" /></button>
        {date && date !== today && <button type="button" className="back-button staff-today-btn" onClick={() => goTo(today)}>Today</button>}
      </div>

      <LoadError message={error} onRetry={reload} />
      {loading && <SkeletonLoader rows={4} />}

      {!loading && data && rows.length === 0 && (
        <EmptyState icon="bi-person-badge" title="No employees working on this day" text={onAddEmployee ? 'Add your employees to start marking attendance.' : 'Ask your administrator to add employees.'} action={onAddEmployee ? <button type="button" className="continue-btn" onClick={onAddEmployee}>Add employee</button> : null} />
      )}

      {!loading && rows.length > 0 && <>
        <div className="staff-sheet-head">
          <div className="staff-counts" aria-label="Day summary">
            {STATUSES.filter((status) => counts[status.id]).map((status) => <StatusBadge key={status.id} tone={status.tone} icon={status.icon}>{counts[status.id]} {status.label.toLowerCase()}</StatusBadge>)}
            {counts.none > 0 && <StatusBadge tone="neutral" icon="bi-dash-circle">{counts.none} not marked</StatusBadge>}
          </div>
          {counts.none > 0 && <button type="button" className="back-button staff-allpresent" onClick={markAllPresent}><i className="bi bi-check2-all" aria-hidden="true" />Mark the rest present</button>}
        </div>

        <ul className="staff-sheet">
          {rows.map(({ employee, saved, current, changed }) => {
            const offToday = employee.weeklyOff === weekdayOf(date)
            const worked = current.status === 'present' || current.status === 'half_day'
            const due = dueFor(employee, current)
            const paid = (employee.paidPaise || 0) + (paidHere[`${date}:${employee._id}`] || 0)
            return (
              <li key={employee._id} className={`staff-sheet-row${changed ? ' is-changed' : ''}`}>
                <WhoTag employee={employee} canOpen={canPay} className="staff-sheet-who">
                  <Avatar employee={employee} size={44} />
                  <span className="staff-sheet-name">
                    <strong>{employee.name}</strong>
                    <small>{[employee.designation, employee.payType === 'monthly' ? 'Monthly' : 'Daily wage', offToday && `${WEEKDAYS[employee.weeklyOff]} off`].filter(Boolean).join(' · ')}</small>
                  </span>
                  {canPay && <i className="bi bi-chevron-right staff-phone-only staff-sheet-go" aria-hidden="true" />}
                </WhoTag>
                <div className="staff-status-picker" role="radiogroup" aria-label={`Attendance of ${employee.name}`}>
                  {STATUSES.map((status) => (
                    <button
                      key={status.id}
                      type="button"
                      role="radio"
                      aria-checked={current.status === status.id}
                      title={status.label}
                      className={`staff-status is-${status.tone}${current.status === status.id ? ' is-active' : ''}`}
                      onClick={() => change(employee, saved, { status: current.status === status.id ? null : status.id })}
                    >
                      <span aria-hidden="true">{status.short}</span>
                      <small className="staff-status-word" aria-hidden="true">{status.id === 'half_day' ? 'Half' : status.label}</small>
                      <span className="visually-hidden">{status.label}</span>
                    </button>
                  ))}
                </div>
                {worked && (
                  <label className="staff-ot">
                    <span>OT hrs</span>
                    <input type="number" inputMode="decimal" min="0" max="24" step="0.5" value={current.overtimeHours || ''} placeholder="0" onChange={(event) => change(employee, saved, { overtimeHours: event.target.value === '' ? 0 : Number(event.target.value) })} />
                  </label>
                )}
                {canPay && <div className="staff-sheet-pay">
                  {paid > 0
                    ? <span className="staff-paid-chip"><i className="bi bi-check-circle-fill" aria-hidden="true" />Paid {formatPaise(paid)}</span>
                    : <span className="staff-unpaid">{date === today ? 'Not paid today' : 'Not paid this day'}</span>}
                  {due > 0 && !paid
                    ? <button type="button" className="staff-pay-btn" disabled={paying === employee._id} onClick={() => payNow(employee, due)}>
                        <i className="bi bi-cash-coin" aria-hidden="true" />{paying === employee._id ? 'Paying…' : `Pay ${formatPaise(due)}`}
                      </button>
                    : <Link className="staff-pay-btn" to={`/employees/${employee._id}`}>
                        <i className={`bi ${paid ? 'bi-plus-lg' : 'bi-cash-coin'}`} aria-hidden="true" />{paid ? 'Pay more' : 'Pay'}
                      </Link>}
                </div>}
              </li>
            )
          })}
        </ul>
        <p className="stock-help">Tap a selected mark again to clear it. P = present, ½ = half day, A = absent, L = leave, H = holiday.</p>
      </>}

      {dirty && (
        <div className="inventory-selection staff-savebar" role="region" aria-label="Unsaved attendance">
          <span><b>{Object.keys(draft).length}</b> changed</span>
          <button type="button" className="back-button" disabled={saving} onClick={() => setDraft(() => ({}))}>Undo</button>
          <button type="button" className="continue-btn" disabled={saving} onClick={save}><i className="bi bi-check2" aria-hidden="true" />{saving ? 'Saving…' : 'Save attendance'}</button>
        </div>
      )}
    </div>
  )
}

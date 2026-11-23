import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import LoadError from '../components/LoadError.jsx'
import Toast from '../components/Toast.jsx'
import EmployeeFormModal from '../components/EmployeeFormModal.jsx'
import Avatar from '../components/StaffAvatar.jsx'
import { useToast } from '../hooks/useToast.js'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
import { useApiData } from '../hooks/useApiData.js'
import { EmptyState, FilterChips, FloatingActionButton, PageHeader, SearchInput, SkeletonLoader, StatCard, StatusBadge } from '../components/ui.jsx'
import { dayLabel, daysWorked, formatPaise, monthLabel, PAYMENT_METHODS, payLabel, shiftDate, shiftMonth, STATUSES, WEEKDAYS, weekdayOf } from '../utils/staff.js'
import { readChoice, useRememberedState } from '../utils/remember.js'
import './Employees.css'

/*
 * Staff & wages (administrators and sub-admins only).
 * "Attendance" marks one day for everyone; "Wages" shows each person's month and what is still owed.
 */

/* ---------- Attendance sheet ---------- */

const NO_DRAFT = {}

function AttendanceSheet({ notify, onAddEmployee, reloadKey }) {
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
        <EmptyState icon="bi-person-badge" title="No employees working on this day" text="Add your employees to start marking attendance." action={<button type="button" className="continue-btn" onClick={onAddEmployee}>Add employee</button>} />
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
                <Link to={`/employees/${employee._id}`} className="staff-sheet-who">
                  <Avatar employee={employee} size={44} />
                  <span className="staff-sheet-name">
                    <strong>{employee.name}</strong>
                    <small>{[employee.designation, employee.payType === 'monthly' ? 'Monthly' : 'Daily wage', offToday && `${WEEKDAYS[employee.weeklyOff]} off`].filter(Boolean).join(' · ')}</small>
                  </span>
                  <i className="bi bi-chevron-right staff-phone-only staff-sheet-go" aria-hidden="true" />
                </Link>
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
                <div className="staff-sheet-pay">
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
                </div>
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

/* ---------- Wages (monthly payroll) ---------- */

function WagesView({ onAddEmployee, reloadKey }) {
  const navigate = useNavigate()
  const isPhone = useMediaQuery('(max-width: 720px)')
  const [requested, setRequested] = useState('')
  const { data, loading: fetching, error, reload } = useApiData(`/employees${requested ? `?month=${requested}` : ''}`, reloadKey)
  const [filter, setFilter] = useRememberedState('staffFilter', 'active', ['active', 'left', 'all'])
  const [search, setSearch] = useState('')
  const month = data?.month || ''
  const loading = fetching && (!data || (requested && data.month !== requested))
  const load = setRequested

  const employees = useMemo(() => data?.employees || [], [data])
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase()
    return employees.filter((employee) => (filter === 'all' || (filter === 'active' ? employee.active : !employee.active))
      && (!term || `${employee.name} ${employee.designation} ${employee.phone}`.toLowerCase().includes(term)))
  }, [employees, filter, search])
  const totals = shown.reduce((sum, employee) => ({
    earned: sum.earned + employee.monthSummary.earnedPaise + employee.monthEntries.bonus - employee.monthEntries.deduction,
    paid: sum.paid + employee.monthEntries.payment + employee.monthEntries.advance,
    due: sum.due + Math.max(0, employee.balanceDuePaise),
  }), { earned: 0, paid: 0, due: 0 })
  const currentMonth = data?.today?.slice(0, 7)
  const open = (employee) => navigate(`/employees/${employee._id}${month ? `?month=${month}` : ''}`)

  return (
    <div className="staff-wages">
      <div className="staff-daybar">
        <button type="button" className="inventory-icon-btn" aria-label="Previous month" onClick={() => load(shiftMonth(month, -1))} disabled={!month || loading}><i className="bi bi-chevron-left" aria-hidden="true" /></button>
        <label className="staff-daypick">
          <i className="bi bi-calendar3 staff-phone-only" aria-hidden="true" />
          <span>{month ? monthLabel(month) : 'Loading…'}</span>
          <input type="month" value={month} max={currentMonth} onChange={(event) => event.target.value && load(event.target.value)} aria-label="Month" />
        </label>
        <button type="button" className="inventory-icon-btn" aria-label="Next month" onClick={() => load(shiftMonth(month, 1))} disabled={!month || loading || shiftMonth(month, 1) > currentMonth}><i className="bi bi-chevron-right" aria-hidden="true" /></button>
      </div>

      <div className="staff-stats">
        <StatCard icon="bi-graph-up-arrow" label={`Earned in ${month ? monthLabel(month).split(' ')[0] : 'month'}`} value={formatPaise(totals.earned)} note="Wages + overtime + bonus − deductions" loading={loading && !data} />
        <StatCard icon="bi-cash-coin" tone="success" label="Paid this month" value={formatPaise(totals.paid)} note="Wages and advances" loading={loading && !data} />
        <StatCard icon="bi-hourglass-split" tone="warning" label="Balance to pay" value={formatPaise(totals.due)} note="All months, as of today" loading={loading && !data} />
      </div>

      <div className="inventory-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, work or phone" label="Search employees" />
        <FilterChips label="Show" value={filter} onChange={setFilter} options={[['active', `Working (${employees.filter((e) => e.active).length})`], ['left', `Left (${employees.filter((e) => !e.active).length})`], ['all', 'All']]} />
      </div>

      <LoadError message={error} onRetry={reload} />
      {loading && !data && <SkeletonLoader rows={4} />}
      {data && employees.length === 0 && <EmptyState icon="bi-person-badge" title="No employees yet" text="Add the people who work for you to track their attendance and wages." action={<button type="button" className="continue-btn" onClick={onAddEmployee}>Add employee</button>} />}
      {data && employees.length > 0 && shown.length === 0 && <p className="stock-help">No employees match.</p>}

      {data && shown.length > 0 && (isPhone ? (
        <ul className="staff-cards">
          {shown.map((employee) => (
            <li key={employee._id}>
              <button type="button" className="staff-card" onClick={() => open(employee)}>
                <span className="staff-card-top">
                  <Avatar employee={employee} size={44} />
                  <span className="staff-card-name"><strong>{employee.name}</strong><small>{payLabel(employee.currentPay)}{!employee.active && ' · Left'}</small></span>
                  <i className="bi bi-chevron-right" aria-hidden="true" />
                </span>
                <span className="staff-card-figures">
                  <span><small>Days</small><b>{daysWorked(employee.monthSummary)}</b></span>
                  <span><small>Earned</small><b>{formatPaise(employee.monthSummary.earnedPaise)}</b></span>
                  <span><small>Balance</small><b className={employee.balanceDuePaise > 0 ? 'is-due' : ''}>{formatPaise(employee.balanceDuePaise)}</b></span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="table-responsive inventory-table-wrap">
          <table className="table align-middle inventory-table staff-table">
            <thead>
              <tr><th scope="col">Employee</th><th scope="col">Pay</th><th scope="col">Days worked</th><th scope="col">Overtime</th><th scope="col" className="text-end">Earned</th><th scope="col" className="text-end">Paid</th><th scope="col" className="text-end">Balance to pay</th><th scope="col"><span className="visually-hidden">Open</span></th></tr>
            </thead>
            <tbody>
              {shown.map((employee) => {
                const summary = employee.monthSummary
                return (
                  <tr key={employee._id} className="staff-table-row" onClick={() => open(employee)}>
                    <td><span className="inventory-item"><Avatar employee={employee} /><span><strong>{employee.name}</strong><small>{employee.designation || (employee.active ? 'Working' : 'Left')}{employee.designation && !employee.active ? ' · Left' : ''}</small></span></span></td>
                    <td>{payLabel(employee.currentPay)}</td>
                    <td><span className="staff-daycount"><b>{daysWorked(summary)}</b><small>{summary.present} P · {summary.halfDay} ½ · {summary.absent} A{summary.leave ? ` · ${summary.leave} L` : ''}</small></span></td>
                    <td>{summary.overtimeHours ? `${summary.overtimeHours} h · ${formatPaise(summary.overtimePaise)}` : '—'}</td>
                    <td className="text-end">{formatPaise(summary.earnedPaise)}</td>
                    <td className="text-end">{formatPaise(employee.monthEntries.payment + employee.monthEntries.advance)}</td>
                    <td className="text-end"><b className={employee.balanceDuePaise > 0 ? 'is-due' : ''}>{formatPaise(employee.balanceDuePaise)}</b></td>
                    <td className="inventory-actions"><Link className="inventory-icon-btn" to={`/employees/${employee._id}?month=${month}`} aria-label={`Open ${employee.name}`} onClick={(event) => event.stopPropagation()}><i className="bi bi-chevron-right" aria-hidden="true" /></Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
      {data && employees.some((employee) => employee.currentPay?.payType === 'monthly') && <p className="stock-help">Monthly salary counts every day up to today unless it is marked absent or half day.</p>}
    </div>
  )
}

export default function Employees() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'wages' ? 'wages' : 'attendance'
  const [adding, setAdding] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [toast, notify] = useToast()
  const isPhone = useMediaQuery('(max-width: 720px)')
  // A message passed from the employee page (e.g. after deleting someone).
  const location = useLocation()
  const passedMessage = location.state?.message
  useEffect(() => { if (passedMessage) notify(passedMessage) }, [passedMessage, notify])

  return (
    <section className="page-container staff-page">
      <Toast toast={toast} />
      <PageHeader
        eyebrow="STAFF"
        title="Staff & wages"
        description="Mark daily attendance and see what each employee has earned and is still owed."
        actions={<button type="button" className="continue-btn inventory-add" onClick={() => setAdding(true)}><i className="bi bi-person-plus" aria-hidden="true" />Add employee</button>}
      />
      <div className="staff-tabs" role="tablist" aria-label="Staff views">
        {[['attendance', 'Attendance', 'bi-calendar-check'], ['wages', 'Wages', 'bi-cash-stack']].map(([id, label, icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setSearchParams(id === 'attendance' ? {} : { tab: id }, { replace: true })}>
            <i className={`bi ${icon}`} aria-hidden="true" />{label}
          </button>
        ))}
      </div>
      {tab === 'attendance' ? <AttendanceSheet notify={notify} onAddEmployee={() => setAdding(true)} reloadKey={reloadKey} /> : <WagesView onAddEmployee={() => setAdding(true)} reloadKey={reloadKey} />}
      {isPhone && !adding &&<FloatingActionButton icon="bi-person-plus" label="Add employee" onClick={() => setAdding(true)} />}
      {adding && <EmployeeFormModal onClose={() => setAdding(false)} onSaved={(_saved, message) => { setAdding(false); notify(message); setReloadKey((key) => key + 1) }} />}
    </section>
  )
}

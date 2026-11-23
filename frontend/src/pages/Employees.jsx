import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import LoadError from '../components/LoadError.jsx'
import Toast from '../components/Toast.jsx'
import EmployeeFormModal from '../components/EmployeeFormModal.jsx'
import Avatar from '../components/StaffAvatar.jsx'
import { useToast } from '../hooks/useToast.js'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
import { useApiData } from '../hooks/useApiData.js'
import { EmptyState, FilterChips, FloatingActionButton, PageHeader, SearchInput, SkeletonLoader, StatCard } from '../components/ui.jsx'
import { daysWorked, formatPaise, monthLabel, payLabel, shiftMonth } from '../utils/staff.js'
import { useRememberedState } from '../utils/remember.js'
import AttendanceSheet from '../components/StaffAttendanceSheet.jsx'
import './Employees.css'

/*
 * Staff & wages (administrators and sub-admins only).
 * "Attendance" marks one day for everyone; "Wages" shows each person's month and what is still owed.
 */

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

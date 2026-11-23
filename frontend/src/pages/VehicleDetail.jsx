import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import LoadError from '../components/LoadError.jsx'
import Toast from '../components/Toast.jsx'
import VehicleBadge from '../components/VehicleBadge.jsx'
import BaseChargesModal from '../components/BaseChargesModal.jsx'
import VehicleEntryModal from '../components/VehicleEntryModal.jsx'
import VehicleFormModal from '../components/VehicleFormModal.jsx'
import { ConfirmDialog, FilterChips, SkeletonLoader, StatCard, StatusBadge } from '../components/ui.jsx'
import { useApiData } from '../hooks/useApiData.js'
import { useToast } from '../hooks/useToast.js'
import { formatPaise, monthLabel, shiftMonth, shortDate } from '../utils/staff.js'
import { baseMonthly, formatKm, fuelLabel, mileageText, perKm, VEHICLE_ENTRY_TYPES, vehicleEntryInfo } from '../utils/vehicles.js'
import './Employees.css'
import './Vehicles.css'

/** ₹950, ₹4.2k, ₹1.3L: short enough for a chart label. */
function shortRupees(paise) {
  const rupees = paise / 100
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1).replace(/\.0$/, '')}L`
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return `₹${Math.round(rupees)}`
}

/** Last six months of running cost: fuel and repairs/other stacked, current month highlighted. */
function CostTrend({ trend, month }) {
  const max = Math.max(1, ...trend.map((row) => row.totalPaise))
  return (
    <div className="vehicle-trend" role="img" aria-label={`Running cost for the last six months: ${trend.map((row) => `${monthLabel(row.month)} ${formatPaise(row.totalPaise)}`).join(', ')}`}>
      {trend.map((row) => (
        <div key={row.month} className={`vehicle-trend-col${row.month === month ? ' is-current' : ''}`}>
          <small className="vehicle-trend-value">{row.totalPaise ? shortRupees(row.totalPaise) : ''}</small>
          <div className="vehicle-trend-bar" title={`${monthLabel(row.month)}: ${formatPaise(row.totalPaise)}`}>
            <span className="is-base" style={{ height: `${((row.basePaise || 0) / max) * 100}%` }} />
            <span className="is-fuel" style={{ height: `${(row.fuelPaise / max) * 100}%` }} />
            <span className="is-other" style={{ height: `${((row.servicePaise + row.expensePaise + (row.dailyPaise || 0)) / max) * 100}%` }} />
          </div>
          <small className="vehicle-trend-label">{monthLabel(row.month).slice(0, 3)}</small>
        </div>
      ))}
    </div>
  )
}

export default function VehicleDetail() {
  const { vehicleId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [modal, setModal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all')
  const [allMonths, setAllMonths] = useState(false)
  const [toast, notify] = useToast()
  const month = searchParams.get('month') || ''

  const { data: loaded, loading, error, reload } = useApiData(`/vehicles/${vehicleId}${month ? `?month=${month}` : ''}`)
  // Another vehicle's figures must not show while this one loads.
  const data = loaded && String(loaded.vehicle._id) === vehicleId ? loaded : null
  const done = (message) => { setModal(null); setBusy(false); if (message) notify(message); reload() }

  async function setActive(active) {
    setBusy(true)
    try {
      await apiRequest(`/vehicles/${vehicleId}`, { method: 'PUT', body: JSON.stringify({ active }) })
      done(active ? `${data.vehicle.name} is back in use.` : `${data.vehicle.name} marked as not in use.`)
    } catch (saveError) { setBusy(false); notify(saveError.message, 'danger') }
  }

  async function remove() {
    setBusy(true)
    try {
      const result = await apiRequest(`/vehicles/${vehicleId}`, { method: 'DELETE' })
      navigate('/vehicles', { replace: true, state: { message: result.message } })
    } catch (removeError) { setBusy(false); notify(removeError.message, 'danger') }
  }

  async function removeEntry(entry) {
    setBusy(true)
    try { const result = await apiRequest(`/vehicles/entries/${entry._id}`, { method: 'DELETE' }); done(result.message) }
    catch (removeError) { setBusy(false); notify(removeError.message, 'danger') }
  }

  if (!data) {
    return (
      <section className="page-container staff-page vehicle-page">
        <LoadError message={error} onRetry={reload} />
        {loading && <SkeletonLoader rows={4} />}
        {error && <Link className="back-button" to="/vehicles">Back to vehicles</Link>}
      </section>
    )
  }

  const { vehicle, summary, allTime, trend, today, canManage } = data
  const baseCharges = vehicle.baseCharges || []
  const shownMonth = data.month
  const currentMonth = today.slice(0, 7)
  const goMonth = (value) => setSearchParams({ month: value }, { replace: true })
  const entries = data.entries.filter((entry) => (allMonths || entry.date.startsWith(shownMonth)) && (filter === 'all' || entry.type === filter))

  return (
    <section className="page-container staff-page staff-detail vehicle-page">
      <Toast toast={toast} />
      <header className="staff-profile">
        <VehicleBadge vehicle={vehicle} size={64} />
        <div className="staff-profile-text">
          <h1 className="page-title">{vehicle.name}</h1>
          <p>{[vehicle.number, vehicle.kind, fuelLabel(vehicle.fuelType)].filter(Boolean).join(' · ')}</p>
          <div className="staff-profile-badges">
            {vehicle.active ? <StatusBadge tone="success" icon="bi-check-circle">In use</StatusBadge> : <StatusBadge tone="neutral" icon="bi-pause-circle">Not in use</StatusBadge>}
            {data.lastOdometerKm > 0 && <StatusBadge tone="neutral" icon="bi-speedometer">{formatKm(data.lastOdometerKm)}</StatusBadge>}
            {data.lastFuelDate && <StatusBadge tone="info" icon="bi-fuel-pump">Last fuel {shortDate(data.lastFuelDate)}</StatusBadge>}
          </div>
        </div>
        <div className="staff-profile-actions vehicle-profile-actions">
          <button type="button" className="back-button" onClick={() => setModal({ type: 'edit' })}><i className="bi bi-pencil" aria-hidden="true" />Edit</button>
          {vehicle.active
            ? <button type="button" className="back-button" disabled={busy} onClick={() => setActive(false)}><i className="bi bi-pause-circle" aria-hidden="true" />Not in use</button>
            : <button type="button" className="back-button" disabled={busy} onClick={() => setActive(true)}><i className="bi bi-play-circle" aria-hidden="true" />In use again</button>}
          {canManage && <button type="button" className="back-button staff-danger" onClick={() => setModal({ type: 'delete' })}><i className="bi bi-trash" aria-hidden="true" /><span className="visually-hidden">Delete vehicle</span></button>}
        </div>
      </header>

      <div className="staff-stats">
        <StatCard icon="bi-speedometer2" tone="warning" label={`Running cost · ${monthLabel(shownMonth).split(' ')[0]}`} value={formatPaise(summary.totalPaise)} note={summary.km ? `${formatKm(summary.km)} driven` : 'Add odometer readings to see km'} />
        <StatCard icon="bi-signpost-split" label="Cost per km" value={perKm(summary.costPerKmPaise)} note={summary.fuelPerKmPaise !== null ? `Fuel only ${perKm(summary.fuelPerKmPaise)}` : 'Needs km driven'} />
        <StatCard icon="bi-droplet-half" tone="success" label="Mileage" value={mileageText(data.mileage)} note={data.lastMileage ? `Last fill ${mileageText(data.lastMileage)}` : 'Needs two fuel fills'} />
      </div>

      <div className="staff-quick-actions vehicle-quick-actions">
        {VEHICLE_ENTRY_TYPES.map((type) => <button key={type.id} type="button" className={type.id === 'fuel' ? 'continue-btn' : 'back-button'} onClick={() => setModal({ type: 'entry', entryType: type.id })}><i className={`bi ${type.icon}`} aria-hidden="true" />{type.verb}</button>)}
      </div>

      <section className="staff-panel vehicle-base" aria-labelledby="vehicle-base-title">
        <div className="staff-panel-head">
          <h2 id="vehicle-base-title">Base charges</h2>
          <button type="button" className="ui-chip" onClick={() => setModal({ type: 'base' })}><i className={`bi ${baseCharges.length ? 'bi-pencil' : 'bi-plus-lg'}`} aria-hidden="true" />{baseCharges.length ? 'Edit' : 'Add'}</button>
        </div>
        {baseCharges.length === 0
          ? <p className="stock-help vehicle-base-empty">Add fixed costs like insurance, EMI, road tax, permit or FC. Their monthly share is added to the running cost and cost per km.</p>
          : <>
            <ul className="vehicle-base-list">
              {baseCharges.map((charge) => {
                const active = charge.from <= shownMonth && (!charge.to || shownMonth <= charge.to)
                return (
                  <li key={charge._id} className={active ? '' : 'is-off'}>
                    <span className="vehicle-base-icon" aria-hidden="true"><i className="bi bi-shield-check" /></span>
                    <span className="vehicle-base-text">
                      <strong>{charge.label}</strong>
                      <small>{formatPaise(charge.amountPaise)} {charge.period === 'year' ? 'a year' : 'a month'} · {charge.to ? `${monthLabel(charge.from)} – ${monthLabel(charge.to)}` : `since ${monthLabel(charge.from)}`}{active ? '' : ' · not in this month'}</small>
                    </span>
                    <b className="vehicle-base-amount">{formatPaise(baseMonthly(charge))}<small>/month</small></b>
                  </li>
                )
              })}
            </ul>
            <p className="base-charge-total"><span>Base charges in {monthLabel(shownMonth)}</span><b>{formatPaise(summary.basePaise || 0)}</b></p>
          </>}
      </section>

      <div className="staff-columns">
        <section className="staff-panel" aria-labelledby="vehicle-month-title">
          <div className="staff-panel-head">
            <h2 id="vehicle-month-title">Running cost</h2>
            <div className="staff-daybar is-compact">
              <button type="button" className="inventory-icon-btn" aria-label="Previous month" onClick={() => goMonth(shiftMonth(shownMonth, -1))}><i className="bi bi-chevron-left" aria-hidden="true" /></button>
              <span className="staff-month-label">{monthLabel(shownMonth)}</span>
              <button type="button" className="inventory-icon-btn" aria-label="Next month" disabled={shiftMonth(shownMonth, 1) > currentMonth} onClick={() => goMonth(shiftMonth(shownMonth, 1))}><i className="bi bi-chevron-right" aria-hidden="true" /></button>
            </div>
          </div>
          {loading && <span className="visually-hidden" role="status">Loading</span>}
          <dl className="staff-ledger">
            <div><dt>Fuel{summary.litres ? ` (${summary.litres} L, ${summary.fills} ${summary.fills === 1 ? 'fill' : 'fills'})` : ''}</dt><dd>{formatPaise(summary.fuelPaise)}</dd></div>
            <div><dt>Service & repairs</dt><dd>{formatPaise(summary.servicePaise)}</dd></div>
            <div><dt>Daily use{summary.dailyDays ? ` (${summary.dailyDays} ${summary.dailyDays === 1 ? 'day' : 'days'})` : ''}</dt><dd>{formatPaise(summary.dailyPaise || 0)}</dd></div>
            <div><dt>Other expenses</dt><dd>{formatPaise(summary.expensePaise)}</dd></div>
            <div><dt>Base charges</dt><dd>{formatPaise(summary.basePaise || 0)}</dd></div>
            <div className="is-total"><dt>Total running cost</dt><dd>{formatPaise(summary.totalPaise)}</dd></div>
          </dl>
          <dl className="staff-breakdown">
            <div><dt>Km driven</dt><dd>{formatKm(summary.km)}</dd></div>
            <div><dt>Cost per km</dt><dd>{perKm(summary.costPerKmPaise)}</dd></div>
            <div><dt>Fuel per km</dt><dd>{perKm(summary.fuelPerKmPaise)}</dd></div>
          </dl>

          <h3 className="staff-subhead">Last 6 months</h3>
          <CostTrend trend={trend} month={shownMonth} />
          <p className="stock-help vehicle-trend-legend"><span><i className="is-base" aria-hidden="true" />Base</span><span><i className="is-fuel" aria-hidden="true" />Fuel</span><span><i className="is-other" aria-hidden="true" />Repairs, daily & other</span></p>

          <h3 className="staff-subhead">Since the first record</h3>
          <dl className="staff-ledger">
            <div><dt>Total spent</dt><dd>{formatPaise(allTime.totalPaise)}</dd></div>
            <div><dt>Km driven</dt><dd>{formatKm(allTime.km)}</dd></div>
            <div className="is-total"><dt>Average cost per km</dt><dd>{perKm(allTime.costPerKmPaise)}</dd></div>
          </dl>
        </section>

        <section className="staff-panel" aria-labelledby="vehicle-entries-title">
          <div className="staff-panel-head">
            <h2 id="vehicle-entries-title">Records</h2>
            <button type="button" className="ui-chip" aria-pressed={allMonths} onClick={() => setAllMonths((value) => !value)}>{allMonths ? 'This month only' : 'All months'}</button>
          </div>
          <FilterChips label="Show" value={filter} onChange={setFilter} options={[['all', 'All'], ...VEHICLE_ENTRY_TYPES.map((type) => [type.id, type.label])]} />
          {entries.length === 0 && <p className="stock-help">{allMonths ? 'Nothing recorded yet.' : `Nothing recorded in ${monthLabel(shownMonth)}.`}</p>}
          <ul className="staff-entries vehicle-entries">
            {entries.map((entry) => {
              const info = vehicleEntryInfo(entry.type)
              const detail = [
                shortDate(entry.date),
                entry.type === 'fuel' && entry.litres ? `${entry.litres} L · ${formatPaise(Math.round(entry.amountPaise / entry.litres))}/L` : '',
                entry.odometerKm ? formatKm(entry.odometerKm) : '',
                entry.notes,
              ].filter(Boolean).join(' · ')
              return (
                <li key={entry._id}>
                  <span className={`staff-entry-icon vehicle-entry-icon is-${entry.type}`} aria-hidden="true"><i className={`bi ${info.icon}`} /></span>
                  <span className="staff-entry-text"><strong>{info.label}</strong><small>{detail}</small></span>
                  <b className="staff-entry-amount">{formatPaise(entry.amountPaise)}</b>
                  <button type="button" className="inventory-icon-btn" aria-label={`Remove ${info.label.toLowerCase()} of ${formatPaise(entry.amountPaise)}`} onClick={() => setModal({ type: 'removeEntry', entry })}><i className="bi bi-x-lg" aria-hidden="true" /></button>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      {modal?.type === 'base' && <BaseChargesModal vehicle={vehicle} month={shownMonth} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.type === 'edit' && <VehicleFormModal vehicle={vehicle} onClose={() => setModal(null)} onSaved={(_saved, message) => done(message)} />}
      {modal?.type === 'entry' && <VehicleEntryModal vehicle={vehicle} type={modal.entryType} lastOdometerKm={data.lastOdometerKm} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.type === 'delete' && <ConfirmDialog tone="danger" title={`Delete ${vehicle.name}?`} message="This permanently removes the vehicle with all its fuel, repair and expense records. To keep the history, mark it as not in use instead." confirmLabel="Delete for good" busy={busy} onConfirm={remove} onCancel={() => setModal(null)} />}
      {modal?.type === 'removeEntry' && <ConfirmDialog tone="danger" title="Remove this record?" message={`${vehicleEntryInfo(modal.entry.type).label} of ${formatPaise(modal.entry.amountPaise)} on ${shortDate(modal.entry.date)} will be removed and the figures recalculated.`} confirmLabel="Remove" busy={busy} onConfirm={() => removeEntry(modal.entry)} onCancel={() => setModal(null)} />}
    </section>
  )
}

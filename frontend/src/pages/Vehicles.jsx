import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import LoadError from '../components/LoadError.jsx'
import Toast from '../components/Toast.jsx'
import VehicleFormModal from '../components/VehicleFormModal.jsx'
import VehicleBadge from '../components/VehicleBadge.jsx'
import { EmptyState, FloatingActionButton, PageHeader, SkeletonLoader, StatCard } from '../components/ui.jsx'
import { useApiData } from '../hooks/useApiData.js'
import { apiRequest } from '../services/api.js'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
import { useToast } from '../hooks/useToast.js'
import { formatPaise, monthLabel, shiftMonth } from '../utils/staff.js'
import { formatKm, fuelLabel, mileageText, perKm } from '../utils/vehicles.js'
import './Employees.css'
import './Vehicles.css'

/** Today's daily use on a vehicle card: added (with undo) or a one-tap button with the fixed amount. */
function TodayDaily({ vehicle, busy, onAdd, onUndo, onSetAmount }) {
  const added = vehicle.todayDaily || []
  const addedPaise = added.reduce((total, entry) => total + entry.amountPaise, 0)
  return (
    <div className="vehicle-card-today">
      <span className="vehicle-today-label"><i className="bi bi-calendar-day" aria-hidden="true" />Today</span>
      {added.length > 0 ? <>
        <span className="staff-paid-chip"><i className="bi bi-check-circle-fill" aria-hidden="true" />{formatPaise(addedPaise)} added</span>
        <button type="button" className="vehicle-today-undo" disabled={busy} onClick={() => onUndo(added.at(-1))}>Undo</button>
      </> : vehicle.dailyChargePaise > 0
        ? <button type="button" className="staff-pay-btn vehicle-today-add" disabled={busy} onClick={onAdd}><i className="bi bi-plus-lg" aria-hidden="true" />{busy ? 'Adding…' : `Add ${formatPaise(vehicle.dailyChargePaise)}`}</button>
        : <button type="button" className="vehicle-today-undo" onClick={onSetAmount}><i className="bi bi-gear" aria-hidden="true" />Set daily amount</button>}
    </div>
  )
}

/**
 * Vehicles and what they cost to run each month: fuel, services/repairs and other
 * expenses, km driven (from odometer readings), cost per km and mileage.
 */
export default function Vehicles() {
  const navigate = useNavigate()
  const location = useLocation()
  const isPhone = useMediaQuery('(max-width: 720px)')
  const [month, setMonth] = useState('')
  const [adding, setAdding] = useState(false)
  const [toast, notify] = useToast()
  const [editing, setEditing] = useState(null)
  const [busyId, setBusyId] = useState('')
  const { data, loading: fetching, error, reload } = useApiData(`/vehicles${month ? `?month=${month}` : ''}`)
  const shown = data?.month || ''
  const loading = fetching && (!data || (month && data.month !== month))
  const currentMonth = data?.today?.slice(0, 7)
  const vehicles = data?.vehicles || []
  const total = data?.total
  const open = (vehicle) => navigate(`/vehicles/${vehicle._id}${shown ? `?month=${shown}` : ''}`)
  /** Adds today's fixed daily-use charge in one tap. */
  async function addToday(vehicle) {
    setBusyId(vehicle._id)
    try {
      await apiRequest(`/vehicles/${vehicle._id}/entries`, { method: 'POST', body: JSON.stringify({ type: 'daily', amount: vehicle.dailyChargePaise / 100, date: data.today, notes: 'Daily use' }) })
      notify(`${formatPaise(vehicle.dailyChargePaise)} daily use added for ${vehicle.name}.`, 'success', 'bi-calendar-check')
      reload()
    } catch (addError) { notify(addError.message, 'danger') }
    finally { setBusyId('') }
  }

  async function undoToday(vehicle, entry) {
    setBusyId(vehicle._id)
    try {
      await apiRequest(`/vehicles/entries/${entry._id}`, { method: 'DELETE' })
      notify(`Today's daily use removed for ${vehicle.name}.`, 'info')
      reload()
    } catch (undoError) { notify(undoError.message, 'danger') }
    finally { setBusyId('') }
  }

  // A message passed from the vehicle page (e.g. after deleting a vehicle).
  const passedMessage = location.state?.message
  useEffect(() => { if (passedMessage) notify(passedMessage) }, [passedMessage, notify])

  return (
    <section className="page-container staff-page vehicle-page">
      <Toast toast={toast} />
      <PageHeader
        eyebrow="VEHICLES"
        title="Vehicles"
        description="Fuel, repairs and other running costs of each vehicle, with km driven, cost per km and mileage."
        actions={<button type="button" className="continue-btn inventory-add" onClick={() => setAdding(true)}><i className="bi bi-plus-lg" aria-hidden="true" />Add vehicle</button>}
      />

      <div className="staff-wages">
        <div className="staff-daybar">
          <button type="button" className="inventory-icon-btn" aria-label="Previous month" onClick={() => setMonth(shiftMonth(shown, -1))} disabled={!shown || loading}><i className="bi bi-chevron-left" aria-hidden="true" /></button>
          <label className="staff-daypick">
            <i className="bi bi-calendar3 staff-phone-only" aria-hidden="true" />
            <span>{shown ? monthLabel(shown) : 'Loading…'}</span>
            <input type="month" value={shown} max={currentMonth} onChange={(event) => event.target.value && setMonth(event.target.value)} aria-label="Month" />
          </label>
          <button type="button" className="inventory-icon-btn" aria-label="Next month" onClick={() => setMonth(shiftMonth(shown, 1))} disabled={!shown || loading || shiftMonth(shown, 1) > currentMonth}><i className="bi bi-chevron-right" aria-hidden="true" /></button>
        </div>

        <div className="staff-stats vehicle-stats">
          <StatCard icon="bi-speedometer2" tone="warning" label={`Running cost · ${shown ? monthLabel(shown).split(' ')[0] : 'month'}`} value={formatPaise(total?.totalPaise || 0)} note={total?.km ? `${formatKm(total.km)} driven · ${perKm(total.costPerKmPaise)}` : 'All vehicles'} loading={loading && !data} />
          <StatCard icon="bi-fuel-pump" label="Fuel" value={formatPaise(total?.fuelPaise || 0)} note="This month" loading={loading && !data} />
          <StatCard icon="bi-wrench-adjustable" tone="success" label="Repairs, daily & base" value={formatPaise((total?.servicePaise || 0) + (total?.expensePaise || 0) + (total?.dailyPaise || 0) + (total?.basePaise || 0))} note={total?.basePaise ? `Incl. ${formatPaise(total.basePaise)} base charges` : 'Service, insurance, EMI, toll…'} loading={loading && !data} />
        </div>

        <LoadError message={error} onRetry={reload} />
        {loading && !data && <SkeletonLoader rows={3} />}
        {data && vehicles.length === 0 && <EmptyState icon="bi-truck" title="No vehicles yet" text="Add your vehicles to track fuel, repairs and running cost per km." action={<button type="button" className="continue-btn" onClick={() => setAdding(true)}>Add vehicle</button>} />}

        {vehicles.length > 0 && (
          <ul className="staff-cards vehicle-cards">
            {vehicles.map((vehicle) => (
              <li key={vehicle._id}>
                <div className={`staff-card vehicle-card${vehicle.active ? '' : ' is-inactive'}`}>
                <button type="button" className="vehicle-card-main" onClick={() => open(vehicle)} aria-label={`Open ${vehicle.name}`}>
                  <span className="staff-card-top">
                    <VehicleBadge vehicle={vehicle} />
                    <span className="staff-card-name">
                      <strong>{vehicle.name}</strong>
                      <small>{[vehicle.number, vehicle.kind, fuelLabel(vehicle.fuelType), !vehicle.active && 'Not in use'].filter(Boolean).join(' · ')}</small>
                    </span>
                    <i className="bi bi-chevron-right" aria-hidden="true" />
                  </span>
                  <span className="vehicle-card-cost">
                    <small>Running cost · {shown ? monthLabel(shown).split(' ')[0] : 'this month'}</small>
                    <b>{formatPaise(vehicle.summary.totalPaise)}</b>
                  </span>
                  <span className="vehicle-card-figures">
                    <span><small><i className="bi bi-calendar-day" aria-hidden="true" />Daily use</small><b>{formatPaise(vehicle.summary.dailyPaise || 0)}</b></span>
                    <span><small><i className="bi bi-signpost-2" aria-hidden="true" />Driven</small><b>{formatKm(vehicle.summary.km)}</b></span>
                    <span><small><i className="bi bi-cash-coin" aria-hidden="true" />Per km</small><b>{perKm(vehicle.summary.costPerKmPaise)}</b></span>
                    <span><small><i className="bi bi-droplet-half" aria-hidden="true" />Mileage</small><b>{mileageText(vehicle.mileage)}</b></span>
                  </span>
                </button>
                {vehicle.active && <TodayDaily vehicle={vehicle} busy={busyId === vehicle._id} onAdd={() => addToday(vehicle)} onUndo={(entry) => undoToday(vehicle, entry)} onSetAmount={() => setEditing(vehicle)} />}
                </div>
              </li>
            ))}
          </ul>
        )}
        {vehicles.length > 0 && <p className="stock-help">Km come from the odometer readings you enter. Mileage needs at least two fuel fills with readings; fill the tank full each time for accurate figures.</p>}
      </div>

      {isPhone && !adding && <FloatingActionButton icon="bi-plus-lg" label="Add vehicle" onClick={() => setAdding(true)} />}
      {editing && <VehicleFormModal vehicle={editing} onClose={() => setEditing(null)} onSaved={(_saved, message) => { setEditing(null); notify(message); reload() }} />}
      {adding && <VehicleFormModal onClose={() => setAdding(false)} onSaved={(saved, message) => { setAdding(false); notify(message); navigate(`/vehicles/${saved._id}`) }} />}
    </section>
  )
}

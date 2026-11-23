import Vehicle, { BASE_CHARGE_PERIODS, FUEL_TYPES } from '../models/Vehicle.js'
import VehicleEntry, { VEHICLE_ENTRY_TYPES } from '../models/VehicleEntry.js'
import { recordActivity } from '../utils/activity.js'
import { rupeesToPaise } from '../utils/money.js'
import { badRequest, objectId, optionalImage, optionalText, requiredText } from '../utils/validation.js'
import { isDateKey, isMonthKey, monthEnd, monthStart, todayKey } from '../utils/wages.js'
import { costSummary, lastMileage, lastOdometer, mileage, monthlyBase, monthsBetween } from '../utils/vehicleCosts.js'
import { isManagerRole } from '../config/features.js'

/*
 * Vehicles and their running costs: fuel, services/repairs and other expenses.
 * Administrators and sub-admins always have access; team members need the "Vehicles" feature.
 */

const notFound = (res) => res.status(404).json({ message: 'Vehicle not found.' })

function monthParam(value) {
  if (value === undefined || value === '') return todayKey().slice(0, 7)
  if (!isMonthKey(value)) throw badRequest('Choose a valid month.')
  return value
}

function shiftMonth(month, step) {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number - 1 + step, 1)).toISOString().slice(0, 7)
}

function vehiclePayload(body, { partial }) {
  const has = (key) => body[key] !== undefined
  const fields = {}
  if (!partial || has('name')) fields.name = requiredText(body.name, 'vehicle name', 80)
  if (!partial || has('number')) fields.number = optionalText(body.number, 'vehicle number', 20).toUpperCase()
  if (!partial || has('kind')) fields.kind = optionalText(body.kind, 'vehicle type', 60)
  if (!partial || has('fuelType')) {
    const fuelType = body.fuelType || 'diesel'
    if (!FUEL_TYPES.includes(fuelType)) throw badRequest('Choose a fuel type.')
    fields.fuelType = fuelType
  }
  if (!partial || has('photo')) fields.photo = optionalImage(body.photo, 'photo')
  if (!partial || has('notes')) fields.notes = optionalText(body.notes, 'notes', 1000)
  if (!partial || has('dailyCharge')) {
    const paise = body.dailyCharge === undefined || body.dailyCharge === null || body.dailyCharge === '' ? 0 : rupeesToPaise(body.dailyCharge)
    if (paise === null || paise > 10000000) throw badRequest('Enter a valid daily use amount.')
    fields.dailyChargePaise = paise
  }
  if (has('active')) fields.active = Boolean(body.active)
  return fields
}

function numberParam(value, label, { max }) {
  if (value === undefined || value === null || value === '') return 0
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > max) throw badRequest(`Enter a valid ${label}.`)
  return number
}

/** The figures shown on the vehicle list and the vehicle page. */
function vehicleFigures(vehicle, entries, month) {
  return {
    summary: costSummary(entries, monthStart(month), monthEnd(month), monthlyBase(vehicle.baseCharges, month)),
    lastOdometerKm: lastOdometer(entries),
    mileage: mileage(entries),
    lastMileage: lastMileage(entries),
    lastFuelDate: entries.filter((entry) => entry.type === 'fuel').map((entry) => entry.date).sort().at(-1) || '',
  }
}

export async function listVehicles(req, res, next) {
  try {
    const month = monthParam(req.query.month)
    const [vehicles, entries] = await Promise.all([
      Vehicle.find().sort({ active: -1, name: 1 }).lean(),
      VehicleEntry.find().select('vehicle type date amountPaise litres odometerKm').lean(),
    ])
    const today = todayKey()
    // Daily use already added today, per vehicle (for the "Add today" button on each card).
    const todayDaily = entries.filter((entry) => entry.type === 'daily' && entry.date === today)
      .reduce((map, entry) => map.set(String(entry.vehicle), [...(map.get(String(entry.vehicle)) || []), { _id: entry._id, amountPaise: entry.amountPaise }]), new Map())
    const byVehicle = entries.reduce((map, entry) => map.set(String(entry.vehicle), [...(map.get(String(entry.vehicle)) || []), entry]), new Map())
    const rows = vehicles.map((vehicle) => ({ ...vehicle, ...vehicleFigures(vehicle, byVehicle.get(String(vehicle._id)) || [], month), todayDaily: todayDaily.get(String(vehicle._id)) || [] }))
    const total = rows.reduce((sum, row) => ({
      totalPaise: sum.totalPaise + row.summary.totalPaise,
      fuelPaise: sum.fuelPaise + row.summary.fuelPaise,
      servicePaise: sum.servicePaise + row.summary.servicePaise,
      expensePaise: sum.expensePaise + row.summary.expensePaise,
      basePaise: sum.basePaise + row.summary.basePaise,
      dailyPaise: sum.dailyPaise + row.summary.dailyPaise,
      km: sum.km + row.summary.km,
    }), { totalPaise: 0, fuelPaise: 0, servicePaise: 0, expensePaise: 0, basePaise: 0, dailyPaise: 0, km: 0 })
    res.json({ month, today: todayKey(), vehicles: rows, total: { ...total, costPerKmPaise: total.km > 0 ? Math.round(total.totalPaise / total.km) : null } })
  } catch (error) { next(error) }
}

export async function getVehicle(req, res, next) {
  try {
    const month = monthParam(req.query.month)
    const vehicle = await Vehicle.findById(objectId(req.params.id, 'vehicle ID')).lean()
    if (!vehicle) return notFound(res)
    const entries = await VehicleEntry.find({ vehicle: vehicle._id }).sort({ date: -1, createdAt: -1 }).lean()
    // Last six months, oldest first, for the cost trend.
    const trend = Array.from({ length: 6 }, (_, index) => shiftMonth(month, index - 5)).map((key) => ({ month: key, ...costSummary(entries, monthStart(key), monthEnd(key), monthlyBase(vehicle.baseCharges, key)) }))
    // Since the first record or base charge, up to this month.
    const today = todayKey()
    const firstMonth = [...entries.map((entry) => entry.date.slice(0, 7)), ...(vehicle.baseCharges || []).map((charge) => charge.from)].sort()[0]
    const allTimeBase = firstMonth && firstMonth <= today.slice(0, 7) ? monthsBetween(firstMonth, today.slice(0, 7)).reduce((total, key) => total + monthlyBase(vehicle.baseCharges, key), 0) : 0
    res.json({
      month,
      today: todayKey(),
      vehicle,
      ...vehicleFigures(vehicle, entries, month),
      allTime: costSummary(entries, firstMonth ? monthStart(firstMonth) : today, today, allTimeBase),
      trend,
      entries,
      canManage: isManagerRole(req.user?.role),
    })
  } catch (error) { next(error) }
}

/** The same vehicle number (or, without numbers, the same name) cannot be added twice. */
async function findDuplicate(fields, exceptId) {
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // "TN38AB1234", "TN 38 AB 1234" and "TN-38-AB-1234" are the same number.
  const plate = String(fields.number || '').replace(/[\s-]+/g, '')
  const filter = plate
    ? { number: { $regex: `^${[...plate].map(escape).join('[\\s-]*')}$`, $options: 'i' } }
    :{ number: '', name: { $regex: `^${escape(fields.name)}$`, $options: 'i' } }
  if (exceptId) filter._id = { $ne: exceptId }
  return Vehicle.findOne(filter).select('name number').lean()
}

export async function createVehicle(req, res, next) {
  try {
    const fields = vehiclePayload(req.body || {}, { partial: false })
    const duplicate = await findDuplicate(fields)
    if (duplicate) return res.status(409).json({ message: fields.number ? `${fields.number} is already added as "${duplicate.name}".` : `A vehicle named "${duplicate.name}" is already added. Add its number to tell them apart.` })
    const vehicle = await Vehicle.create(fields)
    await recordActivity(req, { action: 'create', entity: 'vehicle', entityId: vehicle._id, entityLabel: vehicle.name, after: vehicle })
    res.status(201).json(vehicle)
  } catch (error) { next(error) }
}

export async function updateVehicle(req, res, next) {
  try {
    const vehicle = await Vehicle.findById(objectId(req.params.id, 'vehicle ID'))
    if (!vehicle) return notFound(res)
    const before = vehicle.toObject()
    const fields = vehiclePayload(req.body || {}, { partial: true })
    if (fields.number !== undefined || fields.name !== undefined) {
      const duplicate = await findDuplicate({ name: fields.name ?? vehicle.name, number: fields.number ?? vehicle.number }, vehicle._id)
      if (duplicate) return res.status(409).json({ message: `Another vehicle ("${duplicate.name}") already has this ${fields.number ?? vehicle.number ? 'number' : 'name'}.` })
    }
    vehicle.set(fields)
    await vehicle.save()
    await recordActivity(req, { action: 'update', entity: 'vehicle', entityId: vehicle._id, entityLabel: vehicle.name, before, after: vehicle })
    res.json(vehicle)
  } catch (error) { next(error) }
}

export async function deleteVehicle(req, res, next) {
  try {
    if (!isManagerRole(req.user?.role)) return res.status(403).json({ message: 'Only administrators can delete vehicles.' })
    const vehicle = await Vehicle.findById(objectId(req.params.id, 'vehicle ID'))
    if (!vehicle) return notFound(res)
    const before = vehicle.toObject()
    await VehicleEntry.deleteMany({ vehicle: vehicle._id })
    await vehicle.deleteOne()
    await recordActivity(req, { action: 'delete', entity: 'vehicle', entityId: vehicle._id, entityLabel: vehicle.name, before, after: null })
    res.json({ message: `${vehicle.name} and its records were deleted.` })
  } catch (error) { next(error) }
}

/** Replaces the vehicle's base charges. Body: { baseCharges: [{ label, amount, period, from, to }] }. */
export async function saveBaseCharges(req, res, next) {
  try {
    const vehicle = await Vehicle.findById(objectId(req.params.id, 'vehicle ID'))
    if (!vehicle) return notFound(res)
    const list = req.body?.baseCharges
    if (!Array.isArray(list) || list.length > 20) throw badRequest('Base charges are invalid.')
    const baseCharges = list.map((charge, index) => {
      const label = requiredText(charge?.label, `name of base charge ${index + 1}`, 60)
      const amountPaise = rupeesToPaise(charge?.amount)
      if (amountPaise === null || amountPaise < 1 || amountPaise > 100000000000) throw badRequest(`Enter a valid amount for ${label}.`)
      if (!BASE_CHARGE_PERIODS.includes(charge?.period)) throw badRequest(`Choose per month or per year for ${label}.`)
      if (!isMonthKey(charge?.from)) throw badRequest(`Choose the month ${label} starts.`)
      const to = charge?.to || ''
      if (to && (!isMonthKey(to) || to < charge.from)) throw badRequest(`The end month of ${label} must be after it starts.`)
      return { label, amountPaise, period: charge.period, from: charge.from, to }
    })
    const before = vehicle.toObject()
    vehicle.baseCharges = baseCharges
    await vehicle.save()
    await recordActivity(req, { action: 'update', entity: 'vehicle', entityId: vehicle._id, entityLabel: `${vehicle.name}: base charges`, before: { baseCharges: before.baseCharges }, after: { baseCharges } })
    res.json(vehicle)
  } catch (error) { next(error) }
}

/** Adds a fuel fill, service/repair or other expense. */
export async function addEntry(req, res, next) {
  try {
    const body = req.body || {}
    const vehicle = await Vehicle.findById(objectId(req.params.id, 'vehicle ID')).select('name').lean()
    if (!vehicle) return notFound(res)
    if (!VEHICLE_ENTRY_TYPES.includes(body.type)) throw badRequest('Choose fuel, service, daily use or expense.')
    const date = body.date || todayKey()
    if (!isDateKey(date)) throw badRequest('Enter a valid date.')
    if (date > todayKey()) throw badRequest('The date cannot be in the future.')
    const amountPaise = rupeesToPaise(body.amount)
    if (amountPaise === null || amountPaise < 1) throw badRequest('Enter an amount above zero.')
    if (amountPaise > 100000000000) throw badRequest('The amount is too large.')
    const litres = body.type === 'fuel' ? numberParam(body.litres, 'number of litres', { max: 10000 }) : 0
    if (body.type === 'fuel' && !litres) throw badRequest('Enter how many litres were filled.')
    const odometerKm = Math.round(numberParam(body.odometerKm, 'odometer reading', { max: 10000000 }))

    // Odometer readings must go up with the date, or km and mileage would be wrong.
    if (odometerKm) {
      const [earlier, later] = await Promise.all([
        VehicleEntry.findOne({ vehicle: vehicle._id, date: { $lte: date }, odometerKm: { $gt: odometerKm } }).sort({ odometerKm: -1 }).select('date odometerKm').lean(),
        VehicleEntry.findOne({ vehicle: vehicle._id, date: { $gt: date }, odometerKm: { $gt: 0, $lt: odometerKm } }).sort({ odometerKm: 1 }).select('date odometerKm').lean(),
      ])
      if (earlier) throw badRequest(`The odometer was already ${earlier.odometerKm.toLocaleString('en-IN')} km on ${earlier.date}. Check the reading.`)
      if (later) throw badRequest(`A later entry (${later.date}) has a lower reading of ${later.odometerKm.toLocaleString('en-IN')} km. Check the reading.`)
    }

    const entry = await VehicleEntry.create({ vehicle: vehicle._id, type: body.type, date, amountPaise, litres, odometerKm, notes: optionalText(body.notes, 'notes', 500), createdBy: req.user._id })
    await recordActivity(req, { action: 'create', entity: 'vehicleEntry', entityId: entry._id, entityLabel: `${vehicle.name}: ${body.type} ₹${(amountPaise / 100).toFixed(2)}`, after: entry })
    res.status(201).json(entry)
  } catch (error) { next(error) }
}

export async function deleteEntry(req, res, next) {
  try {
    const entry = await VehicleEntry.findByIdAndDelete(objectId(req.params.entryId, 'entry ID'))
    if (!entry) return res.status(404).json({ message: 'This entry was already removed.' })
    const vehicle = await Vehicle.findById(entry.vehicle).select('name').lean()
    await recordActivity(req, { action: 'delete', entity: 'vehicleEntry', entityId: entry._id, entityLabel: `${vehicle?.name || 'Vehicle'}: ${entry.type} ₹${(entry.amountPaise / 100).toFixed(2)}`, before: entry })
    res.json({ message: 'Entry removed.' })
  } catch (error) { next(error) }
}

import mongoose from 'mongoose'
import Employee from '../models/Employee.js'
import Attendance, { ATTENDANCE_STATUSES } from '../models/Attendance.js'
import EmployeePayment, { EMPLOYEE_ENTRY_TYPES, EMPLOYEE_PAYMENT_METHODS } from '../models/EmployeePayment.js'
import { recordActivity } from '../utils/activity.js'
import { rupeesToPaise } from '../utils/money.js'
import { badRequest, objectId, optionalImage, optionalText, requiredText } from '../utils/validation.js'
import { balanceDue, currentRate, isDateKey, isMonthKey, ledgerTotals, monthEarnings, monthEnd, monthStart, todayKey, totalEarnings } from '../utils/wages.js'

/*
 * Staff attendance and wages. Administrators and sub-admins only (see server.js);
 * employees are records, not app users.
 */

const notFound = (res) => res.status(404).json({ message: 'Employee not found.' })

function dateParam(value, label) {
  if (!isDateKey(value)) throw badRequest(`Enter a valid ${label}.`)
  return value
}

function monthParam(value) {
  if (value === undefined || value === '') return todayKey().slice(0, 7)
  if (!isMonthKey(value)) throw badRequest('Choose a valid month.')
  return value
}

function moneyParam(value, label, { required = true } = {}) {
  if (!required && (value === undefined || value === null || value === '')) return 0
  const paise = rupeesToPaise(value)
  if (paise === null) throw badRequest(`Enter a valid ${label}.`)
  if (paise > 100000000000) throw badRequest(`The ${label} is too large.`)
  return paise
}

function payType(value) {
  if (!['daily', 'monthly'].includes(value)) throw badRequest('Choose daily wage or monthly salary.')
  return value
}

function weeklyOff(value) {
  if (value === undefined || value === null || value === '') return 0
  const day = Number(value)
  if (!Number.isInteger(day) || day < -1 || day > 6) throw badRequest('Choose a valid weekly day off.')
  return day
}

/** Name, phone and other profile fields (not pay). */
function profilePayload(body, { partial }) {
  const has = (key) => body[key] !== undefined
  const fields = {}
  if (!partial || has('name')) fields.name = requiredText(body.name, 'employee name', 120)
  if (!partial || has('phone')) fields.phone = optionalText(body.phone, 'phone number', 30)
  if (!partial || has('designation')) fields.designation = optionalText(body.designation, 'job title', 80)
  if (!partial || has('photo')) fields.photo = optionalImage(body.photo, 'photo')
  if (!partial || has('joinDate')) fields.joinDate = dateParam(body.joinDate, 'joining date')
  if (!partial || has('weeklyOff')) fields.weeklyOff = weeklyOff(body.weeklyOff)
  if (!partial || has('notes')) fields.notes = optionalText(body.notes, 'notes', 1000)
  return fields
}

/** The figures shown on the staff list and the employee page. */
async function wageAccount(employee, month, today, { records, entries } = {}) {
  const [allRecords, allEntries] = await Promise.all([
    records || Attendance.find({ employee: employee._id }).select('date status overtimeHours').lean(),
    entries || EmployeePayment.find({ employee: employee._id }).select('type amountPaise date').lean(),
  ])
  const earnedTotal = totalEarnings(employee, allRecords, today)
  const totals = ledgerTotals(allEntries)
  const inMonth = allEntries.filter((entry) => entry.date >= monthStart(month) && entry.date <= monthEnd(month))
  return {
    monthSummary: monthEarnings(employee, allRecords, month, today),
    monthEntries: ledgerTotals(inMonth),
    earnedTotalPaise: earnedTotal,
    entryTotals: totals,
    balanceDuePaise: balanceDue(earnedTotal, totals),
  }
}

const publicEmployee = (employee, today) => ({ ...employee, currentPay: currentRate(employee, today) })

export async function listEmployees(req, res, next) {
  try {
    const month = monthParam(req.query.month)
    const today = todayKey()
    const [employees, records, entries] = await Promise.all([
      Employee.find().sort({ active: -1, name: 1 }).lean(),
      Attendance.find().select('employee date status overtimeHours').lean(),
      EmployeePayment.find().select('employee type amountPaise date').lean(),
    ])
    const group = (list) => list.reduce((map, item) => map.set(String(item.employee), [...(map.get(String(item.employee)) || []), item]), new Map())
    const recordsBy = group(records)
    const entriesBy = group(entries)
    const rows = await Promise.all(employees.map(async (employee) => ({
      ...publicEmployee(employee, today),
      ...(await wageAccount(employee, month, today, { records: recordsBy.get(String(employee._id)) || [], entries: entriesBy.get(String(employee._id)) || [] })),
    })))
    const todayRecords = records.filter((record) => record.date === today)
    res.json({
      month,
      today,
      employees: rows,
      todayCounts: {
        active: employees.filter((employee) => employee.active).length,
        marked: todayRecords.length,
        present: todayRecords.filter((record) => record.status === 'present' || record.status === 'half_day').length,
      },
    })
  } catch (error) { next(error) }
}

export async function getEmployee(req, res, next) {
  try {
    const month = monthParam(req.query.month)
    const today = todayKey()
    const employee = await Employee.findById(objectId(req.params.id, 'employee ID')).lean()
    if (!employee) return notFound(res)
    const [records, entries] = await Promise.all([
      Attendance.find({ employee: employee._id }).select('date status overtimeHours note').lean(),
      EmployeePayment.find({ employee: employee._id }).sort({ date: -1, createdAt: -1 }).lean(),
    ])
    const account = await wageAccount(employee, month, today, { records, entries })
    res.json({
      month,
      today,
      employee: publicEmployee(employee, today),
      ...account,
      attendance: records.filter((record) => record.date >= monthStart(month) && record.date <= monthEnd(month)),
      entries,
    })
  } catch (error) { next(error) }
}

export async function createEmployee(req, res, next) {
  try {
    const body = req.body || {}
    const fields = profilePayload(body, { partial: false })
    const employee = await Employee.create({
      ...fields,
      payHistory: [{ from: fields.joinDate, payType: payType(body.payType), ratePaise: moneyParam(body.rate, body.payType === 'monthly' ? 'monthly salary' : 'daily wage'), overtimeRatePaise: moneyParam(body.overtimeRate, 'overtime rate', { required: false }) }],
    })
    await recordActivity(req, { action: 'create', entity: 'employee', entityId: employee._id, after: employee })
    res.status(201).json(employee)
  } catch (error) { next(error) }
}

/**
 * Profile changes apply straight away. A pay change is added to the pay history from
 * `payFrom` (default today), so wages already earned keep their old rate.
 */
export async function updateEmployee(req, res, next) {
  try {
    const body = req.body || {}
    const employee = await Employee.findById(objectId(req.params.id, 'employee ID'))
    if (!employee) return notFound(res)
    const before = employee.toObject()
    employee.set(profilePayload(body, { partial: true }))

    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') throw badRequest('Employee status must be working or left.')
      employee.active = body.active
      employee.leftDate = body.active ? '' : dateParam(body.leftDate || todayKey(), 'last working day')
      if (!body.active && employee.leftDate < employee.joinDate) throw badRequest('The last working day cannot be before the joining date.')
    }

    if (body.payType !== undefined || body.rate !== undefined || body.overtimeRate !== undefined) {
      const current = currentRate(employee.toObject())
      const next = {
        payType: body.payType !== undefined ? payType(body.payType) : current.payType,
        ratePaise: body.rate !== undefined ? moneyParam(body.rate, 'pay') : current.ratePaise,
        overtimeRatePaise: body.overtimeRate !== undefined ? moneyParam(body.overtimeRate, 'overtime rate', { required: false }) : current.overtimeRatePaise || 0,
      }
      const changed = next.payType !== current.payType || next.ratePaise !== current.ratePaise || next.overtimeRatePaise !== (current.overtimeRatePaise || 0)
      if (changed) {
        let from = body.payFrom ? dateParam(body.payFrom, 'date the new pay starts') : todayKey()
        if (from < employee.joinDate) from = employee.joinDate
        // A new rate replaces any rate that starts on the same day or later.
        const history = employee.payHistory.map((entry) => entry.toObject()).filter((entry) => entry.from < from)
        employee.payHistory = [...history, { from, ...next }]
      }
    }
    // Keep the first rate starting on the joining date, so early days always have a rate.
    const sorted = employee.payHistory.map((entry) => entry.toObject()).sort((a, b) => a.from.localeCompare(b.from))
    if (sorted[0] && sorted[0].from !== employee.joinDate) {
      const startRate = [...sorted].reverse().find((entry) => entry.from <= employee.joinDate) || sorted[0]
      const kept = sorted.filter((entry) => entry.from > employee.joinDate && entry !== startRate)
      employee.payHistory = [{ ...startRate, from: employee.joinDate }, ...kept]
    }

    await employee.save()
    await recordActivity(req, { action: 'update', entity: 'employee', entityId: employee._id, before, after: employee })
    res.json(employee)
  } catch (error) { next(error) }
}

/** Deletes the employee with their attendance and wage account. */
export async function deleteEmployee(req, res, next) {
  const session = await mongoose.startSession()
  try {
    const id = objectId(req.params.id, 'employee ID')
    let employee = null
    let removed = { attendance: 0, entries: 0 }
    await session.withTransaction(async () => {
      employee = await Employee.findById(id).session(session)
      if (!employee) return
      const attendance = await Attendance.deleteMany({ employee: id }, { session })
      const entries = await EmployeePayment.deleteMany({ employee: id }, { session })
      await Employee.deleteOne({ _id: id }, { session })
      removed = { attendance: attendance.deletedCount, entries: entries.deletedCount }
    })
    if (!employee) return notFound(res)
    await recordActivity(req, { action: 'delete', entity: 'employee', entityId: employee._id, entityLabel: `${employee.name} (with ${removed.attendance} attendance days and ${removed.entries} wage entries)`, before: employee })
    res.json({ message: `${employee.name} deleted.`, ...removed })
  } catch (error) { next(error) }
  finally { await session.endSession() }
}

/** The attendance sheet for one day: everyone working on that day, with their record if marked. */
export async function getAttendanceSheet(req, res, next) {
  try {
    const date = req.query.date ? dateParam(req.query.date, 'date') : todayKey()
    const [employees, records] = await Promise.all([
      Employee.find({ joinDate: { $lte: date }, $or: [{ leftDate: '' }, { leftDate: { $gte: date } }] }).select('name designation photo weeklyOff payHistory joinDate leftDate active').sort({ name: 1 }).lean(),
      Attendance.find({ date }).lean(),
    ])
    const byEmployee = new Map(records.map((record) => [String(record.employee), record]))
    res.json({
      date,
      today: todayKey(),
      employees: employees.map((employee) => {
        const rate = currentRate(employee, date)
        return { _id: employee._id, name: employee.name, designation: employee.designation, photo: employee.photo, weeklyOff: employee.weeklyOff, payType: rate?.payType, hasOvertimeRate: Boolean(rate?.overtimeRatePaise), record: byEmployee.get(String(employee._id)) || null }
      }),
    })
  } catch (error) { next(error) }
}

/**
 * Saves a day's attendance. Body: { date, entries: [{ employee, status, overtimeHours, note }] }.
 * `status: null` clears that employee's mark for the day.
 */
export async function saveAttendance(req, res, next) {
  try {
    const date = dateParam(req.body?.date, 'date')
    if (date > todayKey()) throw badRequest('Attendance cannot be marked for a future date.')
    const entries = req.body?.entries
    if (!Array.isArray(entries) || !entries.length || entries.length > 500) throw badRequest('Mark attendance for at least one employee.')
    const ids = entries.map((entry) => objectId(entry?.employee, 'employee ID'))
    if (new Set(ids).size !== ids.length) throw badRequest('Each employee can be marked once per day.')
    const employees = await Employee.find({ _id: { $in: ids } }).select('name joinDate leftDate').lean()
    const byId = new Map(employees.map((employee) => [String(employee._id), employee]))

    const operations = entries.map((entry, index) => {
      const employee = byId.get(ids[index])
      if (!employee) throw badRequest('One of the employees no longer exists. Reload the page.')
      if (date < employee.joinDate || (employee.leftDate && date > employee.leftDate)) throw badRequest(`${employee.name} was not working on this date.`)
      const filter = { employee: employee._id, date }
      if (entry.status === null || entry.status === '') return { deleteOne: { filter } }
      if (!ATTENDANCE_STATUSES.includes(entry.status)) throw badRequest(`Choose present, absent, half day, leave or holiday for ${employee.name}.`)
      const overtimeHours = entry.overtimeHours === undefined || entry.overtimeHours === '' ? 0 : Number(entry.overtimeHours)
      if (!Number.isFinite(overtimeHours) || overtimeHours < 0 || overtimeHours > 24) throw badRequest(`Overtime for ${employee.name} must be between 0 and 24 hours.`)
      const update = { status: entry.status, overtimeHours: Math.round(overtimeHours * 100) / 100, note: optionalText(entry.note, 'note', 200), markedBy: req.user._id }
      return { updateOne: { filter, update: { $set: update }, upsert: true } }
    })
    await Attendance.bulkWrite(operations, { ordered: false })
    const counts = entries.reduce((map, entry) => ({ ...map, [entry.status || 'cleared']: (map[entry.status || 'cleared'] || 0) + 1 }), {})
    await recordActivity(req, { action: 'update', entity: 'attendance', entityLabel: `Attendance ${date}`, before: null, after: counts })
    res.json({ message: `Attendance saved for ${entries.length} ${entries.length === 1 ? 'employee' : 'employees'}.` })
  } catch (error) { next(error) }
}

/** Adds a payment, advance, bonus or deduction to the employee's wage account. */
export async function addEntry(req, res, next) {
  try {
    const body = req.body || {}
    const employee = await Employee.findById(objectId(req.params.id, 'employee ID')).select('name').lean()
    if (!employee) return notFound(res)
    if (!EMPLOYEE_ENTRY_TYPES.includes(body.type)) throw badRequest('Choose payment, advance, bonus or deduction.')
    const paidOut = body.type === 'payment' || body.type === 'advance'
    const method = paidOut ? (body.paymentMethod || 'cash') : ''
    if (paidOut && !EMPLOYEE_PAYMENT_METHODS.includes(method)) throw badRequest('Choose how the money was paid.')
    const date = dateParam(body.date || todayKey(), 'date')
    if (date > todayKey()) throw badRequest('The date cannot be in the future.')
    const amountPaise = moneyParam(body.amount, 'amount')
    if (amountPaise < 1) throw badRequest('Enter an amount above zero.')
    const entry = await EmployeePayment.create({ employee: employee._id, type: body.type, amountPaise, date, paymentMethod: method, notes: optionalText(body.notes, 'notes', 500), createdBy: req.user._id })
    await recordActivity(req, { action: 'create', entity: 'employeePayment', entityId: entry._id, entityLabel: `${employee.name}: ${body.type} ₹${(amountPaise / 100).toFixed(2)}`, after: entry })
    res.status(201).json(entry)
  } catch (error) { next(error) }
}

export async function deleteEntry(req, res, next) {
  try {
    const entry = await EmployeePayment.findByIdAndDelete(objectId(req.params.entryId, 'entry ID'))
    if (!entry) return res.status(404).json({ message: 'This entry was already removed.' })
    const employee = await Employee.findById(entry.employee).select('name').lean()
    await recordActivity(req, { action: 'delete', entity: 'employeePayment', entityId: entry._id, entityLabel: `${employee?.name || 'Employee'}: ${entry.type} ₹${(entry.amountPaise / 100).toFixed(2)}`, before: entry })
    res.json({ message: 'Entry removed.' })
  } catch (error) { next(error) }
}

/*
 * Wage rules (all money in integer paise, dates as YYYY-MM-DD strings):
 *
 * Daily workers are paid for the days they worked:
 *   present = 1 day's wage, half day = ½, absent / leave / holiday / not marked = nothing.
 * Monthly staff get salary ÷ days in that month for every day, minus:
 *   absent = 1 day, half day = ½ day. Leave, holiday, weekly off and unmarked days are paid.
 * Overtime hours are paid at the overtime rate for both.
 * Only days from the join date up to today (or the leaving date) count.
 * Each day uses the pay rate that applied on that day, so a raise never changes past wages.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MONTH_PATTERN = /^\d{4}-\d{2}$/

export const isDateKey = (value) => typeof value === 'string' && DATE_PATTERN.test(value) && dateKey(parseKey(value)) === value
export const isMonthKey = (value) => typeof value === 'string' && MONTH_PATTERN.test(value) && Number(value.slice(5)) >= 1 && Number(value.slice(5)) <= 12

const parseKey = (key) => new Date(`${key}T00:00:00Z`)
const dateKey = (date) => date.toISOString().slice(0, 10)

/** Today's date in the shop's timezone (Vercel servers run in UTC). */
export function todayKey(now = new Date(), timeZone = process.env.APP_TIMEZONE || 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function addDays(key, days) {
  const date = parseKey(key)
  date.setUTCDate(date.getUTCDate() + days)
  return dateKey(date)
}

export function daysInMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export const monthStart = (monthKey) => `${monthKey}-01`
export const monthEnd = (monthKey) => `${monthKey}-${String(daysInMonth(monthKey)).padStart(2, '0')}`
export const weekday = (key) => parseKey(key).getUTCDay()

/** The pay rate in force on `day` (the latest entry starting on or before it). */
export function rateOn(payHistory, day) {
  const sorted = [...(payHistory || [])].sort((a, b) => a.from.localeCompare(b.from))
  let rate = sorted[0] || null
  for (const entry of sorted) if (entry.from <= day) rate = entry
  return rate
}

export const currentRate = (employee, today = todayKey()) => rateOn(employee.payHistory, today)

/** First and last day that count for wages inside [from, to]; null when none do. */
export function workingRange(employee, from, to, today = todayKey()) {
  const start = [from, employee.joinDate].filter(Boolean).sort().at(-1)
  const end = [to, today, employee.leftDate].filter(Boolean).sort()[0]
  return start <= end ? { start, end } : null
}

const emptySummary = () => ({ present: 0, halfDay: 0, absent: 0, leave: 0, holiday: 0, unmarked: 0, overtimeHours: 0, basePaise: 0, overtimePaise: 0, earnedPaise: 0 })

/**
 * Earnings and day counts for one month. `records` are this employee's attendance
 * records (any range; only those inside the month are used).
 */
export function monthEarnings(employee, records, monthKey, today = todayKey()) {
  const summary = emptySummary()
  const range = workingRange(employee, monthStart(monthKey), monthEnd(monthKey), today)
  if (!range) return summary
  const byDate = new Map(records.map((record) => [record.date, record]))
  const monthDays = daysInMonth(monthKey)
  let base = 0
  let overtime = 0
  for (let day = range.start; day <= range.end; day = addDays(day, 1)) {
    const record = byDate.get(day)
    const rate = rateOn(employee.payHistory, day)
    const status = record?.status
    if (status === 'present') summary.present += 1
    else if (status === 'half_day') summary.halfDay += 1
    else if (status === 'absent') summary.absent += 1
    else if (status === 'leave') summary.leave += 1
    else if (status === 'holiday') summary.holiday += 1
    else summary.unmarked += 1
    if (!rate) continue
    if (rate.payType === 'monthly') {
      const factor = status === 'absent' ? 0 : status === 'half_day' ? 0.5 : 1
      base += (rate.ratePaise / monthDays) * factor
    } else {
      const factor = status === 'present' ? 1 : status === 'half_day' ? 0.5 : 0
      base += rate.ratePaise * factor
    }
    const hours = Number(record?.overtimeHours) || 0
    if (hours) {
      summary.overtimeHours += hours
      overtime += hours * (rate.overtimeRatePaise || 0)
    }
  }
  summary.basePaise = Math.round(base)
  summary.overtimePaise = Math.round(overtime)
  summary.earnedPaise = summary.basePaise + summary.overtimePaise
  return summary
}

/** Months from the join date up to the last counted month, e.g. ['2026-09', '2026-10']. */
export function monthsWorked(employee, today = todayKey()) {
  const range = workingRange(employee, employee.joinDate, today, today)
  if (!range) return []
  const months = []
  let [year, month] = range.start.slice(0, 7).split('-').map(Number)
  const last = range.end.slice(0, 7)
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    months.push(key)
    if (key >= last) break
    month += 1
    if (month > 12) { month = 1; year += 1 }
  }
  return months
}

/** Total earned since joining (the sum of rounded months, so it matches the monthly figures). */
export function totalEarnings(employee, records, today = todayKey()) {
  return monthsWorked(employee, today).reduce((total, month) => total + monthEarnings(employee, records, month, today).earnedPaise, 0)
}

/** Day counts since joining (up to today or the leaving date), added up month by month. */
export function totalSummary(employee, records, today = todayKey()) {
  const months = monthsWorked(employee, today)
  const total = { ...emptySummary(), months: months.length, calendarDays: 0 }
  for (const month of months) {
    const summary = monthEarnings(employee, records, month, today)
    for (const key of ['present', 'halfDay', 'absent', 'leave', 'holiday', 'unmarked', 'overtimeHours', 'basePaise', 'overtimePaise', 'earnedPaise']) total[key] += summary[key]
  }
  total.calendarDays = total.present + total.halfDay + total.absent + total.leave + total.holiday + total.unmarked
  return total
}

/** Sums the wage account entries by type. */
export function ledgerTotals(entries) {
  const totals = { payment: 0, advance: 0, bonus: 0, deduction: 0 }
  for (const entry of entries) if (entry.type in totals) totals[entry.type] += entry.amountPaise || 0
  return totals
}

/** What the business still owes the employee (negative = the employee was paid ahead). */
export function balanceDue(earnedPaise, totals) {
  return earnedPaise + totals.bonus - totals.deduction - totals.payment - totals.advance
}

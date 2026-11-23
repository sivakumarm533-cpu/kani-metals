/*
 * Running-cost figures for vehicles (money in paise, dates as YYYY-MM-DD).
 *
 * Distance in a month = last odometer reading up to the month end
 *   − last reading before the month (or the first reading in the month).
 * Mileage uses the full-tank method: km between the first and last fuel fill
 *   ÷ litres filled after the first fill. Filling the tank full each time keeps it accurate.
 */

const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places

const byDate = (a, b) => a.date.localeCompare(b.date) || (a.odometerKm || 0) - (b.odometerKm || 0)

/** Km driven between two dates (inclusive), from the odometer readings. */
export function distanceKm(entries, from, to) {
  const readings = entries.filter((entry) => entry.odometerKm > 0 && entry.date <= to).sort(byDate)
  if (!readings.length) return 0
  const before = readings.filter((entry) => entry.date < from)
  const inside = readings.filter((entry) => entry.date >= from)
  if (!inside.length) return 0
  const start = before.length ? Math.max(...before.map((entry) => entry.odometerKm)) : Math.min(...inside.map((entry) => entry.odometerKm))
  const end = Math.max(...inside.map((entry) => entry.odometerKm))
  return Math.max(0, end - start)
}

/** Km per litre over the given fuel fills (full-tank method); null when there is not enough data. */
export function mileage(entries) {
  const fills = entries.filter((entry) => entry.type === 'fuel' && entry.odometerKm > 0 && entry.litres > 0).sort(byDate)
  if (fills.length < 2) return null
  const km = fills.at(-1).odometerKm - fills[0].odometerKm
  const litres = fills.slice(1).reduce((sum, entry) => sum + entry.litres, 0)
  return km > 0 && litres > 0 ? round(km / litres, 1) : null
}

/** Mileage between the last two fills. */
export function lastMileage(entries) {
  const fills = entries.filter((entry) => entry.type === 'fuel' && entry.odometerKm > 0 && entry.litres > 0).sort(byDate)
  if (fills.length < 2) return null
  const [previous, last] = fills.slice(-2)
  const km = last.odometerKm - previous.odometerKm
  return km > 0 ? round(km / last.litres, 1) : null
}

/** The share of the base (fixed) charges that falls in one month (YYYY-MM). Yearly charges count 1/12. */
export function monthlyBase(charges = [], month) {
  return (charges || [])
    .filter((charge) => charge.from <= month && (!charge.to || month <= charge.to))
    .reduce((total, charge) => total + (charge.period === 'year' ? Math.round(charge.amountPaise / 12) : charge.amountPaise), 0)
}

/** Every month from `from` to `to` (both YYYY-MM), inclusive. */
export function monthsBetween(from, to) {
  const months = []
  let [year, month] = from.split('-').map(Number)
  for (let guard = 0; guard < 1200; guard += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    if (key > to) break
    months.push(key)
    month += 1
    if (month > 12) { month = 1; year += 1 }
  }
  return months
}

/** Costs, litres and km for entries dated in [from, to]; `basePaise` is the base charges for that period. */
export function costSummary(entries, from, to, basePaise = 0) {
  const inside = entries.filter((entry) => entry.date >= from && entry.date <= to)
  const sum = (type) => inside.filter((entry) => entry.type === type).reduce((total, entry) => total + entry.amountPaise, 0)
  const fuelPaise = sum('fuel')
  const servicePaise = sum('service')
  const expensePaise = sum('expense')
  const dailyPaise = sum('daily')
  const totalPaise = fuelPaise + servicePaise + expensePaise + dailyPaise + basePaise
  const km = distanceKm(entries, from, to)
  const litres = round(inside.filter((entry) => entry.type === 'fuel').reduce((total, entry) => total + (entry.litres || 0), 0))
  return {
    fuelPaise, servicePaise, expensePaise, dailyPaise, basePaise, totalPaise, km, litres,
    dailyDays: new Set(inside.filter((entry) => entry.type === 'daily').map((entry) => entry.date)).size,
    fills: inside.filter((entry) => entry.type === 'fuel').length,
    costPerKmPaise: km > 0 ? Math.round(totalPaise / km) : null,
    fuelPerKmPaise: km > 0 ? Math.round(fuelPaise / km) : null,
  }
}

export const lastOdometer = (entries) => entries.reduce((max, entry) => Math.max(max, entry.odometerKm || 0), 0)

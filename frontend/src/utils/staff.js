/** Shared labels and helpers for the Staff & wages screens. Money from the API is in paise. */

export const STATUSES = [
  { id: 'present', short: 'P', label: 'Present', icon: 'bi-check-circle-fill', tone: 'success' },
  { id: 'half_day', short: '½', label: 'Half day', icon: 'bi-circle-half', tone: 'warning' },
  { id: 'absent', short: 'A', label: 'Absent', icon: 'bi-x-circle-fill', tone: 'danger' },
  { id: 'leave', short: 'L', label: 'Leave', icon: 'bi-airplane', tone: 'info' },
  { id: 'holiday', short: 'H', label: 'Holiday', icon: 'bi-sun', tone: 'neutral' },
]
export const statusInfo = (id) => STATUSES.find((status) => status.id === id)

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const ENTRY_TYPES = [
  { id: 'payment', label: 'Wages paid', verb: 'Pay wages', icon: 'bi-cash-coin', sign: -1, help: 'Money paid to the employee for work done.' },
  { id: 'advance', label: 'Advance', verb: 'Give advance', icon: 'bi-wallet2', sign: -1, help: 'Money given ahead of wages; it is taken off what you owe.' },
  { id: 'bonus', label: 'Bonus', verb: 'Add bonus', icon: 'bi-gift', sign: 1, help: 'Extra earnings added to what you owe (pay it with "Pay wages").' },
  { id: 'deduction', label: 'Deduction', verb: 'Deduct', icon: 'bi-dash-circle', sign: -1, help: 'Taken off earnings, e.g. a fine or damage. No money changes hands.' },
]
export const entryInfo = (id) => ENTRY_TYPES.find((type) => type.id === id)

export const PAYMENT_METHODS = [
  ['cash', 'Cash'], ['gpay', 'GPay'], ['phonepe', 'PhonePe'], ['paytm', 'Paytm'], ['upi_other', 'Other UPI'],
  ['net_banking', 'Net banking'], ['bank_deposit', 'Bank deposit'], ['cheque', 'Cheque'], ['other', 'Other'],
]
export const methodLabel = (id) => PAYMENT_METHODS.find(([key]) => key === id)?.[1] || ''

const rupee = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 })
export const formatPaise = (paise) => rupee.format((Number(paise) || 0) / 100)
export const paiseToInput = (paise) => (paise ? String((paise / 100).toFixed(2)).replace(/\.00$/, '') : '')

export const payLabel = (pay) => {
  if (!pay) return '—'
  return pay.payType === 'monthly' ? `${formatPaise(pay.ratePaise)} / month` : `${formatPaise(pay.ratePaise)} / day`
}

export function monthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function shiftMonth(monthKey, step) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + step, 1))
  return date.toISOString().slice(0, 7)
}

export function shiftDate(dateKey, step) {
  const date = new Date(`${dateKey}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + step)
  return date.toISOString().slice(0, 10)
}

export const weekdayOf = (dateKey) => new Date(`${dateKey}T00:00:00Z`).getUTCDay()

export function dayLabel(dateKey, today) {
  if (dateKey === today) return 'Today'
  if (dateKey === shiftDate(today, -1)) return 'Yesterday'
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export const shortDate = (dateKey) => new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?'

/** "12 P · 1 ½ · 2 A" style day count for a month summary. */
export function daysWorked(summary) {
  if (!summary) return 0
  return summary.present + summary.halfDay / 2
}

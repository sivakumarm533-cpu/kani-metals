/** Today's date as YYYY-MM-DD in the user's own timezone (for <input type="date">). */
export function localDateInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10)
}

const rupeeFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Formats a rupee amount (not paise) with the Indian grouping, e.g. ₹1,23,456.00. */
export function formatRupees(value) {
  const number = Number(value)
  return rupeeFormatter.format(Number.isFinite(number) ? number : 0)
}

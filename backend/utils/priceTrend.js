/**
 * The rate the latest price is compared with, from `older` (newest first, same order as the bills).
 *
 * It is the most recent rate from another bill at a different price, so selling the same item twice
 * at the same price (for example two bills on one day) still shows the change from the price before.
 * When every earlier bill has the same price, the most recent other bill is returned ("no change").
 * Several lines of the same bill never count as an update.
 */
export function previousRate(latest, older = []) {
  if (!latest) return null
  const otherBills = older.filter((rate) => String(rate.bill) !== String(latest.bill))
  const latestPrice = Number(latest.price)
  return otherBills.find((rate) => Number(rate.price) !== latestPrice) || otherBills[0] || null
}

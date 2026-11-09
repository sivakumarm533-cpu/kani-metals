import Bill from '../models/Bill.js'
import Dealer from '../models/Dealer.js'
import Payment from '../models/Payment.js'
import { rupeesToPaise } from './money.js'

function conflict(message) {
  const error = new Error(message)
  error.statusCode = 409
  return error
}

/**
 * Adds up to `amountPaise` to a bill's received total inside `session`.
 * Returns how much went to the bill (`applied`) and how much was left over (`excess`).
 * With `allowExcess: false` the whole amount must fit or nothing is applied (returns null).
 */
export async function applyToBill(billId, amountPaise, session, { allowExcess = true } = {}) {
  // lean(): read the raw stored value. Older bills have no receivedPaise field at all, and a
  // hydrated document would report the schema default (0), which then never matched below.
  const bill = await Bill.findById(billId).select('total receivedPaise').session(session).lean()
  if (!bill) return null
  const totalPaise = rupeesToPaise(bill.total) ?? 0
  const stored = bill.receivedPaise
  const already = Number.isFinite(stored) ? stored : 0
  const applied = Math.min(amountPaise, Math.max(0, totalPaise - already))
  if (!allowExcess && applied < amountPaise) return null
  if (applied > 0) {
    // Only update if nobody changed the balance since it was read ({ $in: [null] } also matches a missing field).
    const sameBalance = Number.isFinite(stored) ? stored : { $in: [null] }
    const updated = await Bill.findOneAndUpdate({ _id: bill._id, receivedPaise: sameBalance }, { $set: { receivedPaise: already + applied } }, { session, returnDocument: 'after' })
    if (!updated) throw conflict('This bill was changed at the same time. Please try again.')
  }
  return { applied, excess: amountPaise - applied }
}

export async function addDealerAdvance(dealerId, amountPaise, session) {
  if (amountPaise > 0) await Dealer.updateOne({ _id: dealerId }, { $inc: { advancePaise: amountPaise } }, { session })
}

/** Takes `amountPaise` from the dealer's advance; returns false when there is not enough. */
export async function takeDealerAdvance(dealerId, amountPaise, session) {
  if (amountPaise <= 0) return true
  const result = await Dealer.updateOne({ _id: dealerId, advancePaise: { $gte: amountPaise } }, { $inc: { advancePaise: -amountPaise } }, { session })
  return result.modifiedCount === 1
}

/**
 * Uses the dealer's advance on a new bill automatically. Returns the created
 * 'advance' payment, or null when the dealer has no advance.
 */
export async function useAdvanceOnBill({ dealerId, billId, userId }) {
  const dealer = await Dealer.findById(dealerId).select('advancePaise').lean()
  if (!dealer?.advancePaise) return null
  const session = await Payment.startSession()
  let created = null
  try {
    await session.withTransaction(async () => {
      created = null
      const fresh = await Dealer.findById(dealerId).select('advancePaise').session(session).lean()
      const bill = await Bill.findById(billId).select('total receivedPaise').session(session).lean()
      if (!fresh?.advancePaise || !bill) return
      const pending = Math.max(0, (rupeesToPaise(bill.total) ?? 0) - (bill.receivedPaise || 0))
      const use = Math.min(fresh.advancePaise, pending)
      if (use <= 0) return
      if (!await takeDealerAdvance(dealerId, use, session)) throw conflict('Advance changed at the same time.')
      await applyToBill(billId, use, session, { allowExcess: false })
      ;[created] = await Payment.create([{
        dealer: dealerId, bill: billId, amountPaise: use, paymentMethod: 'advance', paymentDate: new Date(),
        notes: 'Advance used automatically (extra paid earlier).', paymentStatus: 'received',
        statusHistory: [{ status: 'received', changedBy: userId }], createdBy: userId,
      }], { session })
    })
  } finally { await session.endSession() }
  return created
}

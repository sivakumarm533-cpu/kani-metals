import Bill from '../models/Bill.js'
import Dealer from '../models/Dealer.js'
import mongoose from 'mongoose'
import Payment from '../models/Payment.js'
import { recordActivity } from '../utils/activity.js'
import { addDealerAdvance, useAdvanceOnBill } from '../utils/advance.js'
import { appliedPaise, formatPaise, paymentCountsAsReceived } from '../utils/money.js'
import { isManagerRole } from '../config/features.js'
import { billItemsPayload, billTotal, objectId, validDate } from '../utils/validation.js'

/**
 * Payments that still count (or may count) towards a bill. Reversed payments and bounced
 * cheques are only history, so they no longer lock the bill against edits or deletion.
 */
const ACTIVE_PAYMENT = { paymentStatus: { $nin: ['reversed', 'bounced'] } }

export async function listBills(req, res, next) {
  try {
    const filter = {}
    if (req.query.dealer) {
      if (!mongoose.isValidObjectId(req.query.dealer)) return res.status(400).json({ message: 'Dealer ID is invalid.' })
      filter.dealer = req.query.dealer
    }
    // Only the dealer's name and contact are needed here; loading its images for every bill made this list very large.
    const bills = await Bill.find(filter).populate('dealer', 'name phone location category').sort({ issuedDate: -1, createdAt: -1 }).lean()
    // `hasPayments`: the bill has payments that still count, so it cannot be edited or deleted.
    const locked = new Set((await Payment.distinct('bill', { bill: { $in: bills.map((bill) => bill._id) }, ...ACTIVE_PAYMENT })).map(String))
    res.json(bills.map((bill) => ({ ...bill, hasPayments: locked.has(String(bill._id)) })))
  }
  catch (error) { next(error) }
}

export async function getBillComparison(req, res, next) {
  try {
    const { dealer: dealerId, previousBill: previousBillId, currentBill: currentBillId } = req.query
    if (![dealerId, previousBillId, currentBillId].every((value) => typeof value === 'string' && mongoose.isValidObjectId(value))) {
      return res.status(400).json({ message: 'Dealer and bill IDs are required and must be valid.' })
    }
    if (previousBillId === currentBillId) return res.status(400).json({ message: 'Choose two different bills to compare.' })
    const [dealer, previousBill, currentBill] = await Promise.all([
      Dealer.findById(dealerId).lean(),
      Bill.findOne({ _id: previousBillId, dealer: dealerId }).lean(),
      Bill.findOne({ _id: currentBillId, dealer: dealerId }).lean(),
    ])
    if (!dealer) return res.status(404).json({ message: 'Dealer not found.' })
    if (!previousBill || !currentBill) return res.status(404).json({ message: 'One or both selected bills do not belong to this dealer.' })
    res.json({ dealer, previousBill, currentBill })
  } catch (error) { next(error) }
}

export async function createBill(req, res, next) {
  try {
    const dealerId = objectId(req.body.dealer, 'dealer')
    const issuedDate = validDate(req.body.issuedDate, 'bill date')
    const items = billItemsPayload(req.body.items)
    const dealer = await Dealer.findById(dealerId).select('active name').lean()
    if (!dealer) return res.status(404).json({ message: 'The selected dealer no longer exists.' })
    if (dealer.active === false) return res.status(409).json({ message: `${dealer.name} is inactive. Edit the dealer and mark them active to create a bill.` })
    const bill = await Bill.create({ dealer: dealerId, issuedDate, items, total: billTotal(items) })
    await recordActivity(req, { action: 'create', entity: 'bill', entityId: bill._id, before: null, after: bill })
    // Extra money the dealer paid earlier is used on this new bill automatically.
    let advanceUsedPaise = 0
    try {
      const advancePayment = await useAdvanceOnBill({ dealerId, billId: bill._id, userId: req.user._id })
      if (advancePayment) {
        advanceUsedPaise = advancePayment.amountPaise
        await recordActivity(req, { action: 'create', entity: 'payment', entityId: advancePayment._id, entityLabel: `Advance ${formatPaise(advanceUsedPaise)} used on new bill`, before: null, after: advancePayment })
      }
    } catch (error) { console.error('Applying dealer advance failed:', error.message) }
    await bill.populate('dealer', 'name phone location category advancePaise')
    res.status(201).json({ ...bill.toObject(), advanceUsedPaise })
  } catch (error) { next(error) }
}

export async function updateBill(req, res, next) {
  try {
    const bill = await Bill.findById(objectId(req.params.id, 'bill ID'))
    if (!bill) return res.status(404).json({ message: 'Bill not found.' })
    if (await Payment.exists({ bill: bill._id, ...ACTIVE_PAYMENT })) return res.status(409).json({ message: 'This bill has payments and cannot be edited. Reverse its payments first (Payments → Reverse), then edit the bill.' })
    const issuedDate = validDate(req.body.issuedDate, 'bill date')
    const items = billItemsPayload(req.body.items)
    const before = bill.toObject()
    bill.set({ issuedDate, items, total: billTotal(items) })
    await bill.save()
    await recordActivity(req, { action: 'update', entity: 'bill', entityId: bill._id, before, after: bill })
    await bill.populate('dealer')
    res.json(bill)
  } catch (error) { next(error) }
}

/** What deleting a bill would remove: its payments and the money they put on the bill. */
async function billPaymentImpact(billId, session = null) {
  const payments = await Payment.find({ bill: billId }).session(session).lean()
  const counting = payments.filter(paymentCountsAsReceived)
  const advanceUsedPaise = counting.filter((payment) => payment.paymentMethod === 'advance').reduce((sum, payment) => sum + appliedPaise(payment), 0)
  const paidPaise = counting.filter((payment) => payment.paymentMethod !== 'advance').reduce((sum, payment) => sum + appliedPaise(payment), 0)
  const activeCount = payments.filter((payment) => !['reversed', 'bounced'].includes(payment.paymentStatus)).length
  return { payments: activeCount, historyCount: payments.length, paidPaise, advanceUsedPaise }
}

export async function getBillDeleteSummary(req, res, next) {
  try {
    const billId = objectId(req.params.id, 'bill ID')
    if (!await Bill.exists({ _id: billId })) return res.status(404).json({ message: 'Bill not found.' })
    const impact = await billPaymentImpact(billId)
    res.json({ ...impact, canDelete: impact.payments === 0 || isManagerRole(req.user?.role) })
  } catch (error) { next(error) }
}

/**
 * Deletes a bill. A bill with payments can be deleted only by an administrator or sub-admin and only
 * when `paidHandling` says what happens to the money already paid on it:
 * 'advance' keeps it for the dealer as advance, 'delete' removes it with the bill.
 * Advance that was used on the bill always goes back to the dealer.
 */
export async function deleteBill(req, res, next) {
  const session = await mongoose.startSession()
  try {
    const billId = objectId(req.params.id, 'bill ID')
    const paidHandling = ['advance', 'delete'].includes(req.body?.paidHandling) ? req.body.paidHandling : ''
    const hasActive = await Payment.exists({ bill: billId, ...ACTIVE_PAYMENT })
    if (hasActive && !isManagerRole(req.user?.role)) return res.status(403).json({ message: 'This bill has payments. Only an administrator or sub-admin can delete it. You can reverse its payments first (Payments → Reverse).' })
    if (hasActive && !paidHandling) return res.status(400).json({ message: 'This bill has payments. Choose whether the money paid is kept as advance or deleted with the bill.' })
    let bill = null
    let impact = null
    let returnedPaise = 0
    await session.withTransaction(async () => {
      bill = await Bill.findById(billId).session(session)
      if (!bill) return
      impact = await billPaymentImpact(billId, session)
      returnedPaise = impact.advanceUsedPaise + (paidHandling === 'advance' ? impact.paidPaise : 0)
      await addDealerAdvance(bill.dealer, returnedPaise, session)
      await Payment.deleteMany({ bill: billId }, { session })
      await Bill.deleteOne({ _id: billId }, { session })
    })
    if (!bill) return res.status(404).json({ message: 'Bill not found.' })
    const label = impact.historyCount ? `Bill ${bill._id} (with ${impact.historyCount} payments)` : undefined
    await recordActivity(req, { action: 'delete', entity: 'bill', entityId: bill._id, entityLabel: label, before: bill, after: null })
    const message = !impact.historyCount ? 'Bill deleted.'
      : returnedPaise > 0 ? `Bill and its payments deleted. ${formatPaise(returnedPaise)} kept as advance for the dealer.`
        : 'Bill and its payments deleted.'
    res.json({ message, ...impact, returnedPaise })
  } catch (error) { next(error) }
  finally { await session.endSession() }
}

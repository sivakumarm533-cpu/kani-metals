import mongoose from 'mongoose'
import Dealer from '../models/Dealer.js'
import Bill from '../models/Bill.js'
import Payment from '../models/Payment.js'
import { recordActivity } from '../utils/activity.js'
import { dealerPayload, objectId } from '../utils/validation.js'
import { isManagerRole } from '../config/features.js'

export async function listDealers(_req, res, next) {
  try {
    res.json(await Dealer.find().sort({ createdAt: -1 }).lean())
  } catch (error) { next(error) }
}

export async function createDealer(req, res, next) {
  try {
    const dealer = await Dealer.create(dealerPayload(req.body))
    await recordActivity(req, { action: 'create', entity: 'dealer', entityId: dealer._id, before: null, after: dealer })
    res.status(201).json(dealer)
  } catch (error) { next(error) }
}

export async function updateDealer(req, res, next) {
  try {
    const dealer = await Dealer.findById(objectId(req.params.id, 'dealer ID'))
    if (!dealer) return res.status(404).json({ message: 'Dealer not found.' })
    const before = dealer.toObject()
    dealer.set(dealerPayload(req.body, { partial: true }))
    await dealer.save()
    await recordActivity(req, { action: 'update', entity: 'dealer', entityId: dealer._id, before, after: dealer })
    res.json(dealer)
  } catch (error) { next(error) }
}

/** How much history deleting this dealer would remove (shown in the confirmation dialog). */
export async function dealerDeleteSummary(req, res, next) {
  try {
    const dealerId = objectId(req.params.id, 'dealer ID')
    const dealer = await Dealer.findById(dealerId).select('name advancePaise').lean()
    if (!dealer) return res.status(404).json({ message: 'Dealer not found.' })
    const [bills, payments] = await Promise.all([Bill.countDocuments({ dealer: dealerId }), Payment.countDocuments({ dealer: dealerId })])
    res.json({ bills, payments, advancePaise: dealer.advancePaise || 0, canDelete: (!bills && !payments) || isManagerRole(req.user?.role) })
  } catch (error) { next(error) }
}

/**
 * Deletes the dealer together with all of their bills and payment history.
 * Removing money records is limited to administrators and sub-admins.
 */
export async function deleteDealer(req, res, next) {
  const session = await mongoose.startSession()
  try {
    const dealerId = objectId(req.params.id, 'dealer ID')
    const hasHistory = await Bill.exists({ dealer: dealerId }) || await Payment.exists({ dealer: dealerId })
    if (hasHistory && !isManagerRole(req.user?.role)) {
      return res.status(403).json({ message: 'This dealer has bills or payments. Only an administrator or sub-admin can delete a dealer with history.' })
    }
    let dealer = null
    let removed = { bills: 0, payments: 0 }
    await session.withTransaction(async () => {
      dealer = await Dealer.findById(dealerId).session(session)
      if (!dealer) return
      const payments = await Payment.deleteMany({ dealer: dealerId }, { session })
      const bills = await Bill.deleteMany({ dealer: dealerId }, { session })
      await Dealer.deleteOne({ _id: dealerId }, { session })
      removed = { bills: bills.deletedCount, payments: payments.deletedCount }
    })
    if (!dealer) return res.status(404).json({ message: 'Dealer not found.' })
    const label = removed.bills || removed.payments ? `${dealer.name} (with ${removed.bills} bills and ${removed.payments} payments)` : dealer.name
    await recordActivity(req, { action: 'delete', entity: 'dealer', entityId: dealer._id, entityLabel: label, before: dealer, after: null })
    res.json({ message: removed.bills || removed.payments ? `Dealer deleted with ${removed.bills} bills and ${removed.payments} payments.` : 'Dealer deleted.', ...removed })
  } catch (error) { next(error) }
  finally { await session.endSession() }
}

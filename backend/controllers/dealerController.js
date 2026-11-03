import Dealer from '../models/Dealer.js'
import Bill from '../models/Bill.js'
import Payment from '../models/Payment.js'
import { recordActivity } from '../utils/activity.js'
import { dealerPayload, objectId } from '../utils/validation.js'

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

export async function deleteDealer(req, res, next) {
  try {
    const dealerId = objectId(req.params.id, 'dealer ID')
    if (await Bill.exists({ dealer: dealerId }) || await Payment.exists({ dealer: dealerId })) {
      return res.status(409).json({ message: 'This dealer has bill or payment history and cannot be deleted.' })
    }
    const dealer = await Dealer.findByIdAndDelete(dealerId)
    if (!dealer) return res.status(404).json({ message: 'Dealer not found.' })
    await recordActivity(req, { action: 'delete', entity: 'dealer', entityId: dealer._id, before: dealer, after: null })
    res.json({ message: 'Dealer deleted.' })
  } catch (error) { next(error) }
}

import Bill from '../models/Bill.js'
import Dealer from '../models/Dealer.js'
import mongoose from 'mongoose'
import Payment from '../models/Payment.js'
import { recordActivity } from '../utils/activity.js'
import { billItemsPayload, billTotal, objectId, validDate } from '../utils/validation.js'

export async function listBills(req, res, next) {
  try {
    const filter = {}
    if (req.query.dealer) {
      if (!mongoose.isValidObjectId(req.query.dealer)) return res.status(400).json({ message: 'Dealer ID is invalid.' })
      filter.dealer = req.query.dealer
    }
    res.json(await Bill.find(filter).populate('dealer').sort({ issuedDate: -1, createdAt: -1 }).lean())
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
    if (!await Dealer.exists({ _id: dealerId })) return res.status(404).json({ message: 'The selected dealer no longer exists.' })
    const bill = await Bill.create({ dealer: dealerId, issuedDate, items, total: billTotal(items) })
    await recordActivity(req, { action: 'create', entity: 'bill', entityId: bill._id, before: null, after: bill })
    res.status(201).json(await bill.populate('dealer'))
  } catch (error) { next(error) }
}

export async function updateBill(req, res, next) {
  try {
    const bill = await Bill.findById(objectId(req.params.id, 'bill ID'))
    if (!bill) return res.status(404).json({ message: 'Bill not found.' })
    if (await Payment.exists({ bill: bill._id })) return res.status(409).json({ message: 'This bill has payment history and cannot be edited. Record a payment correction instead.' })
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

export async function deleteBill(req, res, next) {
  try {
    const billId = objectId(req.params.id, 'bill ID')
    if (await Payment.exists({ bill: billId })) return res.status(409).json({ message: 'This bill has payment history and cannot be deleted.' })
    const bill = await Bill.findByIdAndDelete(billId)
    if (!bill) return res.status(404).json({ message: 'Bill not found.' })
    await recordActivity(req, { action: 'delete', entity: 'bill', entityId: bill._id, before: bill, after: null })
    res.json({ message: 'Bill deleted.' })
  } catch (error) { next(error) }
}

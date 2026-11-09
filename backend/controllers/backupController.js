import Dealer from '../models/Dealer.js'
import Product from '../models/Product.js'
import Bill from '../models/Bill.js'
import Payment from '../models/Payment.js'
import { appliedPaise, paymentCountsAsReceived } from '../utils/money.js'
import { recordActivity } from '../utils/activity.js'

const models = { dealers: Dealer, products: Product, bills: Bill, payments: Payment }
const backupFormat = 'kani-metals-backup'

export async function exportBackup(_req, res, next) {
  try {
    const [dealers, products, bills, payments] = await Promise.all([
      Dealer.find().lean(), Product.find().lean(), Bill.find().lean(), Payment.find().lean(),
    ])
    res.setHeader('Content-Disposition', `attachment; filename=kani-metals-backup-${new Date().toISOString().slice(0, 10)}.json`)
    res.json({ format: backupFormat, version: 1, exportedAt: new Date().toISOString(), data: { dealers, products, bills, payments } })
  } catch (error) { next(error) }
}

export async function importBackup(req, res, next) {
  try {
    const backup = req.body
    if (backup?.format !== backupFormat || backup?.version !== 1 || !backup?.data || ['dealers', 'products', 'bills'].some((key) => !Array.isArray(backup.data[key])) || (backup.data.payments !== undefined && !Array.isArray(backup.data.payments))) {
      return res.status(400).json({ message: 'This is not a valid Kani Metals backup file.' })
    }
    const backupData = { ...backup.data, payments: backup.data.payments || [] }
    if (!Array.isArray(backup.data.payments) && await Payment.exists({})) return res.status(409).json({ message: 'This older backup has no payment history. Export a current backup before restoring it so payment records are not lost.' })
    for (const [collection, Model] of Object.entries(models)) {
      if (backupData[collection].length > 50000) return res.status(413).json({ message: 'Backup contains too many records.' })
      await Promise.all(backupData[collection].map((record) => new Model(record).validate()))
    }

    const dealersById = new Map(backupData.dealers.map((record) => [String(record._id), record]))
    const billsById = new Map(backupData.bills.map((record) => [String(record._id), record]))
    const receivedByBill = new Map()
    const advanceByDealer = new Map()
    for (const payment of backupData.payments) {
      const bill = billsById.get(String(payment.bill))
      if (!bill || String(bill.dealer) !== String(payment.dealer) || !dealersById.has(String(payment.dealer))) return res.status(400).json({ message: 'Backup contains a payment that does not match its dealer and bill.' })
      if (!paymentCountsAsReceived(payment)) continue
      receivedByBill.set(String(payment.bill), (receivedByBill.get(String(payment.bill)) || 0) + appliedPaise(payment))
      const dealerKey = String(payment.dealer)
      const advanceChange = (payment.excessType === 'roundoff' ? 0 : payment.excessPaise || 0) - (payment.paymentMethod === 'advance' ? payment.amountPaise : 0)
      advanceByDealer.set(dealerKey, (advanceByDealer.get(dealerKey) || 0) + advanceChange)
    }
    for (const bill of backupData.bills) bill.receivedPaise = receivedByBill.get(String(bill._id)) || 0
    for (const dealer of backupData.dealers) dealer.advancePaise = Math.max(0, advanceByDealer.get(String(dealer._id)) || 0)

    const previous = {}
    for (const key of Object.keys(models)) previous[key] = await models[key].find().lean()
    try {
      for (const key of Object.keys(models)) {
        await models[key].deleteMany({})
        if (backupData[key].length) await models[key].insertMany(backupData[key], { ordered: true })
      }
    } catch (error) {
      for (const key of Object.keys(models)) {
        await models[key].deleteMany({})
        if (previous[key].length) await models[key].insertMany(previous[key], { ordered: true })
      }
      throw error
    }
    const counts = Object.fromEntries(Object.entries(backupData).map(([key, records]) => [key, records.length]))
    await recordActivity(req, {
      action: 'update', entity: 'backup', entityLabel: 'Database backup restore',
      before: Object.fromEntries(Object.entries(previous).map(([key, records]) => [key, records.length])),
      after: counts,
    })
    res.json({ message: 'Backup imported successfully.', counts })
  } catch (error) { next(error) }
}

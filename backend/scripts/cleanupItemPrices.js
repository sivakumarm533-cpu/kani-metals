/*
 * Finds item price records left behind after their bills (or dealers) were deleted.
 * They are hidden on the Item prices screen but used to block adding an item with the
 * same name ("already in the price list").
 *
 *   npm run item-prices:cleanup            -> report only, changes nothing
 *   npm run item-prices:cleanup -- --apply -> delete the leftover records
 *
 * Take a database backup (Settings → Database backup) before using --apply.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import ItemPrice from '../models/ItemPrice.js'
import Bill from '../models/Bill.js'
import { isListed } from '../controllers/itemPriceController.js'

const apply = process.argv.includes('--apply')

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
try {
  const billKeys = new Set((await Bill.aggregate([
    { $unwind: '$items' },
    { $match: { 'items.name': { $type: 'string', $ne: '' } } },
    { $group: { _id: { $concat: [{ $toLower: { $trim: { input: '$items.name' } } }, '|', { $toLower: { $trim: { input: { $ifNull: ['$items.unit', ''] } } } }] } } },
  ])).map((group) => group._id))
  const docs = await ItemPrice.find().select('key name unit pricePaise addedManually updatedAt').lean()
  const leftovers = docs.filter((doc) => !billKeys.has(doc.key) && !isListed(doc))

  console.log(`${docs.length} item price records, ${billKeys.size} items on bills.`)
  if (!leftovers.length) console.log('No leftover records found.')
  for (const doc of leftovers) {
    const price = Number.isFinite(doc.pricePaise) ? `₹${(doc.pricePaise / 100).toFixed(2)}` : 'no manual price'
    console.log(`  - ${doc.name} (${doc.unit || 'no unit'}): ${price}, ${doc.addedManually ? 'added on Item prices' : 'from a deleted bill'}, last changed ${new Date(doc.updatedAt).toISOString().slice(0, 10)}`)
  }
  if (leftovers.length && apply) {
    const result = await ItemPrice.deleteMany({ _id: { $in: leftovers.map((doc) => doc._id) } })
    console.log(`Deleted ${result.deletedCount} leftover records.`)
  } else if (leftovers.length) {
    console.log('Nothing was changed. Run again with --apply to delete these.')
  }
} finally {
  await mongoose.disconnect()
}

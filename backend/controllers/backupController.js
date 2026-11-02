import Dealer from '../models/Dealer.js'
import Product from '../models/Product.js'
import Bill from '../models/Bill.js'

const models = { dealers: Dealer, products: Product, bills: Bill }
const backupFormat = 'kani-metals-backup'

export async function exportBackup(_req, res, next) {
  try {
    const [dealers, products, bills] = await Promise.all([
      Dealer.find().lean(), Product.find().lean(), Bill.find().lean(),
    ])
    res.setHeader('Content-Disposition', `attachment; filename=kani-metals-backup-${new Date().toISOString().slice(0, 10)}.json`)
    res.json({ format: backupFormat, version: 1, exportedAt: new Date().toISOString(), data: { dealers, products, bills } })
  } catch (error) { next(error) }
}

export async function importBackup(req, res, next) {
  try {
    const backup = req.body
    if (backup?.format !== backupFormat || backup?.version !== 1 || !backup?.data || Object.keys(models).some((key) => !Array.isArray(backup.data[key]))) {
      return res.status(400).json({ message: 'This is not a valid Kani Metals backup file.' })
    }
    for (const [collection, Model] of Object.entries(models)) {
      if (backup.data[collection].length > 50000) return res.status(413).json({ message: 'Backup contains too many records.' })
      await Promise.all(backup.data[collection].map((record) => new Model(record).validate()))
    }

    const previous = {}
    for (const key of Object.keys(models)) previous[key] = await models[key].find().lean()
    try {
      for (const key of Object.keys(models)) {
        await models[key].deleteMany({})
        if (backup.data[key].length) await models[key].insertMany(backup.data[key], { ordered: true })
      }
    } catch (error) {
      for (const key of Object.keys(models)) {
        await models[key].deleteMany({})
        if (previous[key].length) await models[key].insertMany(previous[key], { ordered: true })
      }
      throw error
    }
    res.json({ message: 'Backup imported successfully.', counts: Object.fromEntries(Object.entries(backup.data).map(([key, records]) => [key, records.length])) })
  } catch (error) { next(error) }
}

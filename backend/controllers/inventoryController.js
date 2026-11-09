import Product from '../models/Product.js'
import { recordActivity } from '../utils/activity.js'
import { objectId, productPayload } from '../utils/validation.js'

/*
 * Inventory: items added here are offered when creating a bill. Stock changes
 * only by hand on the Inventory page; saving a bill never changes stock.
 */

const MAX_STOCK = 1e9
const round = (value) => Math.round(value * 1000) / 1000

function badRequest(message, statusCode = 400) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const sameText = (text) => ({ $regex: `^\\s*${escapeRegex(text.trim())}\\s*$`, $options: 'i' })

/** Adds an inventory item with its opening stock. */
export async function createInventoryItem(req, res, next) {
  try {
    const data = productPayload({ ...req.body, quantity: req.body?.quantity || 0, price: req.body?.price || 0 })
    if (data.quantity > MAX_STOCK) throw badRequest('That stock quantity is too large.')
    data.quantity = round(data.quantity)
    if (await Product.exists({ name: sameText(data.name), unit: sameText(data.unit) })) {
      throw badRequest(`${data.name} (${data.unit}) is already in inventory. Update its stock instead.`, 409)
    }
    const now = new Date()
    const product = await Product.create({
      ...data,
      stockUpdatedAt: now,
      stockUpdatedByName: req.user.name,
      stockHistory: [{ mode: 'opening', amount: data.quantity, before: 0, after: data.quantity, note: 'Opening stock', changedBy: req.user._id, changedByName: req.user.name, changedAt: now }],
    })
    await recordActivity(req, { action: 'create', entity: 'product', entityId: product._id, before: null, after: data })
    const plain = product.toObject()
    delete plain.stockHistory
    res.status(201).json({ message: `${product.name} added to inventory.`, product: plain })
  } catch (error) { next(error) }
}

/**
 * Changes only the stock quantity of the selected items.
 * Body: { changes: [{ id, mode: 'set' | 'add' | 'remove', amount }], note }
 * Every change is checked before anything is saved.
 */
export async function updateStock(req, res, next) {
  try {
    const { changes, note: rawNote } = req.body || {}
    if (!Array.isArray(changes) || !changes.length) throw badRequest('Select at least one item.')
    if (changes.length > 200) throw badRequest('Update at most 200 items at a time.')
    const note = String(rawNote || '').trim().slice(0, 200)
    const parsed = changes.map((change, index) => {
      const id = objectId(change?.id, `item ${index + 1}`)
      const mode = change?.mode
      if (!['set', 'add', 'remove'].includes(mode)) throw badRequest(`Choose set, add or remove for item ${index + 1}.`)
      const amount = typeof change?.amount === 'string' && change.amount.trim() === '' ? NaN : Number(change?.amount)
      if (!Number.isFinite(amount) || amount < 0 || amount > MAX_STOCK) throw badRequest(`Enter a valid quantity for item ${index + 1}.`)
      if (mode !== 'set' && amount === 0) throw badRequest(`Enter a quantity above 0 for item ${index + 1}.`)
      return { id, mode, amount: round(amount) }
    })
    if (new Set(parsed.map((change) => change.id)).size !== parsed.length) throw badRequest('Each item can be changed once per update.')

    const products = await Product.find({ _id: { $in: parsed.map((change) => change.id) } }).select('name unit quantity').lean()
    const byId = new Map(products.map((product) => [String(product._id), product]))
    const plan = parsed.map((change) => {
      const product = byId.get(change.id)
      if (!product) throw badRequest('One of the selected items no longer exists. Refresh the page.', 404)
      const before = product.quantity
      const after = round(change.mode === 'set' ? change.amount : change.mode === 'add' ? before + change.amount : before - change.amount)
      if (after < 0) throw badRequest(`Cannot remove ${change.amount} ${product.unit} of ${product.name}: only ${before} ${product.unit} in stock.`)
      if (after > MAX_STOCK) throw badRequest(`The stock of ${product.name} would be too large.`)
      return { ...change, product, before, after }
    })

    const now = new Date()
    const updated = []
    for (const step of plan) {
      // Only if the stock is still what was read, so two people cannot overwrite each other.
      const saved = await Product.findOneAndUpdate(
        { _id: step.id, quantity: step.before },
        {
          $set: { quantity: step.after, stockUpdatedAt: now, stockUpdatedByName: req.user.name },
          $push: { stockHistory: { $each: [{ mode: step.mode, amount: step.amount, before: step.before, after: step.after, note, changedBy: req.user._id, changedByName: req.user.name, changedAt: now }], $slice: -30 } },
        },
        { returnDocument: 'after', projection: { stockHistory: 0 } },
      ).lean()
      if (!saved) {
        const saving = updated.length ? ` ${updated.length} item(s) before it were saved.` : ''
        throw badRequest(`The stock of ${step.product.name} was changed by someone else just now. Refresh and try again.${saving}`, 409)
      }
      updated.push(saved)
      await recordActivity(req, { action: 'update', entity: 'product', entityId: saved._id, entityLabel: `${saved.name} stock`, before: { quantity: step.before }, after: { quantity: step.after } })
    }
    res.json({ message: updated.length === 1 ? `Stock updated for ${updated[0].name}.` : `Stock updated for ${updated.length} items.`, products: updated })
  } catch (error) { next(error) }
}

/** Recent manual stock changes of one item, newest first. */
export async function stockHistory(req, res, next) {
  try {
    const product = await Product.findById(objectId(req.params.id, 'item')).select('name unit stockHistory').lean()
    if (!product) return res.status(404).json({ message: 'Item not found.' })
    res.json({ name: product.name, unit: product.unit, history: (product.stockHistory || []).slice().reverse() })
  } catch (error) { next(error) }
}

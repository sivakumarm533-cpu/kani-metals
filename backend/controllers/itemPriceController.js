import Bill from '../models/Bill.js'
import Dealer from '../models/Dealer.js'
import ItemPrice from '../models/ItemPrice.js'
import { recordActivity } from '../utils/activity.js'
import { rupeesToPaise } from '../utils/money.js'
import { optionalImage } from '../utils/validation.js'

/*
 * Item prices: one row per item (bill line name + unit), priced from the most
 * recent dealer bill. Items can also be added here by hand, and any item can get
 * a manual price or an uploaded photo. None of this changes bills, products or
 * the dashboard.
 */

const toPaise = (rupees) => rupeesToPaise(String(rupees ?? 0)) ?? 0
const normName = { $toLower: { $trim: { input: '$items.name' } } }
const normUnit = { $toLower: { $trim: { input: { $ifNull: ['$items.unit', ''] } } } }
const newestFirst = { issuedDate: -1, createdAt: -1 }
const MAX_PRICE_PAISE = 100_000_000_00

function badRequest(message, statusCode = 400) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

const keyOf = (name, unit) => `${String(name).trim().toLowerCase()}|${String(unit || '').trim().toLowerCase()}`

/** "name|unit", lower-cased and trimmed, the same way the bill lines are grouped. */
function parseKey(value) {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : ''
  const split = key.lastIndexOf('|')
  if (!key || key.length > 300 || split <= 0) throw badRequest('Choose a valid item.')
  return { key, name: key.slice(0, split), unit: key.slice(split + 1) }
}

function parsePrice(value) {
  const pricePaise = rupeesToPaise(typeof value === 'number' ? String(value) : value)
  if (pricePaise === null || pricePaise <= 0) throw badRequest('Enter a price above ₹0.')
  if (pricePaise > MAX_PRICE_PAISE) throw badRequest('That price is too large.')
  return pricePaise
}

/** Bill lines without their (large) images, one document per line. */
const linesStages = [
  { $project: { dealer: 1, issuedDate: 1, createdAt: 1, items: { $map: { input: '$items', in: { name: '$$this.name', category: '$$this.category', unit: '$$this.unit', price: '$$this.price', quantity: '$$this.quantity', hasImage: { $gt: [{ $strLenCP: { $ifNull: ['$$this.image', ''] } }, 0] } } } } } },
  { $unwind: '$items' },
  { $match: { 'items.name': { $type: 'string', $ne: '' } } },
]
const matchItem = ({ name, unit }) => ({ $match: { $expr: { $and: [{ $eq: [normName, name] }, { $eq: [normUnit, unit] }] } } })

/** The newest bill line of the item (or null) and its ItemPrice document (or null). */
async function findItem(item) {
  const [[line], doc] = await Promise.all([
    Bill.aggregate([...linesStages, matchItem(item), { $sort: newestFirst }, { $limit: 1 }, { $project: { name: '$items.name', unit: '$items.unit', category: '$items.category' } }]),
    ItemPrice.findOne({ key: item.key }).lean(),
  ])
  return { line: line || null, doc }
}

function trendOf(currentPaise, referencePaise) {
  if (referencePaise === null || referencePaise === undefined) return { changePaise: null, changePercent: null, trend: 'new' }
  const changePaise = currentPaise - referencePaise
  return {
    changePaise,
    changePercent: referencePaise ? Math.round((changePaise / referencePaise) * 1000) / 10 : null,
    trend: changePaise > 0 ? 'up' : changePaise < 0 ? 'down' : 'same',
  }
}

const publicManual = (doc) => (doc && Number.isFinite(doc.pricePaise)
  ? { pricePaise: doc.pricePaise, note: doc.note || '', updatedAt: doc.updatedAt, updatedByName: doc.updatedByName || '' }
  : null)

/**
 * Combines bill figures with an optional manual price into what the screen shows.
 * `latest` is null for an item added by hand that is not on any bill yet.
 */
function priceRow({ key, latest, previous, doc }) {
  const billPaise = latest ? toPaise(latest.price) : null
  const previousBillPaise = previous ? toPaise(previous.price) : null
  const manual = publicManual(doc)
  const currentPaise = manual ? manual.pricePaise : billPaise
  // A manual price is compared with the latest bill; a bill price with the bill before it.
  const reference = manual ? billPaise : previousBillPaise
  return {
    key,
    name: latest ? latest.name.trim() : doc.name,
    category: latest?.category || doc?.category || '',
    unit: latest ? latest.unit || '' : doc.unit || '',
    currentPaise,
    source: manual ? 'manual' : 'bill',
    manual,
    addedManually: Boolean(doc?.addedManually),
    hasBill: Boolean(latest),
    billPaise,
    billDate: latest?.issuedDate || null,
    previousBillPaise,
    previousBillDate: previous?.issuedDate || null,
    compareWith: manual ? 'latest bill' : 'previous bill',
    // Last time the price changed in any way (used for "recently updated" order).
    updatedAt: [latest?.issuedDate, manual?.updatedAt].filter(Boolean).map((date) => new Date(date)).sort((a, b) => b - a)[0] || null,
    // A bill dated after the manual price was set: the user may want to go back to bill prices.
    newerBill: Boolean(manual && latest && new Date(latest.createdAt || latest.issuedDate) > new Date(manual.updatedAt)),
    ...trendOf(currentPaise, reference),
  }
}

export async function listItemPrices(_req, res, next) {
  try {
    const [groups, docs] = await Promise.all([
      Bill.aggregate([
        ...linesStages,
        {
          $group: {
            _id: { name: normName, unit: normUnit },
            recent: { $topN: { n: 12, sortBy: newestFirst, output: { name: '$items.name', category: '$items.category', unit: '$items.unit', price: '$items.price', issuedDate: '$issuedDate', createdAt: '$createdAt', bill: '$_id', dealer: '$dealer' } } },
            bills: { $addToSet: '$_id' },
            dealers: { $addToSet: '$dealer' },
            minPrice: { $min: '$items.price' },
            maxPrice: { $max: '$items.price' },
            avgPrice: { $avg: '$items.price' },
            totalQuantity: { $sum: '$items.quantity' },
            hasImage: { $max: '$items.hasImage' },
            firstDate: { $min: '$issuedDate' },
          },
        },
        { $project: { recent: 1, minPrice: 1, maxPrice: 1, avgPrice: 1, totalQuantity: 1, hasImage: 1, firstDate: 1, billCount: { $size: '$bills' }, dealerCount: { $size: '$dealers' } } },
      ]),
      // Without the photo itself: only whether there is one.
      ItemPrice.aggregate([{ $project: { key: 1, name: 1, unit: 1, category: 1, pricePaise: 1, note: 1, updatedAt: 1, updatedByName: 1, addedManually: 1, createdAt: 1, hasPhoto: { $gt: [{ $strLenCP: { $ifNull: ['$image', ''] } }, 0] } } }]),
    ])
    const docByKey = new Map(docs.map((doc) => [doc.key, doc]))
    const dealerIds = [...new Set(groups.map((group) => String(group.recent[0].dealer)))]
    const dealers = await Dealer.find({ _id: { $in: dealerIds } }).select('name').lean()
    const dealerName = new Map(dealers.map((dealer) => [String(dealer._id), dealer.name]))

    const billKeys = new Set()
    const items = groups.map((group) => {
      const key = `${group._id.name}|${group._id.unit}`
      billKeys.add(key)
      const [latest, ...older] = group.recent
      const previous = older.find((rate) => String(rate.bill) !== String(latest.bill)) || null
      const doc = docByKey.get(key)
      return {
        ...priceRow({ key, latest, previous, doc }),
        billDealer: dealerName.get(String(latest.dealer)) || '',
        minPaise: toPaise(group.minPrice),
        maxPaise: toPaise(group.maxPrice),
        avgPaise: Math.round(Number(group.avgPrice || 0) * 100),
        billCount: group.billCount,
        dealerCount: group.dealerCount,
        totalQuantity: Math.round(Number(group.totalQuantity || 0) * 1000) / 1000,
        hasImage: Boolean(group.hasImage || doc?.hasPhoto),
        imageSource: doc?.hasPhoto ? 'manual' : group.hasImage ? 'bill' : 'none',
        firstDate: group.firstDate,
        // Oldest to newest, for the small trend line on each card.
        spark: group.recent.slice().reverse().map((rate) => toPaise(rate.price)),
      }
    })
    // Items added here that are not on any bill yet.
    for (const doc of docs) {
      if (!doc.addedManually || billKeys.has(doc.key) || !Number.isFinite(doc.pricePaise)) continue
      items.push({
        ...priceRow({ key: doc.key, latest: null, previous: null, doc }),
        billDealer: '',
        minPaise: doc.pricePaise,
        maxPaise: doc.pricePaise,
        avgPaise: doc.pricePaise,
        billCount: 0,
        dealerCount: 0,
        totalQuantity: 0,
        hasImage: Boolean(doc.hasPhoto),
        imageSource: doc.hasPhoto ? 'manual' : 'none',
        firstDate: doc.createdAt,
        spark: [],
      })
    }
    items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt) || a.name.localeCompare(b.name))

    res.json({ items, categories: [...new Set(items.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)) })
  } catch (error) { next(error) }
}

async function latestBillImage(item) {
  const [found] = await Bill.aggregate([
    // $elemMatch: a bill qualifies when any of its lines has a photo ($ne on the array would need all of them).
    { $match: { items: { $elemMatch: { image: { $type: 'string', $gt: '' } } } } },
    { $sort: newestFirst },
    { $unwind: '$items' },
    matchItem(item),
    { $match: { 'items.image': { $type: 'string', $ne: '' } } },
    { $limit: 1 },
    { $project: { _id: 0, image: '$items.image' } },
  ])
  return found?.image || ''
}

/** The uploaded photo, otherwise the latest bill photo (loaded separately so the list stays light). */
export async function getItemImage(req, res, next) {
  try {
    const item = parseKey(req.query.key)
    const doc = await ItemPrice.findOne({ key: item.key }).select('image').lean()
    res.set('Cache-Control', 'private, no-cache')
    res.json({ image: doc?.image || await latestBillImage(item) })
  } catch (error) { next(error) }
}

/** Everything about one item: every bill line, dealers, manual price and its history. */
export async function getItemPriceDetail(req, res, next) {
  try {
    const item = parseKey(req.query.key)
    const [lines, doc, billImage] = await Promise.all([
      Bill.aggregate([
        ...linesStages,
        matchItem(item),
        { $sort: newestFirst },
        { $project: { _id: 0, bill: '$_id', dealer: 1, issuedDate: 1, createdAt: 1, name: '$items.name', category: '$items.category', unit: '$items.unit', price: '$items.price', quantity: '$items.quantity' } },
      ]),
      ItemPrice.findOne({ key: item.key }).lean(),
      latestBillImage(item),
    ])
    const manualOnly = !lines.length && doc?.addedManually && Number.isFinite(doc.pricePaise)
    if (!lines.length && !manualOnly) return res.status(404).json({ message: 'This item is not in the price list.' })

    const dealers = await Dealer.find({ _id: { $in: [...new Set(lines.map((line) => String(line.dealer)))] } }).select('name phone location profileImage').lean()
    const dealerById = new Map(dealers.map((dealer) => [String(dealer._id), dealer]))
    const [latest = null, ...older] = lines
    const previous = latest ? older.find((line) => String(line.bill) !== String(latest.bill)) || null : null
    const prices = lines.length ? lines.map((line) => toPaise(line.price)) : [doc.pricePaise]

    // Per dealer: what they charged last and how much was bought from them.
    const byDealer = new Map()
    for (const line of lines) {
      const id = String(line.dealer)
      const row = byDealer.get(id) || { dealer: dealerById.get(id) || { _id: id, name: 'Deleted dealer' }, lastPaise: toPaise(line.price), lastDate: line.issuedDate, quantity: 0, lines: 0 }
      row.quantity += Number(line.quantity) || 0
      row.lines += 1
      byDealer.set(id, row)
    }

    res.json({
      item: {
        ...priceRow({ key: item.key, latest, previous, doc }),
        billDealer: latest ? dealerById.get(String(latest.dealer))?.name || '' : '',
        image: doc?.image || billImage,
        imageSource: doc?.image ? 'manual' : billImage ? 'bill' : 'none',
        billImageAvailable: Boolean(billImage),
      },
      stats: {
        minPaise: Math.min(...prices),
        maxPaise: Math.max(...prices),
        avgPaise: Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length),
        billCount: new Set(lines.map((line) => String(line.bill))).size,
        dealerCount: byDealer.size,
        totalQuantity: Math.round(lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0) * 1000) / 1000,
        firstDate: lines.length ? lines[lines.length - 1].issuedDate : doc.createdAt,
      },
      // Newest first. The chart reverses it.
      history: lines.slice(0, 300).map((line) => ({
        bill: line.bill,
        date: line.issuedDate,
        pricePaise: toPaise(line.price),
        quantity: line.quantity,
        dealer: dealerById.get(String(line.dealer))?.name || 'Deleted dealer',
        dealerId: line.dealer,
      })),
      dealers: [...byDealer.values()].sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate)),
      manualHistory: (doc?.history || []).slice().reverse(),
    })
  } catch (error) { next(error) }
}

/** Adds an item that is not on any bill yet, with its price and an optional photo. */
export async function createItem(req, res, next) {
  try {
    const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ')
    const unit = String(req.body?.unit || '').trim()
    const category = String(req.body?.category || '').trim().slice(0, 80)
    if (!name || name.length > 120) throw badRequest('Enter an item name (up to 120 characters).')
    if (!unit || unit.length > 20 || unit.includes('|')) throw badRequest('Enter a unit such as kg or piece.')
    if (name.includes('|')) throw badRequest('The item name cannot contain "|".')
    const pricePaise = parsePrice(req.body?.price)
    const note = String(req.body?.note || '').trim().slice(0, 200)
    const image = optionalImage(req.body?.image, 'item photo')
    const item = parseKey(keyOf(name, unit))
    const { line, doc } = await findItem(item)
    if (line || doc) throw badRequest(`${line?.name?.trim() || doc.name} (${unit}) is already in the price list. Open it to change the price or photo.`, 409)

    const change = { action: 'set', pricePaise, note, changedBy: req.user._id, changedByName: req.user.name, changedAt: new Date() }
    const created = await ItemPrice.create({ key: item.key, name, unit, category, pricePaise, note, image, addedManually: true, updatedBy: req.user._id, updatedByName: req.user.name, history: [change] })
    await recordActivity(req, { action: 'create', entity: 'itemPrice', entityId: created._id, entityLabel: `${name} price`, before: null, after: { name, unit, category, pricePaise, note, image } })
    res.status(201).json({ message: `${name} added to item prices.`, key: item.key })
  } catch (error) { next(error) }
}

/** Removes an item added here. Items that are on bills cannot be removed. */
export async function deleteItem(req, res, next) {
  try {
    const item = parseKey(req.query.key)
    const { line, doc } = await findItem(item)
    if (line) throw badRequest('This item is on dealer bills, so it stays in the list. You can remove its manual price or photo instead.')
    if (!doc) throw badRequest('This item is not in the price list.', 404)
    await ItemPrice.deleteOne({ _id: doc._id })
    await recordActivity(req, { action: 'delete', entity: 'itemPrice', entityId: doc._id, entityLabel: `${doc.name} price`, before: { name: doc.name, unit: doc.unit, category: doc.category, pricePaise: doc.pricePaise }, after: null })
    res.json({ message: `${doc.name} removed from item prices.` })
  } catch (error) { next(error) }
}

/** Sets the item's own photo, or (empty image) goes back to the bill photo. */
export async function setItemImage(req, res, next) {
  try {
    const item = parseKey(req.body?.key)
    const image = optionalImage(req.body?.image, 'item photo')
    const { line, doc } = await findItem(item)
    if (!line && !doc) throw badRequest('This item is not in the price list.', 404)
    if (!image && !doc?.image) return res.json({ message: 'This item already uses the bill photo.' })
    const name = line ? line.name.trim() : doc.name
    await ItemPrice.updateOne(
      { key: item.key },
      { $set: { image }, $setOnInsert: { name, unit: line?.unit || '', category: line?.category || '' } },
      { upsert: true },
    )
    await recordActivity(req, { action: 'update', entity: 'itemPrice', entityId: doc?._id || item.key, entityLabel: `${name} photo`, before: { image: doc?.image || '' }, after: { image } })
    res.json({ message: image ? `New photo saved for ${name}.` : `${name} now shows the bill photo again.` })
  } catch (error) { next(error) }
}

export async function setManualPrice(req, res, next) {
  try {
    const item = parseKey(req.body?.key)
    const pricePaise = parsePrice(req.body?.price)
    const note = String(req.body?.note || '').trim().slice(0, 200)
    const { line, doc: before } = await findItem(item)
    if (!line && !before) throw badRequest('This item is not in the price list.', 404)

    const change = { action: 'set', pricePaise, note, changedBy: req.user._id, changedByName: req.user.name, changedAt: new Date() }
    const saved = await ItemPrice.findOneAndUpdate(
      { key: item.key },
      {
        $set: { pricePaise, note, updatedBy: req.user._id, updatedByName: req.user.name },
        $setOnInsert: { name: line?.name?.trim() || before?.name, unit: line?.unit || '', category: line?.category || '' },
        $push: { history: { $each: [change], $slice: -50 } },
      },
      { upsert: true, returnDocument: 'after', runValidators: true },
    ).lean()
    await recordActivity(req, { action: before ? 'update' : 'create', entity: 'itemPrice', entityId: saved._id, entityLabel: `${saved.name} price`, before: before && { pricePaise: before.pricePaise, note: before.note }, after: { pricePaise, note } })
    res.json({ message: `Manual price saved for ${saved.name}. Bills are not changed.`, manual: publicManual(saved) })
  } catch (error) { next(error) }
}

export async function clearManualPrice(req, res, next) {
  try {
    const item = parseKey(req.query.key)
    const { line, doc: before } = await findItem(item)
    if (!before || !Number.isFinite(before.pricePaise)) return res.json({ message: 'This item already uses the bill price.' })
    if (!line) throw badRequest('This item is not on any bill yet, so it needs a manual price. Delete the item instead.')
    const change = { action: 'clear', pricePaise: null, note: '', changedBy: req.user._id, changedByName: req.user.name, changedAt: new Date() }
    await ItemPrice.updateOne({ _id: before._id }, { $set: { pricePaise: null, note: '', updatedBy: req.user._id, updatedByName: req.user.name }, $push: { history: { $each: [change], $slice: -50 } } })
    await recordActivity(req, { action: 'update', entity: 'itemPrice', entityId: before._id, entityLabel: `${before.name} price`, before: { pricePaise: before.pricePaise, note: before.note }, after: { pricePaise: null, note: '' } })
    res.json({ message: `${before.name} now uses the latest bill price again.` })
  } catch (error) { next(error) }
}

import ActivityLog from '../models/ActivityLog.js'
import mongoose from 'mongoose'
import { recordActivity } from '../utils/activity.js'

const actions = new Set(['create', 'update', 'delete'])
const entities = new Set(['dealer', 'product', 'bill', 'payment', 'user', 'backup', 'settings', 'itemPrice'])

export async function listActivity(req, res, next) {
  try {
    const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1))
    const limit = Math.max(10, Math.min(100, Number.parseInt(req.query.limit, 10) || 50))
    const filter = {}
    if (actions.has(req.query.action)) filter.action = req.query.action
    if (entities.has(req.query.entity)) filter.entity = req.query.entity
    if (req.query.actor && mongoose.isValidObjectId(req.query.actor)) filter.actor = req.query.actor
    const search = String(req.query.search || '').trim().slice(0, 100)
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$or = [
        { actorName: { $regex: escaped, $options: 'i' } },
        { actorEmail: { $regex: escaped, $options: 'i' } },
        { entityLabel: { $regex: escaped, $options: 'i' } },
      ]
    }
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null
    const createdAt = {}
    if (dateFrom && !Number.isNaN(dateFrom.getTime())) createdAt.$gte = dateFrom
    if (dateTo && !Number.isNaN(dateTo.getTime())) createdAt.$lt = dateTo
    if (Object.keys(createdAt).length) filter.createdAt = createdAt

    const indiaParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date())
    const indiaDate = Object.fromEntries(indiaParts.map(({ type, value }) => [type, value]))
    const todayStart = new Date(Date.UTC(Number(indiaDate.year), Number(indiaDate.month) - 1, Number(indiaDate.day)) - (5 * 60 + 30) * 60 * 1000)
    const todayFilter = { ...filter, createdAt: { ...createdAt, $gte: createdAt.$gte && createdAt.$gte > todayStart ? createdAt.$gte : todayStart } }
    const [items, total, today, actionCounts, actors] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ActivityLog.countDocuments(filter),
      ActivityLog.countDocuments(todayFilter),
      ActivityLog.aggregate([{ $match: filter }, { $group: { _id: '$action', count: { $sum: 1 } } }]),
      ActivityLog.aggregate([
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$actor', name: { $first: '$actorName' }, email: { $first: '$actorEmail' } } },
        { $sort: { name: 1 } },
      ]),
    ])
    const byAction = Object.fromEntries(actionCounts.map(({ _id, count }) => [_id, count]))
    res.json({
      items,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      summary: { total, today, create: byAction.create || 0, update: byAction.update || 0, delete: byAction.delete || 0 },
      actors: actors.map(({ _id, name, email }) => ({ _id, name, email })),
    })
  } catch (error) { next(error) }
}

/**
 * Primary admin only: deletes the whole activity history.
 * The request must carry { confirm: 'CLEAR' } (typed in the confirmation popup).
 * One new entry records who cleared it and how many records were removed.
 */
export async function clearActivity(req, res, next) {
  try {
    if (String(req.body?.confirm || '').trim().toUpperCase() !== 'CLEAR') return res.status(400).json({ message: 'Type CLEAR to confirm.' })
    const { deletedCount } = await ActivityLog.deleteMany({})
    await recordActivity(req, { action: 'delete', entity: 'settings', entityLabel: `Activity history cleared (${deletedCount} records)` })
    res.json({ message: `Activity history cleared. ${deletedCount} records removed.`, deletedCount })
  } catch (error) { next(error) }
}

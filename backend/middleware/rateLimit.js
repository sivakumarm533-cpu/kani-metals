import AuthRateLimit from '../models/AuthRateLimit.js'
import { createHash } from 'node:crypto'

export function authRateLimit({ action, max = 10, windowMs = 15 * 60 * 1000 }) {
  return async (req, res, next) => {
    try {
      const source = `${req.ip || req.socket.remoteAddress || 'unknown'}:${String(req.body?.email || '').trim().toLowerCase()}`
      const fingerprint = createHash('sha256').update(source).digest('hex')
      const key = `${action}:${fingerprint}`
      const now = new Date()
      const current = await AuthRateLimit.findOne({ key })
      if (!current || current.resetAt <= now) {
        await AuthRateLimit.findOneAndUpdate({ key }, { count: 1, resetAt: new Date(Date.now() + windowMs) }, { upsert: true, new: true })
        return next()
      }
      if (current.count >= max) return res.status(429).json({ message: 'Too many attempts. Please wait and try again.' })
      await AuthRateLimit.updateOne({ _id: current._id }, { $inc: { count: 1 } })
      next()
    } catch (error) { next(error) }
  }
}

import AuthRateLimit from '../models/AuthRateLimit.js'
import { createHash } from 'node:crypto'

const fingerprint = (value) => createHash('sha256').update(value).digest('hex')

/** Atomically counts one attempt for `key` and returns the count in the current window. */
async function consume(key, windowMs) {
  const now = new Date()
  const active = await AuthRateLimit.findOneAndUpdate(
    { key, resetAt: { $gt: now } },
    { $inc: { count: 1 } },
    { returnDocument: 'after' },
  )
  if (active) return active.count
  try {
    const fresh = await AuthRateLimit.findOneAndUpdate(
      { key },
      { $set: { count: 1, resetAt: new Date(now.getTime() + windowMs) } },
      { upsert: true, returnDocument: 'after' },
    )
    return fresh.count
  } catch (error) {
    // Two first attempts raced on the unique key; count this one against the winner.
    if (error.code !== 11000) throw error
    const retried = await AuthRateLimit.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { returnDocument: 'after' })
    return retried?.count ?? 1
  }
}

/**
 * Database-backed limiter for authentication routes. Each request counts against
 * two buckets: the address + submitted email pair, and the address alone (with a
 * higher ceiling), so rotating the email cannot bypass the limit.
 */
export function authRateLimit({ action, max = 10, windowMs = 15 * 60 * 1000, ipMultiplier = 3 }) {
  return async (req, res, next) => {
    try {
      const ip = req.ip || req.socket.remoteAddress || 'unknown'
      const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 254)
      const [pairCount, ipCount] = await Promise.all([
        consume(`${action}:${fingerprint(`${ip}:${email}`)}`, windowMs),
        consume(`${action}:ip:${fingerprint(ip)}`, windowMs),
      ])
      if (pairCount > max || ipCount > max * ipMultiplier) {
        res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)))
        return res.status(429).json({ message: 'Too many attempts. Please wait a few minutes and try again.' })
      }
      next()
    } catch (error) { next(error) }
  }
}

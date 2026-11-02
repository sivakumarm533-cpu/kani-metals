import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { getJwtSecret } from '../config/secrets.js'

export async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ message: 'Sign in to continue.' })
    const payload = jwt.verify(token, getJwtSecret())
    const user = await User.findById(payload.sub).select('name email role')
    if (!user) return res.status(401).json({ message: 'This account is no longer available.' })
    req.user = user
    next()
  } catch {
    res.status(401).json({ message: 'Your session has expired. Please sign in again.' })
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' })
  next()
}

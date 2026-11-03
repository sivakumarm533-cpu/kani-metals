import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import AuthSession from '../models/AuthSession.js'
import { getJwtSecret } from '../config/secrets.js'

export async function authenticate(req, res, next) {
  let payload
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ message: 'Sign in to continue.' })
    payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] })
  } catch (error) {
    if (error.statusCode === 503) return next(error)
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' })
  }
  try {
    if (!payload.jti || typeof payload.sub !== 'string') return res.status(401).json({ message: 'This session is no longer valid. Please sign in again.' })
    const session = await AuthSession.findOne({ jti: String(payload.jti), user: payload.sub, expiresAt: { $gt: new Date() } }).lean()
    if (!session) return res.status(401).json({ message: 'This session has ended. Please sign in again.' })
    // The profile picture is intentionally not loaded here; it can be large and only /auth/me needs it.
    const user = await User.findById(payload.sub).select('name email role totpEnabled createdAt')
    if (!user) return res.status(401).json({ message: 'This account is no longer available.' })
    if (user.role === 'admin' && !user.totpEnabled) return res.status(403).json({ message: 'Admin authenticator setup is required. Sign in again to enroll.' })
    req.user = user
    req.authSessionId = payload.jti
    next()
  } catch (error) { next(error) }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' })
  next()
}

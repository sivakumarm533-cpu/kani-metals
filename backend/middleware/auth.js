import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import AuthSession from '../models/AuthSession.js'
import { getJwtSecret } from '../config/secrets.js'

export async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ message: 'Sign in to continue.' })
    const payload = jwt.verify(token, getJwtSecret())
    if (!payload.jti) return res.status(401).json({ message: 'This session is no longer valid. Please sign in again.' })
    const session = await AuthSession.findOne({ jti: payload.jti, user: payload.sub, expiresAt: { $gt: new Date() } })
    if (!session) return res.status(401).json({ message: 'This session has ended. Please sign in again.' })
    const user = await User.findById(payload.sub).select('name email role totpEnabled').select('+profilePicture')
    if (!user) return res.status(401).json({ message: 'This account is no longer available.' })
    if (user.role === 'admin' && !user.totpEnabled) return res.status(403).json({ message: 'Admin authenticator setup is required. Sign in again to enroll.' })
    req.user = user
    req.authSessionId = payload.jti
    next()
  } catch {
    res.status(401).json({ message: 'Your session has expired. Please sign in again.' })
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' })
  next()
}

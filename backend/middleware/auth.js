import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import AuthSession from '../models/AuthSession.js'
import AppSetting from '../models/AppSetting.js'
import { getJwtSecret } from '../config/secrets.js'
import { isManagerRole } from '../config/features.js'

/**
 * Short-lived in-memory cache of verified sessions. Every API call used to make two
 * sequential database round trips just to check the token; most screens fire several
 * calls at once, so caching for a few seconds removes most of that latency.
 * Sign-out, deleting a user and role changes clear the entries on this instance.
 */
const SESSION_CACHE_MS = 20 * 1000
const sessionCache = new Map()

export function forgetSession(jti) { sessionCache.delete(String(jti)) }
export function forgetUserSessions(userId) {
  const id = String(userId)
  for (const [key, entry] of sessionCache) if (String(entry.user._id) === id) sessionCache.delete(key)
}

async function loadSession(jti, userId) {
  const cached = sessionCache.get(jti)
  if (cached && cached.until > Date.now() && String(cached.user._id) === userId) return cached
  const [session, user] = await Promise.all([
    AuthSession.findOne({ jti, user: userId, expiresAt: { $gt: new Date() } }).select('_id').lean(),
    // The profile picture is intentionally not loaded here; it can be large and only /auth/me needs it.
    User.findById(userId).select('name email role totpEnabled createdAt featureAccess').lean(),
  ])
  const entry = { session: Boolean(session), user, until: Date.now() + SESSION_CACHE_MS }
  if (session && user) {
    if (sessionCache.size > 2000) sessionCache.clear()
    sessionCache.set(jti, entry)
  }
  return entry
}

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
    const { session, user } = await loadSession(String(payload.jti), payload.sub)
    if (!session) return res.status(401).json({ message: 'This session has ended. Please sign in again.' })
    if (!user) return res.status(401).json({ message: 'This account is no longer available.' })
    if (user.role === 'admin' && !user.totpEnabled) return res.status(403).json({ message: 'Admin authenticator setup is required. Sign in again to enroll.' })
    req.user = { ...user, id: String(user._id) }
    req.authSessionId = payload.jti
    next()
  } catch (error) { next(error) }
}

/** Administrators and sub-admins. */
export function requireAdmin(req, res, next) {
  if (!isManagerRole(req.user?.role)) return res.status(403).json({ message: 'Administrator access is required.' })
  next()
}

/** Only the primary administrator (not sub-admins). */
export function requirePrimaryAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Only the primary administrator can do this.' })
  next()
}

let featureCache = { until: 0, features: null }
export function forgetFeatureCache() { featureCache = { until: 0, features: null } }

async function enabledFeatures() {
  if (featureCache.features && featureCache.until > Date.now()) return featureCache.features
  const settings = await AppSetting.findOne({ key: 'app' }).select('features').lean()
  featureCache = { until: Date.now() + SESSION_CACHE_MS, features: settings?.features || {} }
  return featureCache.features
}

/**
 * Blocks changes made through a feature the administrator has switched off for
 * regular users. Reads stay open because other screens share the same data.
 */
export function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      if (req.method === 'GET' || isManagerRole(req.user?.role)) return next()
      // A per-person setting wins over the workspace setting.
      const own = req.user?.featureAccess?.[feature]
      if (own === true) return next()
      if (own === false) return res.status(403).json({ message: 'This feature has been turned off for your account by your administrator.' })
      const features = await enabledFeatures()
      if (features[feature] === false) return res.status(403).json({ message: 'This feature has been turned off by your administrator.' })
      next()
    } catch (error) { next(error) }
  }
}

import cors from 'cors'

/**
 * Baseline security headers for a JSON API. The API never serves HTML, so the
 * content security policy can deny everything.
 */
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  // Business and account data must not be stored by shared caches or the browser cache.
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store')
  next()
}

export function configuredCorsOrigins() {
  return String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

/**
 * Restricts browser access to the origins listed in CORS_ORIGINS
 * (comma separated, e.g. "https://kani-metals.vercel.app,http://localhost:5173").
 * When it is not configured the API stays reachable from any origin so an
 * existing deployment does not break, and a warning is logged at startup.
 * Authentication uses bearer tokens (not cookies), so other origins still
 * cannot act as a signed-in user without stealing a token.
 */
export function corsMiddleware() {
  const allowedOrigins = configuredCorsOrigins()
  return cors({
    origin: allowedOrigins.length ? (origin, done) => done(null, !origin || allowedOrigins.includes(origin)) : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 600,
  })
}

/**
 * Small in-memory fixed-window limiter for the general API. It protects a
 * single instance from request floods; authentication routes additionally use
 * the database-backed limiter in rateLimit.js.
 */
export function apiRateLimit({ max = 1200, windowMs = 5 * 60 * 1000 } = {}) {
  const hits = new Map()
  let nextSweep = Date.now() + windowMs
  return (req, res, next) => {
    const now = Date.now()
    if (now >= nextSweep) {
      for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key)
      nextSweep = now + windowMs
    }
    const key = req.ip || req.socket?.remoteAddress || 'unknown'
    let entry = hits.get(key)
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs }
      hits.set(key, entry)
    }
    entry.count += 1
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
      return res.status(429).json({ message: 'Too many requests. Please wait a moment and try again.' })
    }
    next()
  }
}

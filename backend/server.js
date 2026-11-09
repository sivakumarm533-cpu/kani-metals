import 'dotenv/config'
import express from 'express'
import connectDB from './config/db.js'
import billRoutes from './routes/billRoutes.js'
import paymentRoutes from './routes/paymentRoutes.js'
import dealerRoutes from './routes/dealerRoutes.js'
import productRoutes from './routes/productRoutes.js'
import authRoutes from './routes/authRoutes.js'
import backupRoutes, { BACKUP_IMPORT_PATH } from './routes/backupRoutes.js'
import settingsRoutes from './routes/settingsRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import { authenticate, requireFeature } from './middleware/auth.js'
import { apiRateLimit, configuredCorsOrigins, corsMiddleware, securityHeaders } from './middleware/security.js'
import { totpEncryptionKeyConfigured } from './utils/totp.js'

const app = express()
const port = Number(process.env.PORT) || 5000
app.set('trust proxy', 1)
app.disable('x-powered-by')

if (!configuredCorsOrigins().length && process.env.NODE_ENV === 'production') {
  console.warn('CORS_ORIGINS is not set; the API accepts browser requests from any origin. Set it to the frontend URL.')
}

app.use(securityHeaders)
app.use(corsMiddleware())
app.use('/api', apiRateLimit())

// Regular requests are capped at 8 MB (dealer and bill images are sent as data URLs).
// The backup import route parses its own larger body, but only after admin authentication.
const defaultJsonParser = express.json({ limit: '8mb' })
app.use((req, res, next) => (req.path === `/api/admin/backup${BACKUP_IMPORT_PATH}` ? next() : defaultJsonParser(req, res, next)))

app.use(async (_req, res, next) => {
  try {
    await connectDB()
    next()
  } catch (error) {
    console.error('MongoDB connection failed:', error.message)
    res.status(503).json({ message: 'The database is temporarily unavailable. Please try again shortly.' })
  }
})
app.get('/api/health', (_req, res) => res.json({
  status: 'ok',
  authConfig: {
    jwtSecretConfigured: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 && !process.env.JWT_SECRET.toLowerCase().startsWith('replace-')),
    adminEmailConfigured: Boolean(process.env.ADMIN_EMAIL),
    totpEncryptionKeyConfigured: totpEncryptionKeyConfigured(),
  },
}))
app.use('/api/auth', authRoutes)
app.use('/api', authenticate)
app.use('/api/dealers', requireFeature('itemEntry'), dealerRoutes)
app.use('/api/products', requireFeature('products'), productRoutes)
app.use('/api/bills', requireFeature('itemEntry'), billRoutes)
app.use('/api/payments', requireFeature('dealerPayments'), paymentRoutes)
app.use('/api/admin/backup', backupRoutes)
app.use('/api/app-settings', settingsRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.get('/', (_req, res) => {
  res.send('Kani Metals API is running successfully!')
})
app.use('/api', (_req, res) => res.status(404).json({ message: 'API route not found.' }))

function publicError(error) {
  if (error.type === 'entity.too.large') return { status: 413, message: 'The request is too large. Use smaller images or files.' }
  if (error.type === 'entity.parse.failed') return { status: 400, message: 'The request body is not valid JSON.' }
  if (error.statusCode && error.statusCode < 500) return { status: error.statusCode, message: error.message }
  if (error.statusCode === 503) return { status: 503, message: error.message }
  if (error.name === 'CastError') return { status: 400, message: 'One of the supplied IDs or values is invalid.' }
  if (error.name === 'ValidationError') {
    const details = Object.values(error.errors || {}).map((entry) => entry.message).filter(Boolean)
    return { status: 400, message: details.length ? `Please check the form: ${details.slice(0, 3).join(' ')}` : 'Some of the submitted values are invalid.' }
  }
  if (error.code === 11000) return { status: 409, message: 'A record with these details already exists.' }
  return { status: 500, message: 'Something went wrong on the server. Please try again.' }
}

app.use((error, req, res, _next) => {
  const { status, message } = publicError(error)
  if (status >= 500) console.error(`[${req.method} ${req.path}]`, error)
  res.status(status).json({ message, ...(error.publicCode ? { code: error.publicCode } : {}) })
})

if (!process.env.VERCEL) {
  connectDB()
    .then(() => {
      app.listen(port, '0.0.0.0', () => console.log(`Backend server listening on port ${port}`))
    })
    .catch((error) => {
      console.error('MongoDB connection failed:', error.message)
      process.exit(1)
    })
}

export default app

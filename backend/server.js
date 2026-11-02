import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import connectDB from './config/db.js'
import billRoutes from './routes/billRoutes.js'
import dealerRoutes from './routes/dealerRoutes.js'
import productRoutes from './routes/productRoutes.js'
import authRoutes from './routes/authRoutes.js'
import backupRoutes from './routes/backupRoutes.js'
import { authenticate } from './middleware/auth.js'

const app = express()
const port = Number(process.env.PORT) || 5000
app.set('trust proxy', 1)

app.use(cors())
app.use(express.json({ limit: '12mb' }))
app.use(async (_req, res, next) => {
  try {
    await connectDB()
    next()
  } catch (error) {
    console.error('MongoDB connection failed:', error.message)
    res.status(503).json({ message: 'Database unavailable. Check the MONGODB_URI environment variable and database access.' })
  }
})
app.get('/api/health', (_req, res) => res.json({
  status: 'ok',
  authConfig: {
    jwtSecretConfigured: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 && !process.env.JWT_SECRET.toLowerCase().startsWith('replace-')),
    smtpUserConfigured: Boolean(process.env.SMTP_USER),
    smtpAppPasswordConfigured: Boolean(process.env.SMTP_APP_PASSWORD),
  },
}))
app.use('/api/auth', authRoutes)
app.use('/api', authenticate)
app.use('/api/dealers', dealerRoutes)
app.use('/api/products', productRoutes)
app.use('/api/bills', billRoutes)
app.use('/api/admin/backup', backupRoutes)
app.get('/', (_req, res) => {
  res.send('Kani Metals API is running successfully!')
})
app.use((error, _req, res, _next) => {
  console.error(error)
  const status = error.statusCode || (error.name === 'ValidationError' || error.name === 'CastError' ? 400 : error.code === 11000 ? 409 : 500)
  const message = error.statusCode ? error.message : status === 400 ? error.message : 'Server error. Check the backend terminal.'
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

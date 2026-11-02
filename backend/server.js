import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import connectDB from './config/db.js'
import billRoutes from './routes/billRoutes.js'
import dealerRoutes from './routes/dealerRoutes.js'
import productRoutes from './routes/productRoutes.js'

const app = express()
const port = Number(process.env.PORT) || 5000

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
app.use('/api/dealers', dealerRoutes)
app.use('/api/products', productRoutes)
app.use('/api/bills', billRoutes)
app.get('/', (_req, res) => {
  res.send('Kani Metals API is running successfully!')
})
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.use((error, _req, res, _next) => {
  console.error(error)
  const status = error.name === 'ValidationError' || error.name === 'CastError' ? 400 : 500
  res.status(status).json({ message: status === 400 ? error.message : 'Server error. Check the backend terminal.' })
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

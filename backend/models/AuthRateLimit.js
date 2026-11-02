import mongoose from 'mongoose'

const authRateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0 },
  resetAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true })

export default mongoose.model('AuthRateLimit', authRateLimitSchema)

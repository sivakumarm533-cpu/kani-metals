import mongoose from 'mongoose'

const emailVerificationSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, index: true },
  purpose: { type: String, enum: ['registration', 'admin-login'], required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true })

emailVerificationSchema.index({ email: 1, purpose: 1 }, { unique: true })

export default mongoose.model('EmailVerification', emailVerificationSchema)

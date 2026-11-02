import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  totpSecretEncrypted: { type: String, select: false },
  totpEnabled: { type: Boolean, default: false },
  totpLastTimeStep: { type: Number, select: false },
  recoveryCodeHashes: { type: [String], default: [], select: false },
}, { timestamps: true })

export default mongoose.model('User', userSchema)

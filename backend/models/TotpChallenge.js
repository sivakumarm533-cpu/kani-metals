import mongoose from 'mongoose'

const totpChallengeSchema = new mongoose.Schema({
  challengeHash: { type: String, required: true, unique: true },
  purpose: { type: String, enum: ['registration', 'enrollment', 'login'], required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, maxlength: 100 },
  passwordHash: { type: String, select: false },
  secretEncrypted: { type: String, select: false },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true })

export default mongoose.model('TotpChallenge', totpChallengeSchema)

import mongoose from 'mongoose'
import { DEFAULT_BOTTOM_NAV, NAV_STYLES, ROLES } from '../config/features.js'

const preferencesSchema = new mongoose.Schema({
  /** Personal theme id; empty means "use the workspace theme". */
  theme: { type: String, default: '' },
  /** Screens pinned to the mobile bottom bar, in order. */
  bottomNav: { type: [String], default: () => [...DEFAULT_BOTTOM_NAV] },
  navStyle: { type: String, enum: NAV_STYLES, default: 'light' },
}, { _id: false })

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  profilePicture: { type: String, default: '', select: false },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, default: 'user' },
  preferences: { type: preferencesSchema, default: () => ({}) },
  totpSecretEncrypted: { type: String, select: false },
  totpEnabled: { type: Boolean, default: false },
  totpLastTimeStep: { type: Number, select: false },
  recoveryCodeHashes: { type: [String], default: [], select: false },
}, { timestamps: true })

export default mongoose.model('User', userSchema)

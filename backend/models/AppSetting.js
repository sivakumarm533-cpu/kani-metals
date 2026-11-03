import mongoose from 'mongoose'

export const THEME_IDS = ['copper', 'ocean', 'emerald', 'royal', 'crimson', 'teal', 'steel', 'gold', 'rose', 'midnight']

/** Single application-wide settings document (key "app"). */
const appSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'app' },
  theme: { type: String, enum: THEME_IDS, default: 'copper' },
  business: {
    name: { type: String, trim: true, maxlength: 120, default: 'Kani Metals' },
    tagline: { type: String, trim: true, maxlength: 120, default: 'Scrap metal traders' },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    email: { type: String, trim: true, maxlength: 254, default: '' },
    gstin: { type: String, trim: true, maxlength: 30, default: '' },
    terms: { type: String, trim: true, maxlength: 1000, default: 'Goods once sold will not be taken back. Please pay the balance amount on or before the due date.' },
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

export default mongoose.model('AppSetting', appSettingSchema)

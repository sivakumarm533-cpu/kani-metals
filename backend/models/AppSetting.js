import mongoose from 'mongoose'
import { FEATURE_KEYS } from '../config/features.js'

/** Bill image designs; keep in sync with BILL_TEMPLATES in frontend/src/utils/billImage.js. */
export const BILL_TEMPLATE_IDS = ['classic', 'modern', 'minimal', 'bold', 'soft']

export const THEME_IDS = ['copper', 'ocean', 'emerald', 'royal', 'crimson', 'teal', 'steel', 'gold', 'rose', 'midnight', 'christmas']

const featureFields = Object.fromEntries(FEATURE_KEYS.map((key) => [key, { type: Boolean, default: true }]))

/** Single application-wide settings document (key "app"). */
const appSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'app' },
  theme: { type: String, enum: THEME_IDS, default: 'copper' },
  /** When true, every user may pick a personal theme on their profile page. */
  allowUserThemes: { type: Boolean, default: true },
  /** Features available to regular users (admins and sub-admins always have all of them). */
  features: { type: new mongoose.Schema(featureFields, { _id: false }), default: () => ({}) },
  /** Order of the main menu for everyone. Empty means the default order. */
  menuOrder: { type: [String], default: () => [] },
  billTemplate: { type: String, enum: BILL_TEMPLATE_IDS, default: 'classic' },
  business: {
    name: { type: String, trim: true, maxlength: 120, default: 'Kani Metals' },
    tagline: { type: String, trim: true, maxlength: 120, default: 'Scrap metal traders' },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    email: { type: String, trim: true, maxlength: 254, default: '' },
    gstin: { type: String, trim: true, maxlength: 30, default: '' },
    terms: { type: String, trim: true, maxlength: 1000, default: 'Goods once sold will not be taken back. Please pay the balance amount on or before the due date.' },
    /** Print the terms & conditions on bills. */
    showTerms: { type: Boolean, default: true },
    /** Greeting printed at the bottom of bills. */
    greeting: { type: String, trim: true, maxlength: 200, default: 'Thank you for your business' },
    /** Print the greeting on bills. */
    showGreeting: { type: Boolean, default: true },
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

export default mongoose.model('AppSetting', appSettingSchema)

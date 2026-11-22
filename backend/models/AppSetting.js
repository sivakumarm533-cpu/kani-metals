import mongoose from 'mongoose'
import { DEFAULT_LISTS, FEATURE_KEYS } from '../config/features.js'

/** Bill image designs; keep in sync with BILL_TEMPLATES in frontend/src/utils/billImage.js. */
export const BILL_TEMPLATE_IDS = ['classic', 'modern', 'minimal', 'bold', 'soft']

/** Keep in sync with THEMES in frontend/src/theme/themes.js (tier: 'premium' there). */
export const THEME_IDS = ['copper', 'ocean', 'emerald', 'royal', 'crimson', 'teal', 'steel', 'gold', 'rose', 'midnight', 'pongal', 'diwali', 'holi', 'aurora', 'deepsea', 'luxe', 'christmas']

/**
 * POS (thermal receipt) printing, kept apart from the WhatsApp bill image settings.
 * Keep in sync with POS_DEFAULTS in frontend/src/settings/appSettingsContext.js.
 */
export const POS_DEFAULTS = {
  template: 'classic', paperWidth: '80', fontSize: 'normal', copies: 1, feedLines: 3,
  showLogo: true, showAddress: true, showPhone: true, showGstin: true, showDealer: true,
  showItemNotes: false, showPayments: true, showPreviousBalance: false, showTerms: false, showGreeting: true,
  footerNote: '',
}
/** Receipt designs; keep in sync with POS_TEMPLATES in frontend/src/utils/posReceipt.js. */
export const POS_TEMPLATES = ['classic', 'compact', 'bold', 'mono', 'invoice']
export const POS_PAPER_WIDTHS = ['58', '80']
export const POS_FONT_SIZES = ['small', 'normal', 'large']
export const POS_FLAGS = Object.keys(POS_DEFAULTS).filter((key) => typeof POS_DEFAULTS[key] === 'boolean')

const posSchema = new mongoose.Schema({
  template: { type: String, enum: POS_TEMPLATES, default: POS_DEFAULTS.template },
  paperWidth: { type: String, enum: POS_PAPER_WIDTHS, default: POS_DEFAULTS.paperWidth },
  fontSize: { type: String, enum: POS_FONT_SIZES, default: POS_DEFAULTS.fontSize },
  copies: { type: Number, min: 1, max: 3, default: POS_DEFAULTS.copies },
  /** Blank lines after the receipt so it can be torn off below the last line. */
  feedLines: { type: Number, min: 0, max: 10, default: POS_DEFAULTS.feedLines },
  ...Object.fromEntries(POS_FLAGS.map((key) => [key, { type: Boolean, default: POS_DEFAULTS[key] }])),
  footerNote: { type: String, trim: true, maxlength: 200, default: '' },
}, { _id: false })

const featureFields = Object.fromEntries(FEATURE_KEYS.map((key) => [key, { type: Boolean, default: true }]))

/** Single application-wide settings document (key "app"). */
const appSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'app' },
  theme: { type: String, enum: THEME_IDS, default: 'copper' },
  /** When true, every user may pick a personal theme on their profile page. */
  allowUserThemes: { type: Boolean, default: true },
  /** Themes team members may pick on their profile. Missing means every theme. Admins and sub-admins may use any theme. */
  userThemes: { type: [String], default: undefined },
  /** Features available to regular users (admins and sub-admins always have all of them). */
  features: { type: new mongoose.Schema(featureFields, { _id: false }), default: () => ({}) },
  /** Order of the main menu for everyone. Empty means the default order. */
  menuOrder: { type: [String], default: () => [] },
  billTemplate: { type: String, enum: BILL_TEMPLATE_IDS, default: 'classic' },
  /** Dropdown choices (item categories, dealer categories, units). Missing lists use DEFAULT_LISTS. */
  lists: {
    itemCategories: { type: [String], default: undefined },
    dealerCategories: { type: [String], default: undefined },
    units: { type: [String], default: undefined },
  },
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
  pos: { type: posSchema, default: () => ({}) },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

export default mongoose.model('AppSetting', appSettingSchema)

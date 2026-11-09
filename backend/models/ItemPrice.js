import mongoose from 'mongoose'

const priceChangeSchema = new mongoose.Schema({
  action: { type: String, enum: ['set', 'clear'], required: true },
  pricePaise: { type: Number, default: null },
  note: { type: String, default: '' },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  changedByName: { type: String, default: '' },
  changedAt: { type: Date, default: Date.now },
}, { _id: false })

/**
 * A manual price for one item on the Item prices screen. It only changes what that
 * screen shows: bills, products and the dashboard keep using bill prices.
 * `key` is the lower-cased "name|unit" used to group bill lines.
 */
const itemPriceSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, maxlength: 300 },
  name: { type: String, required: true, trim: true },
  unit: { type: String, default: '', trim: true },
  /** null when no manual price is active (the latest bill price is used). */
  pricePaise: { type: Number, default: null, min: 0 },
  note: { type: String, default: '', maxlength: 200 },
  category: { type: String, default: '', trim: true, maxlength: 80 },
  /** Added on the Item prices screen (no bill needed). Bills with the same name and unit join it later. */
  addedManually: { type: Boolean, default: false },
  /** Uploaded photo; when empty the latest bill photo is shown. */
  image: { type: String, default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedByName: { type: String, default: '' },
  history: { type: [priceChangeSchema], default: [] },
}, { timestamps: true })

export default mongoose.model('ItemPrice', itemPriceSchema)

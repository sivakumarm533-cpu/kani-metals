import mongoose from 'mongoose'

const billItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  image: { type: String, default: '' },
  /** Optional line note printed on the bill, e.g. "1210 - 10 = 1200 (10 kg waste)". */
  note: { type: String, trim: true, maxlength: 200, default: '' },
}, { _id: false })

const billSchema = new mongoose.Schema({
  dealer: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', required: true },
  issuedDate: { type: Date, required: true },
  items: { type: [billItemSchema], required: true, validate: (items) => items.length > 0 },
  total: { type: Number, required: true, min: 0 },
  receivedPaise: { type: Number, default: 0, min: 0 },
}, { timestamps: true })

// Bills are listed per dealer and newest first on almost every screen.
billSchema.index({ dealer: 1, issuedDate: -1 })
billSchema.index({ issuedDate: -1, createdAt: -1 })

export default mongoose.model('Bill', billSchema)

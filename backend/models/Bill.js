import mongoose from 'mongoose'

const billItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  image: { type: String, default: '' },
}, { _id: false })

const billSchema = new mongoose.Schema({
  dealer: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', required: true },
  issuedDate: { type: Date, required: true },
  items: { type: [billItemSchema], required: true, validate: (items) => items.length > 0 },
  total: { type: Number, required: true, min: 0 },
  receivedPaise: { type: Number, default: 0, min: 0 },
}, { timestamps: true })

export default mongoose.model('Bill', billSchema)

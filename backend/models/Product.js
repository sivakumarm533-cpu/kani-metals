import mongoose from 'mongoose'

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  image: { type: String, default: '' },
  /** Last manual stock change (bills never change stock). */
  stockUpdatedAt: { type: Date, default: null },
  stockUpdatedByName: { type: String, default: '' },
  /** Recent manual stock changes, newest last (kept to 30). Not sent with the product list. */
  stockHistory: {
    type: [new mongoose.Schema({
      mode: { type: String, enum: ['set', 'add', 'remove', 'opening'], required: true },
      amount: { type: Number, required: true },
      before: { type: Number, required: true },
      after: { type: Number, required: true },
      note: { type: String, default: '' },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      changedByName: { type: String, default: '' },
      changedAt: { type: Date, default: Date.now },
    }, { _id: false })],
    default: [],
    select: false,
  },
}, { timestamps: true })

export default mongoose.model('Product', productSchema)

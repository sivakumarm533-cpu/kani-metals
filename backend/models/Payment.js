import mongoose from 'mongoose'

const paymentStatusSchema = new mongoose.Schema({
  status: { type: String, enum: ['received', 'cleared', 'pending', 'bounced', 'reversed'], required: true },
  changedAt: { type: Date, default: Date.now },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, default: '' },
}, { _id: false })

const paymentSchema = new mongoose.Schema({
  dealer: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', required: true, index: true },
  bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', required: true, index: true },
  amountPaise: { type: Number, required: true, min: 1 },
  // 'advance' means the money came from the dealer's advance (extra paid earlier), not new money.
  paymentMethod: { type: String, enum: ['gpay', 'phonepe', 'paytm', 'upi_other', 'net_banking', 'cheque', 'bank_deposit', 'cash', 'other', 'advance'], required: true },
  /** Part of amountPaise that was more than the bill's balance and went to the dealer's advance. */
  excessPaise: { type: Number, default: 0, min: 0 },
  /** What happened to the extra: kept as dealer advance, or written off as round-off. */
  excessType: { type: String, enum: ['advance', 'roundoff'], default: 'advance' },
  transactionReference: { type: String, trim: true, default: '' },
  referenceKey: { type: String, default: undefined },
  paymentDate: { type: Date, required: true },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  methodDetails: {
    bankName: { type: String, trim: true, maxlength: 120, default: '' },
    chequeDate: { type: Date, default: null },
  },
  paymentStatus: { type: String, enum: ['received', 'cleared', 'pending', 'bounced', 'reversed'], required: true },
  statusHistory: { type: [paymentStatusSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

paymentSchema.index({ referenceKey: 1 }, { unique: true, partialFilterExpression: { referenceKey: { $type: 'string' } } })
paymentSchema.index({ dealer: 1, paymentDate: -1 })
paymentSchema.index({ bill: 1, paymentDate: -1 })

export default mongoose.model('Payment', paymentSchema)

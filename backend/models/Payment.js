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
  paymentMethod: { type: String, enum: ['gpay', 'phonepe', 'paytm', 'upi_other', 'net_banking', 'cheque', 'bank_deposit', 'cash', 'other'], required: true },
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

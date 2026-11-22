import mongoose from 'mongoose'

/**
 * One pay rate and the day it started. Changing someone's pay adds a new entry,
 * so wages already earned keep the rate they were earned at.
 */
const payRateSchema = new mongoose.Schema({
  from: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  payType: { type: String, enum: ['daily', 'monthly'], required: true },
  /** Daily wage (daily workers) or monthly salary (monthly staff), in paise. */
  ratePaise: { type: Number, required: true, min: 0 },
  /** Extra pay per overtime hour, in paise. */
  overtimeRatePaise: { type: Number, default: 0, min: 0 },
}, { _id: false })

/** Staff are records kept by administrators; they do not sign in. */
const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  designation: { type: String, trim: true, maxlength: 80, default: '' },
  photo: { type: String, default: '' },
  joinDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  /** Last working day once someone has left; wages stop after it. */
  leftDate: { type: String, default: '', match: /^(\d{4}-\d{2}-\d{2})?$/ },
  active: { type: Boolean, default: true },
  /** Weekly day off: 0 = Sunday … 6 = Saturday, -1 = none. */
  weeklyOff: { type: Number, default: 0, min: -1, max: 6 },
  payHistory: { type: [payRateSchema], default: [], validate: [(list) => list.length > 0, 'Enter the pay for this employee.'] },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
}, { timestamps: true })

employeeSchema.index({ active: -1, name: 1 })

export default mongoose.model('Employee', employeeSchema)
